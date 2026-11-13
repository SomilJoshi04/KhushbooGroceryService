/**
 * Admin Delivery Zone Management Page — Full CRUD, Overlap Detection, Map Radius Preview.
 *
 * Implements:
 * - Zone list with live filters (Active, Paused, Inactive), search, and pagination.
 * - Create & Edit modals with Leaflet interactive coverage radius map.
 * - Temporary service pause toggle with mandatory pause reason.
 * - Safe deletion safeguarding historical orders.
 *
 * @module pages/admin/AdminZones
 */

import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Search,
  Plus,
  RefreshCw,
  PauseCircle,
  PlayCircle,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  X,
  Compass,
  Sliders,
  AlertCircle,
  Loader2,
  Info,
} from 'lucide-react';
import { ZoneRadiusMap } from '../../components/map/ZoneRadiusMap.jsx';
import { apiClient } from '../../config/api.js';
import { Pagination } from '../../components/Pagination.jsx';
import { useBulkSelection } from '../../hooks/useBulkSelection.js';
import { BulkActionBar } from '../../components/BulkActionBar.jsx';
import { BulkConfirmModal } from '../../components/BulkConfirmModal.jsx';
import { SkeletonTableRow } from '../../components/skeleton/index.js';
import { validateCoordinates } from '../../utils/coordinateValidator.js';

export function AdminZones() {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pagination, setPagination] = useState({ totalPages: 1, totalRecords: 0 });
  const [notification, setNotification] = useState(null);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingZone, setEditingZone] = useState(null);
  const [pauseTargetZone, setPauseTargetZone] = useState(null);
  const [pauseReasonInput, setPauseReasonInput] = useState('');
  const [deleteTargetZone, setDeleteTargetZone] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [overlapWarnings, setOverlapWarnings] = useState([]);
  const [modalError, setModalError] = useState('');

  // Form State for Create / Edit
  const defaultFormData = {
    name: '',
    code: '',
    description: '',
    city: 'Indore',
    state: 'Madhya Pradesh',
    supportedPincodes: '452001, 452002',
    centerLat: 22.7196,
    centerLng: 75.8577,
    radiusKm: 5.0,
    minOrderRupees: 150,
    freeDeliveryRupees: 499,
    baseFeeRupees: 25,
    distanceTierRupees: 5,
    maxDistanceKm: 15,
    estimatedDeliveryWindow: '60 - 90 Minutes',
    priority: 10,
    isActive: true,
  };
  const [formData, setFormData] = useState(defaultFormData);

  // Tracking automatic map location details & manual overrides
  const [resolvedLocation, setResolvedLocation] = useState(null);
  const [isResolvingLocation, setIsResolvingLocation] = useState(false);
  const [manuallyEdited, setManuallyEdited] = useState({
    city: false,
    state: false,
    supportedPincodes: false,
  });

  // Bulk Selection hook & modals
  const bulk = useBulkSelection(pagination.totalRecords);
  const [bulkConfig, setBulkConfig] = useState(null);
  const [bulkResultSummary, setBulkResultSummary] = useState(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  const fetchZones = async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: pageSize,
      };
      if (search.trim()) params.search = search.trim();
      if (statusFilter !== 'ALL') params.status = statusFilter;

      const res = await apiClient.get('/v1/admin/zones', { params });
      if (res.data?.success) {
        setZones(res.data.data || []);
        if (res.data.pagination) {
          setPagination(res.data.pagination);
        } else {
          setPagination({
            totalPages: res.data.totalPages || 1,
            totalRecords: res.data.total || (res.data.data ? res.data.data.length : 0),
          });
        }
        bulk.clearSelection();
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to load delivery zones.';
      showNotification(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerBulkZoneStatus = (action) => {
    const isPause = action === 'PAUSE';
    setBulkConfig({
      title: isPause
        ? 'Bulk Pause Delivery Zones'
        : action === 'ACTIVATE'
        ? 'Bulk Activate Delivery Zones'
        : 'Bulk Deactivate Delivery Zones',
      description: `You are about to ${action.toLowerCase()} ${bulk.selectedCount} delivery zone(s).`,
      affectedCount: bulk.selectedCount,
      itemName: 'delivery zones',
      confirmLabel: `${action} Selected`,
      confirmVariant: isPause ? 'warning' : action === 'ACTIVATE' ? 'primary' : 'warning',
      requireReason: isPause,
      reasonPlaceholder: 'Mandatory reason for pausing zone services...',
      reversibilityNotice: 'Storefront checkout zone serviceability is instantly updated.',
      onConfirm: async (reason) => {
        setBulkLoading(true);
        try {
          const res = await apiClient.post('/v1/admin/zones/bulk-status', {
            ids: bulk.selectedIds,
            selectAllMatching: bulk.selectAllMatching,
            filter: { status: statusFilter },
            action,
            reason,
          });
          setBulkResultSummary(res.data);
        } catch (err) {
          showNotification(err.response?.data?.message || 'Bulk zone status update failed.', 'error');
          setBulkConfig(null);
        } finally {
          setBulkLoading(false);
        }
      },
    });
  };

  const handleTriggerBulkZoneDelete = () => {
    setBulkConfig({
      title: 'Bulk Delete Delivery Zones',
      description: `Are you sure you want to delete ${bulk.selectedCount} delivery zone(s)?`,
      affectedCount: bulk.selectedCount,
      itemName: 'delivery zones',
      confirmLabel: 'Delete Zones',
      confirmVariant: 'danger',
      requireReason: false,
      reversibilityNotice:
        'Zones referenced by historical customer orders or saved addresses will be deactivated and archived instead to protect billing history.',
      onConfirm: async () => {
        setBulkLoading(true);
        try {
          const res = await apiClient.post('/v1/admin/zones/bulk-delete', {
            ids: bulk.selectedIds,
            selectAllMatching: bulk.selectAllMatching,
            filter: { status: statusFilter },
          });
          setBulkResultSummary(res.data);
        } catch (err) {
          showNotification(err.response?.data?.message || 'Bulk zone deletion failed.', 'error');
          setBulkConfig(null);
        } finally {
          setBulkLoading(false);
        }
      },
    });
  };

  useEffect(() => {
    fetchZones();
  }, [page, pageSize, statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchZones();
  };

  const showNotification = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4500);
  };

  // Open Create Modal
  const openCreateModal = () => {
    setEditingZone(null);
    setFormData(defaultFormData);
    setResolvedLocation(null);
    setManuallyEdited({ city: false, state: false, supportedPincodes: false });
    setOverlapWarnings([]);
    setModalError('');
    setIsCreateOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (zone) => {
    setEditingZone(zone);
    setFormData({
      name: zone.name,
      code: zone.code,
      description: zone.description || '',
      city: zone.city,
      state: zone.state,
      supportedPincodes: (zone.supportedPincodes || []).join(', '),
      centerLat: zone.center?.lat || 22.7196,
      centerLng: zone.center?.lng || 75.8577,
      radiusKm: zone.radiusKm || 5.0,
      minOrderRupees: (zone.minOrderAmountPaise || 15000) / 100,
      freeDeliveryRupees: (zone.freeDeliveryThresholdPaise || 49900) / 100,
      baseFeeRupees: (zone.deliveryFeeBasePaise || 2500) / 100,
      distanceTierRupees: (zone.distanceTierPaisePerKm || 500) / 100,
      maxDistanceKm: zone.maxDeliveryDistanceKm || 15,
      estimatedDeliveryWindow: zone.estimatedDeliveryWindow || '60 - 90 Minutes',
      priority: zone.priority || 10,
      isActive: zone.isActive ?? true,
    });
    setResolvedLocation(null);
    setManuallyEdited({ city: true, state: true, supportedPincodes: true });
    setOverlapWarnings([]);
    setModalError('');
    setIsCreateOpen(true);
  };

  // Automatic Location Resolver Handler from Map
  const handleLocationResolved = (details) => {
    if (!details || details.success === false) {
      if (details?.coordinates) {
        setFormData((prev) => ({
          ...prev,
          centerLat: details.coordinates.lat,
          centerLng: details.coordinates.lng,
        }));
      }
      return;
    }

    setResolvedLocation(details);

    setFormData((prev) => {
      const next = {
        ...prev,
        centerLat: details.coordinates.lat,
        centerLng: details.coordinates.lng,
      };

      // Auto-populate city if not manually edited by admin
      if (!manuallyEdited.city && details.city) {
        next.city = details.city;
      }
      // Auto-populate state if not manually edited
      if (!manuallyEdited.state && details.state) {
        next.state = details.state;
      }
      // Auto-populate postal PIN if not manually edited
      if (!manuallyEdited.supportedPincodes && details.pincode) {
        next.supportedPincodes = details.pincode;
      }
      // If zone name is empty in create mode, suggest based on locality
      if (!editingZone && !prev.name.trim() && (details.locality || details.sublocality)) {
        next.name = `${details.locality || details.sublocality} Zone`;
      }
      return next;
    });
  };

  // Save Zone (Create / Update)
  const handleSaveZone = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setOverlapWarnings([]);

    try {
      // Parse PIN codes
      const pincodesArray = formData.supportedPincodes
        .split(',')
        .map((p) => p.trim())
        .filter((p) => /^\d{6}$/.test(p));

      if (pincodesArray.length === 0) {
        showNotification('Please enter at least one valid 6-digit PIN code.', 'error');
        setActionLoading(false);
        return;
      }

      const coordCheck = validateCoordinates({
        lat: parseFloat(formData.centerLat),
        lng: parseFloat(formData.centerLng),
      });

      if (!coordCheck.valid || !coordCheck.normalized) {
        showNotification(coordCheck.error || 'Please provide valid zone center coordinates.', 'error');
        setActionLoading(false);
        return;
      }

      const numRadius = parseFloat(formData.radiusKm);
      if (!Number.isFinite(numRadius) || numRadius <= 0 || numRadius > 100) {
        showNotification('Zone coverage radius must be between 0.1 km and 100 km.', 'error');
        setActionLoading(false);
        return;
      }

      const payload = {
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase(),
        description: formData.description.trim(),
        city: formData.city.trim(),
        state: formData.state.trim(),
        supportedPincodes: pincodesArray,
        center: coordCheck.normalized,
        radiusKm: numRadius,
        minOrderAmountPaise: Math.round(Number(formData.minOrderRupees) * 100),
        freeDeliveryThresholdPaise: Math.round(Number(formData.freeDeliveryRupees) * 100),
        deliveryFeeBasePaise: Math.round(Number(formData.baseFeeRupees) * 100),
        distanceTierPaisePerKm: Math.round(Number(formData.distanceTierRupees) * 100),
        maxDeliveryDistanceKm: Number(formData.maxDistanceKm),
        estimatedDeliveryWindow: formData.estimatedDeliveryWindow.trim(),
        priority: Number(formData.priority) || 10,
        isActive: formData.isActive,
      };

      let res;
      if (editingZone) {
        res = await apiClient.put(`/v1/admin/zones/${editingZone._id}`, payload);
      } else {
        res = await apiClient.post('/v1/admin/zones', payload);
      }

      const resData = res.data;
      const successMsg = resData.message || (editingZone ? 'Delivery zone updated successfully.' : 'Delivery zone created successfully.');
      showNotification(successMsg, 'success');
      window.dispatchEvent(new CustomEvent('khushboo:settings_updated'));
      
      // Close modal on successful update or create
      setIsCreateOpen(false);
      setEditingZone(null);
      setModalError('');
      fetchZones();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Error saving delivery zone.';
      setModalError(msg);
      showNotification(msg, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle Zone Pause (with mandatory reason)
  const handleConfirmPause = async () => {
    if (!pauseTargetZone) return;
    const willPause = !pauseTargetZone.isPaused;

    if (willPause && !pauseReasonInput.trim()) {
      showNotification('Please provide a reason to inform customers why this zone is suspended.', 'error');
      return;
    }

    setActionLoading(true);
    try {
      const res = await apiClient.patch(`/v1/admin/zones/${pauseTargetZone._id}/pause`, {
        isPaused: willPause,
        pauseReason: willPause ? pauseReasonInput.trim() : '',
      });

      showNotification(res.data.message, 'success');
      window.dispatchEvent(new CustomEvent('khushboo:settings_updated'));
      setPauseTargetZone(null);
      setPauseReasonInput('');
      fetchZones();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to update pause state.';
      showNotification(msg, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle Active/Inactive
  const handleToggleActive = async (zone) => {
    try {
      const res = await apiClient.patch(`/v1/admin/zones/${zone._id}/status`, {
        isActive: !zone.isActive,
      });
      if (res.data?.success) {
        showNotification(res.data.message, 'success');
        window.dispatchEvent(new CustomEvent('khushboo:settings_updated'));
        fetchZones();
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Network error while toggling zone status.';
      showNotification(msg, 'error');
    }
  };

  // Delete Zone
  const handleConfirmDelete = async () => {
    if (!deleteTargetZone) return;
    setActionLoading(true);
    try {
      const res = await apiClient.delete(`/v1/admin/zones/${deleteTargetZone._id}`);
      showNotification(res.data.message, 'success');
      window.dispatchEvent(new CustomEvent('khushboo:settings_updated'));
      setDeleteTargetZone(null);
      fetchZones();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to delete zone.';
      showNotification(msg, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const totalZones = zones.length;
  const activeZones = zones.filter((z) => z.isActive && !z.isPaused).length;
  const pausedZones = zones.filter((z) => z.isPaused).length;

  return (
    <div className="space-y-6">
      {/* Global Toast Notification - High z-index so it's always visible above modals */}
      {notification && (
        <div
          className={`fixed top-5 right-5 z-[100] max-w-md p-4 rounded-2xl border text-xs font-semibold flex items-center justify-between shadow-2xl animate-fadeIn ${
            notification.type === 'error'
              ? 'bg-red-50 border-red-300 text-status-error'
              : 'bg-emerald-50 border-emerald-300 text-status-success'
          }`}
        >
          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            {notification.type === 'error' ? (
              <AlertCircle className="w-5 h-5 shrink-0 text-status-error" />
            ) : (
              <CheckCircle2 className="w-5 h-5 shrink-0 text-status-success" />
            )}
            <span className="leading-relaxed">{notification.msg}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="ml-3 p-1 rounded-lg hover:bg-black/5 transition text-text-muted hover:text-text-main"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold font-heading text-text-main">Delivery Zone Management</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-brand-light text-brand">
              Indore Hub
            </span>
          </div>
          <p className="text-xs text-text-muted mt-1">
            Configure dynamic delivery zones, radius boundaries, distance pricing tiers, and emergency suspensions.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={fetchZones}
            className="p-2.5 bg-surface hover:bg-surface-subtle border border-border-neutral rounded-xl text-text-muted hover:text-brand transition shadow-xs"
            title="Refresh Zones"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="px-4 py-2.5 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Create Zone</span>
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-surface border border-border-neutral rounded-2xl shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted block">Total Configured Zones</span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-2xl font-bold font-heading text-text-main">{totalZones}</span>
            <div className="w-8 h-8 rounded-lg bg-surface-subtle text-brand flex items-center justify-center">
              <Compass className="w-4 h-4" />
            </div>
          </div>
          <span className="text-[10px] text-text-muted block mt-1">Managed via dynamic database rules</span>
        </div>

        <div className="p-4 bg-surface border border-border-neutral rounded-2xl shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-status-success block">Active & Serviceable</span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-2xl font-bold font-heading text-status-success">{activeZones}</span>
            <div className="w-8 h-8 rounded-lg bg-status-success/10 text-status-success flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <span className="text-[10px] text-text-muted block mt-1">Accepting online grocery checkouts</span>
        </div>

        <div className="p-4 bg-surface border border-border-neutral rounded-2xl shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-status-warning block">Temporarily Suspended</span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-2xl font-bold font-heading text-status-warning">{pausedZones}</span>
            <div className="w-8 h-8 rounded-lg bg-status-warning/10 text-status-warning flex items-center justify-center">
              <PauseCircle className="w-4 h-4" />
            </div>
          </div>
          <span className="text-[10px] text-text-muted block mt-1">Orders safely blocked with custom reason</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-surface border border-border-neutral rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'ALL', label: 'All Zones' },
            { id: 'ACTIVE', label: 'Active' },
            { id: 'PAUSED', label: 'Paused' },
            { id: 'INACTIVE', label: 'Inactive' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                statusFilter === tab.id
                  ? 'bg-brand text-white shadow-xs'
                  : 'bg-surface hover:bg-surface-subtle text-text-muted hover:text-text-main border border-border-neutral'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by zone name, code, or PIN..."
            className="w-full pl-9 pr-3 py-2 bg-primary-bg border border-border-neutral rounded-xl text-xs text-text-main placeholder:text-text-muted focus:outline-none focus:border-brand"
          />
        </form>
      </div>

      {/* Zones Table */}
      <div className="bg-surface border border-border-neutral rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-xs">
            <thead className="bg-surface-subtle border-b border-border-neutral text-text-muted font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={
                      zones.length > 0 &&
                      bulk.getPageSelectionState(zones.map((z) => z._id)).isAllSelected
                    }
                    onChange={() => bulk.toggleSelectPage(zones.map((z) => z._id))}
                    className="rounded accent-brand"
                  />
                </th>
                <th className="py-3 px-4">Zone & Code</th>
                <th className="py-3 px-4">Coverage & PINs</th>
                <th className="py-3 px-4">Radius & Distance</th>
                <th className="py-3 px-4">Pricing Rules</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-neutral">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonTableRow key={i} columns={6} />
                ))
              ) : zones.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-text-muted">
                    <MapPin className="w-8 h-8 mx-auto text-text-muted/40 mb-2" />
                    <p className="font-bold text-text-main">No delivery zones found</p>
                    <p className="text-[11px] mt-0.5">Adjust your search or click "Create Zone" above.</p>
                  </td>
                </tr>
              ) : (
                zones.map((zone) => {
                  const isSelected = bulk.isSelected(zone._id);
                  let statusBadge = (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-status-success/10 text-status-success border border-status-success/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-status-success" />
                      Active
                    </span>
                  );

                  if (zone.isPaused) {
                    statusBadge = (
                      <span
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-status-warning/10 text-status-warning border border-status-warning/20 cursor-help"
                        title={zone.pauseReason || 'Temporarily paused'}
                      >
                        <PauseCircle className="w-3 h-3" />
                        Paused
                      </span>
                    );
                  } else if (!zone.isActive) {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-surface-subtle text-text-muted border border-border-neutral">
                        Inactive
                      </span>
                    );
                  }

                  return (
                    <tr
                      key={zone._id}
                      className={`transition ${isSelected ? 'bg-brand-light/30' : 'hover:bg-surface-subtle/50'}`}
                    >
                      <td className="py-3.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => bulk.toggleSelect(zone._id)}
                          className="rounded accent-brand"
                        />
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-text-main">{zone.name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="px-1.5 py-0.5 rounded-md font-mono text-[10px] font-bold bg-surface-subtle text-brand border border-border-neutral">
                            {zone.code}
                          </span>
                          <span className="text-[10px] text-text-muted">{zone.city}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {(zone.supportedPincodes || []).map((pin) => (
                            <span
                              key={pin}
                              className="px-1.5 py-0.5 bg-primary-bg border border-border-neutral text-[10px] font-mono rounded text-text-main"
                            >
                              {pin}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-text-main">Radius: {zone.radiusKm} km</div>
                        <div className="text-[11px] text-text-muted mt-0.5">
                          Max Distance: {zone.maxDeliveryDistanceKm} km
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="text-text-main font-semibold">
                          ₹{(zone.deliveryFeeBasePaise / 100).toFixed(0)} Base • Free &gt; ₹{(zone.freeDeliveryThresholdPaise / 100).toFixed(0)}
                        </div>
                        <div className="text-[11px] text-text-muted mt-0.5">
                          Min Order: ₹{(zone.minOrderAmountPaise / 100).toFixed(0)} • ETA: {zone.estimatedDeliveryWindow}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {statusBadge}
                        {zone.isPaused && zone.pauseReason && (
                          <span className="text-[10px] text-status-warning block mt-1 line-clamp-1 italic">
                            "{zone.pauseReason}"
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Pause / Resume Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setPauseTargetZone(zone);
                              setPauseReasonInput(zone.pauseReason || '');
                            }}
                            className={`p-1.5 rounded-lg border transition ${
                              zone.isPaused
                                ? 'bg-status-success/10 border-status-success/20 text-status-success hover:bg-status-success/20'
                                : 'bg-status-warning/10 border-status-warning/20 text-status-warning hover:bg-status-warning/20'
                            }`}
                            title={zone.isPaused ? 'Resume Zone' : 'Pause Zone'}
                          >
                            {zone.isPaused ? <PlayCircle className="w-4 h-4" /> : <PauseCircle className="w-4 h-4" />}
                          </button>

                          {/* Edit Zone */}
                          <button
                            type="button"
                            onClick={() => openEditModal(zone)}
                            className="p-1.5 rounded-lg bg-surface hover:bg-surface-subtle border border-border-neutral text-text-muted hover:text-brand transition"
                            title="Edit Zone"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Delete Zone */}
                          <button
                            type="button"
                            onClick={() => setDeleteTargetZone(zone)}
                            className="p-1.5 rounded-lg bg-surface hover:bg-status-error/10 border border-border-neutral text-text-muted hover:text-status-error transition"
                            title="Delete Zone"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="px-5 pb-3">
          <Pagination
            currentPage={page}
            totalPages={pagination.totalPages}
            totalRecords={pagination.totalRecords}
            pageSize={pageSize}
            onPageChange={(p) => setPage(p)}
            onPageSizeChange={(sz) => {
              setPageSize(sz);
              setPage(1);
            }}
            pageSizeOptions={[10, 20, 50]}
            loading={loading}
            itemName="delivery zones"
          />
        </div>
      </div>

      {/* CREATE / EDIT ZONE MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-text-main/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-surface rounded-2xl border border-border-neutral shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-border-neutral flex items-center justify-between bg-surface-subtle">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-brand/10 text-brand flex items-center justify-center">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold font-heading text-text-main">
                    {editingZone ? `Edit Zone: ${editingZone.name}` : 'Create Delivery Zone'}
                  </h3>
                  <p className="text-[11px] text-text-muted">
                    Configure service boundary, postal PIN codes, and distance pricing
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveZone} className="overflow-y-auto p-5 space-y-5">
              {/* Error banner inside modal */}
              {modalError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-status-error animate-fadeIn">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Overlap warnings banner */}
              {overlapWarnings.length > 0 && (
                <div className="p-3 bg-status-warning/10 border border-status-warning/30 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-2 text-status-warning text-xs font-bold">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Zone Overlap Notice:</span>
                  </div>
                  <ul className="text-[11px] text-status-warning/90 list-disc list-inside space-y-0.5">
                    {overlapWarnings.map((warn, i) => (
                      <li key={i}>{warn}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Interactive Map with Automatic Geocoding & Search */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-text-muted block">
                      Geographic Center & Coverage Radius
                    </label>
                    <span className="text-[10px] text-text-muted">
                      Search an area or click/drag the map marker. Address fields will populate automatically.
                    </span>
                  </div>
                  <span className="text-xs font-bold text-brand bg-brand-light/50 px-2 py-0.5 rounded-md">
                    {formData.radiusKm} km radius
                  </span>
                </div>

                <ZoneRadiusMap
                  center={{ lat: formData.centerLat, lng: formData.centerLng }}
                  radiusKm={formData.radiusKm}
                  onLocationResolved={handleLocationResolved}
                  onResolvingStateChange={setIsResolvingLocation}
                  height="260px"
                  showSearchBar={true}
                />

                <div className="flex items-center gap-3 pt-1">
                  <span className="text-xs text-text-muted whitespace-nowrap">Adjust Radius:</span>
                  <input
                    type="range"
                    min="1"
                    max="25"
                    step="0.5"
                    value={formData.radiusKm}
                    onChange={(e) => setFormData({ ...formData, radiusKm: parseFloat(e.target.value) })}
                    className="flex-1 accent-brand"
                  />
                  <div className="text-[11px] font-mono text-text-muted whitespace-nowrap bg-surface-subtle px-2 py-1 rounded-md border border-border-neutral">
                    Lat: {formData.centerLat.toFixed(4)}, Lng: {formData.centerLng.toFixed(4)}
                  </div>
                </div>
              </div>

              {/* Automatic Location Details from Map (Synchronized Card) */}
              <div className="p-3.5 bg-brand-light/20 border border-brand/20 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-brand font-bold">
                    <Compass className="w-4 h-4" />
                    <span>Automatic Location Details from Map</span>
                  </div>
                  {resolvedLocation && (
                    <span className="text-[10px] bg-white text-brand px-2 py-0.5 rounded-full border border-brand/20 font-medium">
                      Resolved via OpenStreetMap
                    </span>
                  )}
                </div>

                {resolvedLocation ? (
                  <div className="space-y-1.5 text-[11px] text-text-main">
                    <p className="line-clamp-2">
                      <span className="font-semibold text-text-muted">Formatted Address: </span>
                      {resolvedLocation.formattedAddress}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-brand/10">
                      <div>
                        <span className="text-[10px] text-text-muted block">Locality</span>
                        <span className="font-semibold">{resolvedLocation.locality || resolvedLocation.sublocality || '—'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-text-muted block">City / District</span>
                        <span className="font-semibold">{resolvedLocation.city || resolvedLocation.district || 'Indore'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-text-muted block">State</span>
                        <span className="font-semibold">{resolvedLocation.state || 'Madhya Pradesh'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-text-muted block">PIN Code</span>
                        <span className="font-semibold font-mono">{resolvedLocation.pincode || '—'}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-text-muted italic">
                    Click anywhere on the map or search an address above to auto-populate locality, city, district, state, and PIN code.
                  </p>
                )}
              </div>

              {/* Basic Zone Name & Code */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1">
                    Zone Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Vijay Nagar & Palasia"
                    className="w-full px-3 py-2 bg-primary-bg border border-border-neutral rounded-xl text-xs text-text-main focus:outline-none focus:border-brand"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1">
                    Zone Code (Unique Uppercase) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. IND-VIJAYNAGAR"
                    className="w-full px-3 py-2 bg-primary-bg border border-border-neutral rounded-xl text-xs font-mono font-bold text-text-main uppercase focus:outline-none focus:border-brand"
                  />
                </div>
              </div>

              {/* City and State with Manual Edit distinction & Map Sync buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-text-muted">
                      City *
                    </label>
                    {manuallyEdited.city && resolvedLocation?.city && (
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({ ...formData, city: resolvedLocation.city });
                          setManuallyEdited((m) => ({ ...m, city: false }));
                        }}
                        className="text-[10px] text-brand hover:underline font-semibold flex items-center gap-1"
                      >
                        <RefreshCw className="w-2.5 h-2.5" />
                        <span>Sync: {resolvedLocation.city}</span>
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    value={formData.city}
                    onChange={(e) => {
                      setManuallyEdited((m) => ({ ...m, city: true }));
                      setFormData({ ...formData, city: e.target.value });
                    }}
                    placeholder="e.g. Indore"
                    className="w-full px-3 py-2 bg-primary-bg border border-border-neutral rounded-xl text-xs text-text-main focus:outline-none focus:border-brand"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-text-muted">
                      State *
                    </label>
                    {manuallyEdited.state && resolvedLocation?.state && (
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({ ...formData, state: resolvedLocation.state });
                          setManuallyEdited((m) => ({ ...m, state: false }));
                        }}
                        className="text-[10px] text-brand hover:underline font-semibold flex items-center gap-1"
                      >
                        <RefreshCw className="w-2.5 h-2.5" />
                        <span>Sync: {resolvedLocation.state}</span>
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    value={formData.state}
                    onChange={(e) => {
                      setManuallyEdited((m) => ({ ...m, state: true }));
                      setFormData({ ...formData, state: e.target.value });
                    }}
                    placeholder="e.g. Madhya Pradesh"
                    className="w-full px-3 py-2 bg-primary-bg border border-border-neutral rounded-xl text-xs text-text-main focus:outline-none focus:border-brand"
                  />
                </div>
              </div>

              {/* Supported PIN codes */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-text-muted">
                    Supported Indian PIN Codes (Comma-separated) *
                  </label>
                  {manuallyEdited.supportedPincodes && resolvedLocation?.pincode && (
                    <button
                      type="button"
                      onClick={() => {
                        const currentPins = formData.supportedPincodes ? formData.supportedPincodes.split(',').map((p) => p.trim()) : [];
                        if (!currentPins.includes(resolvedLocation.pincode)) {
                          currentPins.push(resolvedLocation.pincode);
                        }
                        setFormData({ ...formData, supportedPincodes: currentPins.join(', ') });
                      }}
                      className="text-[10px] text-brand hover:underline font-semibold flex items-center gap-1"
                    >
                      <Plus className="w-2.5 h-2.5" />
                      <span>Append Map PIN: {resolvedLocation.pincode}</span>
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  required
                  value={formData.supportedPincodes}
                  onChange={(e) => {
                    setManuallyEdited((m) => ({ ...m, supportedPincodes: true }));
                    setFormData({ ...formData, supportedPincodes: e.target.value });
                  }}
                  placeholder="e.g. 452008, 452009, 452010, 452011"
                  className="w-full px-3 py-2 bg-primary-bg border border-border-neutral rounded-xl text-xs font-mono text-text-main focus:outline-none focus:border-brand"
                />
                <span className="text-[10px] text-text-muted mt-0.5 block">
                  Customers entering these postal PIN codes will be mapped to this zone.
                </span>
              </div>

              {/* Pricing & Threshold Rules */}
              <div className="p-4 bg-surface-subtle border border-border-neutral rounded-xl space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-brand block">
                  Zone Pricing & Financial Rules
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-text-muted mb-1">Base Fee (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.baseFeeRupees}
                      onChange={(e) => setFormData({ ...formData, baseFeeRupees: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-surface border border-border-neutral rounded-lg text-xs font-semibold focus:outline-none focus:border-brand"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-text-muted mb-1">Free Above (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.freeDeliveryRupees}
                      onChange={(e) => setFormData({ ...formData, freeDeliveryRupees: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-surface border border-border-neutral rounded-lg text-xs font-semibold focus:outline-none focus:border-brand"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-text-muted mb-1">Min Order (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.minOrderRupees}
                      onChange={(e) => setFormData({ ...formData, minOrderRupees: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-surface border border-border-neutral rounded-lg text-xs font-semibold focus:outline-none focus:border-brand"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-text-muted mb-1">Tier / Extra km (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.distanceTierRupees}
                      onChange={(e) => setFormData({ ...formData, distanceTierRupees: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-surface border border-border-neutral rounded-lg text-xs font-semibold focus:outline-none focus:border-brand"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-[10px] font-bold text-text-muted mb-1">Max Delivery Distance (km)</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.maxDistanceKm}
                      onChange={(e) => setFormData({ ...formData, maxDistanceKm: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-surface border border-border-neutral rounded-lg text-xs font-semibold focus:outline-none focus:border-brand"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-text-muted mb-1">Estimated Delivery Window</label>
                    <input
                      type="text"
                      value={formData.estimatedDeliveryWindow}
                      onChange={(e) => setFormData({ ...formData, estimatedDeliveryWindow: e.target.value })}
                      placeholder="e.g. 60 - 90 Minutes"
                      className="w-full px-2.5 py-1.5 bg-surface border border-border-neutral rounded-lg text-xs font-semibold focus:outline-none focus:border-brand"
                    />
                  </div>
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 border border-border-neutral text-xs font-semibold text-text-muted hover:text-text-main rounded-xl hover:bg-surface-subtle transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || isResolvingLocation}
                  className="px-5 py-2 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                >
                  {actionLoading || isResolvingLocation ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {actionLoading
                      ? 'Saving Zone...'
                      : isResolvingLocation
                      ? 'Resolving Location...'
                      : editingZone
                      ? 'Update Zone'
                      : 'Create Delivery Zone'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PAUSE ZONE MODAL */}
      {pauseTargetZone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-text-main/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-surface rounded-2xl border border-border-neutral shadow-2xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-status-warning/10 text-status-warning flex items-center justify-center shrink-0">
                <PauseCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold font-heading text-text-main">
                  {pauseTargetZone.isPaused ? `Resume Delivery in ${pauseTargetZone.name}` : `Pause Delivery in ${pauseTargetZone.name}`}
                </h3>
                <p className="text-[11px] text-text-muted">
                  {pauseTargetZone.isPaused
                    ? 'Orders will immediately be accepted again for this zone.'
                    : 'Prevent new orders from being placed in this delivery zone.'}
                </p>
              </div>
            </div>

            {!pauseTargetZone.isPaused && (
              <div>
                <label className="block text-[11px] font-bold text-text-main mb-1">
                  Suspension Reason (Customer-Facing) *
                </label>
                <textarea
                  rows={3}
                  required
                  value={pauseReasonInput}
                  onChange={(e) => setPauseReasonInput(e.target.value)}
                  placeholder="e.g. Heavy waterlogging near bypass / Temporary vehicle breakdown. Resuming shortly."
                  className="w-full px-3 py-2 bg-primary-bg border border-border-neutral rounded-xl text-xs text-text-main focus:outline-none focus:border-brand"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setPauseTargetZone(null)}
                className="px-4 py-2 border border-border-neutral text-xs font-semibold text-text-muted hover:text-text-main rounded-xl hover:bg-surface-subtle transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleConfirmPause}
                className="px-4 py-2 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-xl transition shadow-xs disabled:opacity-50"
              >
                {pauseTargetZone.isPaused ? 'Resume Zone' : 'Pause Zone Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTargetZone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-text-main/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-surface rounded-2xl border border-border-neutral shadow-2xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-status-error/10 text-status-error flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold font-heading text-text-main">
                  Delete Zone: {deleteTargetZone.name}?
                </h3>
                <p className="text-[11px] text-text-muted">
                  Code: {deleteTargetZone.code} • {deleteTargetZone.city}
                </p>
              </div>
            </div>

            <div className="p-3 bg-surface-subtle border border-border-neutral rounded-xl text-xs text-text-muted space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-text-main">
                <Info className="w-3.5 h-3.5 text-brand" />
                <span>Safeguard Policy:</span>
              </div>
              <p>
                If customer addresses or past order history reference this zone ({deleteTargetZone.referencedOrderCount || 0} orders),
                the system will perform a safe <strong>soft-deactivation</strong> to keep accounting and tax audit records intact.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTargetZone(null)}
                className="px-4 py-2 border border-border-neutral text-xs font-semibold text-text-muted hover:text-text-main rounded-xl hover:bg-surface-subtle transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-status-error hover:bg-status-error/90 text-white text-xs font-bold rounded-xl transition shadow-xs disabled:opacity-50"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating / Docked Bulk Action Bar */}
      <BulkActionBar
        selectedCount={bulk.selectedCount}
        totalMatching={pagination.totalRecords}
        currentPageCount={zones.length}
        selectAllMatching={bulk.selectAllMatching}
        onSelectAllMatching={bulk.handleSelectAllMatching}
        onClearSelection={bulk.clearSelection}
        itemName="delivery zones"
        actions={[
          {
            id: 'activate',
            label: 'Activate',
            icon: PlayCircle,
            variant: 'primary',
            onClick: () => handleTriggerBulkZoneStatus('ACTIVATE'),
          },
          {
            id: 'pause',
            label: 'Pause Delivery',
            icon: PauseCircle,
            variant: 'warning',
            onClick: () => handleTriggerBulkZoneStatus('PAUSE'),
          },
          {
            id: 'delete',
            label: 'Delete / Archive',
            icon: Trash2,
            variant: 'danger',
            onClick: handleTriggerBulkZoneDelete,
          },
        ]}
      />

      {/* Bulk Confirm Modal */}
      {bulkConfig && (
        <BulkConfirmModal
          isOpen={Boolean(bulkConfig)}
          onClose={() => {
            setBulkConfig(null);
            setBulkResultSummary(null);
          }}
          onConfirm={(reason) => bulkConfig.onConfirm(reason)}
          title={bulkConfig.title}
          description={bulkConfig.description}
          affectedCount={bulkConfig.affectedCount}
          itemName={bulkConfig.itemName}
          confirmLabel={bulkConfig.confirmLabel}
          confirmVariant={bulkConfig.confirmVariant}
          requireReason={bulkConfig.requireReason}
          reasonPlaceholder={bulkConfig.reasonPlaceholder}
          reversibilityNotice={bulkConfig.reversibilityNotice}
          loading={bulkLoading}
          resultSummary={bulkResultSummary}
          onDone={() => {
            setBulkConfig(null);
            setBulkResultSummary(null);
            fetchZones();
          }}
        />
      )}
    </div>
  );
}
