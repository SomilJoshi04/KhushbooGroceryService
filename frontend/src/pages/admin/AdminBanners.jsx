/**
 * Promotional Banners Management Page — Admin Portal.
 *
 * Route: /admin/banners
 * Full enterprise promotional campaign manager:
 * - Searchable, filterable, and paginated banners table with status badges.
 * - Create, Edit, Duplicate, Reorder, Activate/Deactivate, and Delete.
 * - Start & End date scheduling with automatic expiry and future publication flags.
 * - Direct image upload via secure backend upload endpoint.
 * - Live storefront desktop & mobile modal preview.
 * - Pinned header/footer modal with scrollable form body.
 *
 * @module pages/admin/AdminBanners
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Image as ImageIcon,
  Plus,
  Search,
  Filter,
  Calendar,
  Clock,
  Eye,
  Edit2,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Smartphone,
  Monitor,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { apiClient } from '../../config/api.js';
import { ImageUpload } from '../../components/common/ImageUpload.jsx';
import { Pagination } from '../../components/Pagination.jsx';
import { useBulkSelection } from '../../hooks/useBulkSelection.js';
import { BulkActionBar } from '../../components/BulkActionBar.jsx';
import { BulkConfirmModal } from '../../components/BulkConfirmModal.jsx';
import { SkeletonTable } from '../../components/skeleton/index.js';
import { swrCache } from '../../utils/swrCache.js';

export function AdminBanners() {
  const [banners, setBanners] = useState([]);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'scheduled' | 'expired' | 'inactive'
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1, stats: { totalActive: 0, totalScheduled: 0, totalExpired: 0 } });

  // Modal States
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewBanner, setPreviewBanner] = useState(null);
  const [previewDevice, setPreviewDevice] = useState('desktop'); // 'desktop' | 'mobile'
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [bannerToDelete, setBannerToDelete] = useState(null);

  // Form State
  const initialFormState = {
    name: '',
    title: '',
    subtitle: '',
    badge: 'Special Offer',
    desktopImage: '',
    mobileImage: '',
    buttonText: 'Shop Now',
    buttonLink: '/categories',
    targetType: 'CATEGORY',
    targetId: '',
    priority: 0,
    isActive: true,
    startDate: '',
    endDate: '',
  };

  const [formData, setFormData] = useState(initialFormState);
  const [formError, setFormError] = useState('');
  const formBodyRef = useRef(null);

  // Bulk Selection hook & modals
  const bulk = useBulkSelection(meta.total || 0);
  const [bulkConfig, setBulkConfig] = useState(null);
  const [bulkResultSummary, setBulkResultSummary] = useState(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Fetch Banners from API
  const fetchBanners = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        page,
        limit: pageSize,
        status: statusFilter,
      };
      if (search.trim()) params.search = search.trim();

      const res = await apiClient.get('/v1/admin/banners', { params });
      if (res.data?.success) {
        setBanners(res.data.data || []);
        if (res.data.pagination) {
          setMeta({
            ...res.data.pagination,
            total: res.data.pagination.totalRecords,
            stats: res.data.meta?.stats || {},
          });
        } else {
          setMeta(res.data.meta || { total: 0, totalPages: 1, stats: {} });
        }
        bulk.clearSelection();
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load promotional banners.');
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerBulkBannerStatus = (isActive) => {
    setBulkConfig({
      title: isActive ? 'Bulk Activate Banners' : 'Bulk Deactivate Banners',
      description: `You are about to ${isActive ? 'activate' : 'deactivate'} ${bulk.selectedCount} promotional banner(s).`,
      affectedCount: bulk.selectedCount,
      itemName: 'banners',
      confirmLabel: `${isActive ? 'Activate' : 'Deactivate'} Selected`,
      confirmVariant: isActive ? 'primary' : 'warning',
      requireReason: false,
      reversibilityNotice: isActive
        ? 'Active banners will appear on the storefront carousel during their scheduled campaign dates.'
        : 'Deactivated banners are immediately removed from customer view.',
      onConfirm: async () => {
        setBulkLoading(true);
        try {
          const res = await apiClient.post('/v1/admin/banners/bulk-status', {
            ids: bulk.selectedIds,
            selectAllMatching: bulk.selectAllMatching,
            filter: { status: statusFilter },
            isActive,
          });
          setBulkResultSummary(res.data);
        } catch (err) {
          setError(err.response?.data?.message || 'Bulk banner status update failed.');
          setBulkConfig(null);
        } finally {
          setBulkLoading(false);
        }
      },
    });
  };

  const handleTriggerBulkBannerDelete = () => {
    setBulkConfig({
      title: 'Bulk Delete Banners',
      description: `Are you sure you want to permanently delete ${bulk.selectedCount} promotional banner(s)?`,
      affectedCount: bulk.selectedCount,
      itemName: 'banners',
      confirmLabel: 'Delete Banners',
      confirmVariant: 'danger',
      requireReason: false,
      reversibilityNotice: 'This action permanently removes the banner campaigns and configuration.',
      onConfirm: async () => {
        setBulkLoading(true);
        try {
          const res = await apiClient.post('/v1/admin/banners/bulk-delete', {
            ids: bulk.selectedIds,
            selectAllMatching: bulk.selectAllMatching,
            filter: { status: statusFilter },
          });
          setBulkResultSummary(res.data);
        } catch (err) {
          setError(err.response?.data?.message || 'Bulk banner deletion failed.');
          setBulkConfig(null);
        } finally {
          setBulkLoading(false);
        }
      },
    });
  };

  // Fetch categories and products for destination selection
  useEffect(() => {
    async function fetchCatalogs() {
      try {
        const [catRes, prodRes] = await Promise.all([
          apiClient.get('/v1/categories'),
          apiClient.get('/v1/products', { params: { limit: 50 } }),
        ]);
        if (catRes.data?.success) setCategories(catRes.data.data || []);
        if (prodRes.data?.success) setProducts(prodRes.data.data || []);
      } catch (err) {
        console.warn('[banners] Could not fetch categories/products for selector:', err.message);
      }
    }
    fetchCatalogs();
  }, []);

  useEffect(() => {
    fetchBanners();
  }, [page, pageSize, statusFilter]);

  // Handle Search submit / debounce
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchBanners();
  };

  // Notification helper
  const notifySuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3500);
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingBanner(null);
    setFormData(initialFormState);
    setFormError('');
    setModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (banner) => {
    setEditingBanner(banner);
    setFormData({
      name: banner.name || '',
      title: banner.title || '',
      subtitle: banner.subtitle || '',
      badge: banner.badge || '',
      desktopImage: banner.desktopImage || '',
      mobileImage: banner.mobileImage || '',
      buttonText: banner.buttonText || 'Shop Now',
      buttonLink: banner.buttonLink || '/categories',
      targetType: banner.targetType || 'CATEGORY',
      targetId: banner.targetId || '',
      priority: banner.priority ?? 0,
      isActive: banner.isActive ?? true,
      startDate: banner.startDate ? new Date(banner.startDate).toISOString().slice(0, 16) : '',
      endDate: banner.endDate ? new Date(banner.endDate).toISOString().slice(0, 16) : '',
    });
    setFormError('');
    setModalOpen(true);
  };

  // Open Live Storefront Preview Modal
  const handleOpenPreview = (banner) => {
    setPreviewBanner(banner);
    setPreviewDevice('desktop');
    setPreviewModalOpen(true);
  };

  // Handle Quick Status Toggle
  const handleToggleStatus = async (banner) => {
    try {
      const res = await apiClient.patch(`/v1/admin/banners/${banner._id}/status`, {
        isActive: !banner.isActive,
      });
      if (res.data?.success) {
        notifySuccess(`Banner ${!banner.isActive ? 'activated' : 'deactivated'} successfully.`);
        fetchBanners();
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to update banner status.');
    }
  };

  // Handle Quick Priority Adjustment
  const handleAdjustPriority = async (banner, delta) => {
    const newPriority = Math.max(0, (banner.priority || 0) + delta);
    try {
      await apiClient.put(`/v1/admin/banners/${banner._id}`, { priority: newPriority });
      notifySuccess(`Updated priority to ${newPriority}.`);
      fetchBanners();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to adjust priority.');
    }
  };

  // Handle Duplicate Banner
  const handleDuplicate = async (banner) => {
    try {
      const res = await apiClient.post(`/v1/admin/banners/${banner._id}/duplicate`);
      if (res.data?.success) {
        notifySuccess('Banner duplicated as draft successfully.');
        fetchBanners();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to duplicate banner.');
    }
  };

  // Handle Delete Confirmation & Action
  const handleDeleteConfirm = async () => {
    if (!bannerToDelete) return;
    setActionLoading(true);
    try {
      const res = await apiClient.delete(`/v1/admin/banners/${bannerToDelete._id}`);
      if (res.data?.success) {
        notifySuccess('Promotional banner deleted successfully.');
        setDeleteConfirmOpen(false);
        setBannerToDelete(null);
        fetchBanners();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete promotional banner.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Destination Helper
  const handleDestinationTypeChange = (type) => {
    setFormData((prev) => {
      let defaultLink = '/categories';
      if (type === 'CATEGORY' && categories.length > 0) {
        defaultLink = `/categories/${categories[0].slug}`;
      } else if (type === 'PRODUCT' && products.length > 0) {
        defaultLink = `/products/${products[0].slug}`;
      }
      return {
        ...prev,
        targetType: type,
        buttonLink: defaultLink,
      };
    });
  };

  // Form Submit handler
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.name.trim()) {
      setFormError('Internal banner name is required.');
      return;
    }
    if (!formData.title.trim()) {
      setFormError('Customer-facing heading is required.');
      return;
    }
    if (!formData.subtitle.trim()) {
      setFormError('Supporting description is required.');
      return;
    }
    if (!formData.desktopImage) {
      setFormError('Desktop banner image is required.');
      return;
    }
    if (formData.startDate && formData.endDate) {
      if (new Date(formData.endDate) <= new Date(formData.startDate)) {
        setFormError('End date and time must be strictly after the start date and time.');
        return;
      }
    }

    setActionLoading(true);
    try {
      const payload = {
        name: formData.name.trim(),
        title: formData.title.trim(),
        subtitle: formData.subtitle.trim(),
        badge: formData.badge.trim() || 'Special Offer',
        desktopImage: formData.desktopImage.trim(),
        mobileImage: formData.mobileImage.trim() || undefined,
        buttonText: formData.buttonText.trim() || 'Shop Now',
        buttonLink: formData.buttonLink.trim() || '/categories',
        targetType: formData.targetType,
        targetId: formData.targetId.trim(),
        priority: Number(formData.priority) || 0,
        isActive: formData.isActive,
        startDate: formData.startDate ? new Date(formData.startDate).toISOString() : null,
        endDate: formData.endDate ? new Date(formData.endDate).toISOString() : null,
      };

      if (editingBanner) {
        await apiClient.put(`/v1/admin/banners/${editingBanner._id}`, payload);
        notifySuccess('Promotional banner updated successfully.');
      } else {
        await apiClient.post('/v1/admin/banners', payload);
        notifySuccess('Promotional banner created and published successfully.');
      }

      swrCache.invalidate('banners');

      setModalOpen(false);
      setEditingBanner(null);
      fetchBanners();
    } catch (err) {
      let errMsg = err.response?.data?.message || err.message || 'Failed to save promotional banner.';
      if (Array.isArray(err.response?.data?.details) && err.response.data.details.length > 0) {
        const detailMsg = err.response.data.details
          .map((d) => (d.message ? `${d.message}` : `${d.field}`))
          .join('; ');
        errMsg = `${errMsg} — ${detailMsg}`;
      }
      setFormError(errMsg);
      formBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setActionLoading(false);
    }
  };

  // Helper for Status Badge Pill
  const renderStatusBadge = (banner) => {
    switch (banner.computedStatus) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-status-success/10 text-status-success border border-status-success/20">
            <span className="w-1.5 h-1.5 rounded-full bg-status-success animate-pulse" />
            Live & Active
          </span>
        );
      case 'SCHEDULED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-700 border border-amber-500/20">
            <Clock className="w-3 h-3" />
            Scheduled
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-surface-subtle text-text-muted border border-border-neutral">
            Expired
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-600 border border-gray-300">
            Inactive / Draft
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-text-main flex items-center gap-2">
            <span>Promotional Banners</span>
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Create and schedule high-impact storefront banners, promotional badges, and destination links.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreateModal}
          className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-bold transition shadow-xs active:scale-98 shrink-0 focus:outline-none focus:ring-2 focus:ring-brand"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Banner</span>
        </button>
      </div>

      {/* Global Alerts */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-status-success/10 border border-status-success/20 text-status-success text-xs font-semibold flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {error && (
        <div className="p-4 rounded-xl bg-status-error/10 border border-status-error/20 text-status-error text-xs font-semibold flex items-center justify-between gap-2 animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError('')} className="p-1 hover:bg-status-error/10 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface p-4 rounded-xl border border-border-neutral shadow-xs">
          <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider block">Total Banners</span>
          <span className="text-2xl font-black font-mono text-text-main mt-1 block">{meta.total}</span>
        </div>
        <div className="bg-surface p-4 rounded-xl border border-border-neutral shadow-xs">
          <span className="text-[11px] font-bold text-status-success uppercase tracking-wider block">Active & Live</span>
          <span className="text-2xl font-black font-mono text-status-success mt-1 block">{meta.stats?.totalActive || 0}</span>
        </div>
        <div className="bg-surface p-4 rounded-xl border border-border-neutral shadow-xs">
          <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider block">Scheduled</span>
          <span className="text-2xl font-black font-mono text-amber-600 mt-1 block">{meta.stats?.totalScheduled || 0}</span>
        </div>
        <div className="bg-surface p-4 rounded-xl border border-border-neutral shadow-xs">
          <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider block">Expired</span>
          <span className="text-2xl font-black font-mono text-text-muted mt-1 block">{meta.stats?.totalExpired || 0}</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface p-4 rounded-xl border border-border-neutral shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-3 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, heading, or badge..."
            className="w-full bg-surface-subtle border border-border-neutral rounded-xl pl-10 pr-4 py-2 text-xs text-text-main placeholder:text-text-muted focus:outline-none focus:border-brand shadow-xs"
          />
        </form>

        {/* Status Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'All' },
            { id: 'active', label: 'Live' },
            { id: 'scheduled', label: 'Scheduled' },
            { id: 'expired', label: 'Expired' },
            { id: 'inactive', label: 'Drafts' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setStatusFilter(tab.id);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 ${
                statusFilter === tab.id
                  ? 'bg-brand text-white shadow-xs'
                  : 'bg-surface hover:bg-surface-subtle text-text-muted hover:text-text-main border border-border-neutral'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Banners Table */}
      <div className="bg-surface border border-border-neutral rounded-2xl overflow-hidden shadow-xs">
        {loading ? (
          <SkeletonTable rows={5} columns={6} showToolbar={false} showPagination={true} />
        ) : banners.length === 0 ? (
          <div className="p-12 text-center text-text-muted text-xs space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-surface-subtle border border-border-neutral flex items-center justify-center mx-auto text-brand">
              <ImageIcon className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-text-main">No promotional banners found</h3>
              <p className="text-xs text-text-muted mt-1 max-w-sm mx-auto">
                {search || statusFilter !== 'all'
                  ? 'No banners match your active filters. Try resetting the search or filter.'
                  : 'Create your first promotional banner to showcase fresh harvest, festive sales, and daily grocery offers.'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand text-white text-xs font-bold shadow-xs hover:bg-brand-hover transition"
            >
              <Plus className="w-4 h-4" />
              <span>Create First Banner</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[750px] text-left text-xs border-collapse">
              <thead>
                <tr className="bg-surface-subtle border-b border-border-neutral text-text-muted font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={
                        banners.length > 0 &&
                        bulk.getPageSelectionState(banners.map((b) => b._id)).isAllSelected
                      }
                      onChange={() => bulk.toggleSelectPage(banners.map((b) => b._id))}
                      className="rounded accent-brand"
                    />
                  </th>
                  <th className="py-3 px-4">Banner Preview</th>
                  <th className="py-3 px-4">Campaign & Heading</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Schedule Window</th>
                  <th className="py-3 px-4 text-center">Priority</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-neutral">
                {banners.map((b) => {
                  const isSelected = bulk.isSelected(b._id);
                  return (
                    <tr
                      key={b._id}
                      className={`transition ${isSelected ? 'bg-brand-light/30' : 'hover:bg-surface-subtle/50'}`}
                    >
                      <td className="py-3.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => bulk.toggleSelect(b._id)}
                          className="rounded accent-brand"
                        />
                      </td>
                      {/* Thumbnail Preview */}
                      <td className="py-3.5 px-4 w-32 shrink-0">
                      <div
                        onClick={() => handleOpenPreview(b)}
                        className="w-28 h-16 rounded-xl border border-border-neutral overflow-hidden bg-surface-subtle relative group cursor-pointer shadow-xs"
                        title="Click to view full preview"
                      >
                        <img
                          src={b.desktopImage}
                          alt={b.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          onError={(e) => {
                            e.currentTarget.src =
                              'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=300&q=80';
                          }}
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white">
                          <Eye className="w-4 h-4" />
                        </div>
                      </div>
                    </td>

                    {/* Campaign & Heading */}
                    <td className="py-3.5 px-4 min-w-[200px]">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-text-main text-xs">{b.name}</span>
                          {b.badge && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-light text-brand font-bold border border-brand/20">
                              {b.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-text-muted line-clamp-1">{b.title}</p>
                        <span className="text-[10px] font-mono text-brand bg-brand-light/40 px-1.5 py-0.5 rounded border border-brand/20 inline-block">
                          CTA: {b.buttonText || 'Shop Now'} ➔ {b.buttonLink}
                        </span>
                      </div>
                    </td>

                    {/* Status Pill */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {renderStatusBadge(b)}
                    </td>

                    {/* Schedule Dates */}
                    <td className="py-3.5 px-4 text-text-muted text-[11px] whitespace-nowrap">
                      {b.startDate || b.endDate ? (
                        <div className="space-y-0.5">
                          {b.startDate && (
                            <div className="flex items-center gap-1">
                              <span className="text-text-muted font-medium">Starts:</span>
                              <span className="text-text-main font-mono">
                                {new Date(b.startDate).toLocaleDateString()} {new Date(b.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          )}
                          {b.endDate && (
                            <div className="flex items-center gap-1">
                              <span className="text-text-muted font-medium">Ends:</span>
                              <span className="text-text-main font-mono">
                                {new Date(b.endDate).toLocaleDateString()} {new Date(b.endDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-text-muted italic">Always Visible</span>
                      )}
                    </td>

                    {/* Priority & Reorder Controls */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-1 bg-surface-subtle px-2 py-1 rounded-lg border border-border-neutral shadow-xs">
                        <span className="font-mono font-bold text-text-main text-xs">{b.priority}</span>
                        <div className="flex flex-col">
                          <button
                            type="button"
                            onClick={() => handleAdjustPriority(b, 1)}
                            className="text-text-muted hover:text-brand transition"
                            title="Increase Priority"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAdjustPriority(b, -1)}
                            className="text-text-muted hover:text-brand transition"
                            title="Decrease Priority"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        {/* Toggle Active */}
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(b)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                            b.isActive
                              ? 'bg-status-success/10 text-status-success border-status-success/20 hover:bg-status-success/20'
                              : 'bg-surface text-text-muted border-border-neutral hover:bg-surface-subtle'
                          }`}
                          title={b.isActive ? 'Deactivate Banner' : 'Activate Banner'}
                        >
                          {b.isActive ? 'Active' : 'Draft'}
                        </button>

                        {/* Preview */}
                        <button
                          type="button"
                          onClick={() => handleOpenPreview(b)}
                          className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-subtle transition"
                          title="Storefront Preview"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Duplicate */}
                        <button
                          type="button"
                          onClick={() => handleDuplicate(b)}
                          className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-subtle transition"
                          title="Duplicate Campaign"
                        >
                          <Copy className="w-4 h-4" />
                        </button>

                        {/* Edit */}
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(b)}
                          className="p-1.5 rounded-lg text-brand hover:bg-brand-light/60 transition"
                          title="Edit Banner"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => {
                            setBannerToDelete(b);
                            setDeleteConfirmOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-status-error hover:bg-status-error/10 transition"
                          title="Delete Banner"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              </tbody>
            </table>
          </div>
        )}

        {/* Standard Pagination Footer */}
        <div className="px-5 pb-3">
          <Pagination
            currentPage={page}
            totalPages={meta.totalPages}
            totalRecords={meta.total}
            pageSize={pageSize}
            onPageChange={(p) => setPage(p)}
            onPageSizeChange={(sz) => {
              setPageSize(sz);
              setPage(1);
            }}
            pageSizeOptions={[5, 10, 20]}
            loading={loading}
            itemName="banners"
          />
        </div>
      </div>

      {/* ── CREATE / EDIT BANNER MODAL ─── */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <div
            className="relative w-full max-w-3xl max-h-[92dvh] bg-surface border border-border-neutral rounded-2xl text-text-main shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {/* Pinned Header */}
            <div className="shrink-0 px-6 py-4 border-b border-border-neutral flex items-center justify-between bg-surface z-10">
              <div>
                <h3 className="text-base sm:text-lg font-bold font-heading text-text-main">
                  {editingBanner ? 'Edit Promotional Banner' : 'Create Promotional Banner'}
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Configure storefront hero promotion, imagery, destination link, and schedules.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-2 rounded-xl text-text-muted hover:text-text-main hover:bg-surface-subtle transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleFormSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              {/* Scrollable Body */}
              <div
                ref={formBodyRef}
                className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-6 space-y-5 text-xs"
              >
                {formError && (
                  <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-status-error flex items-start gap-2.5 animate-fadeIn">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span className="leading-relaxed font-medium">{formError}</span>
                  </div>
                )}

                {/* Internal Name & Badge */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-text-main mb-1">
                      Internal Banner Name <span className="text-status-error">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                      required
                      placeholder="e.g. Diwali Sharbati Wheat Flour Campaign"
                      className="w-full px-3 py-2 bg-primary-bg border border-border-neutral rounded-xl text-text-main placeholder:text-text-muted focus:outline-none focus:border-brand shadow-xs"
                    />
                    <span className="text-[10px] text-text-muted mt-0.5 block">For admin tracking only</span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-text-main mb-1">
                      Promotional Badge
                    </label>
                    <input
                      type="text"
                      value={formData.badge}
                      onChange={(e) => setFormData((p) => ({ ...p, badge: e.target.value }))}
                      placeholder="e.g. Special Offer, Festive Sale, 100% Pure"
                      className="w-full px-3 py-2 bg-primary-bg border border-border-neutral rounded-xl text-text-main placeholder:text-text-muted focus:outline-none focus:border-brand shadow-xs"
                    />
                  </div>
                </div>

                {/* Customer Promotional Heading */}
                <div>
                  <label className="block text-[11px] font-semibold text-text-main mb-1">
                    Customer Promotional Heading <span className="text-status-error">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                    required
                    placeholder="e.g. 100% Pure & Fresh Sharbati Whole Wheat Flour"
                    className="w-full px-3 py-2 bg-primary-bg border border-border-neutral rounded-xl text-text-main placeholder:text-text-muted focus:outline-none focus:border-brand shadow-xs font-semibold"
                  />
                </div>

                {/* Subtitle / Description */}
                <div>
                  <label className="block text-[11px] font-semibold text-text-main mb-1">
                    Supporting Description <span className="text-status-error">*</span>
                  </label>
                  <textarea
                    rows={2}
                    value={formData.subtitle}
                    onChange={(e) => setFormData((p) => ({ ...p, subtitle: e.target.value }))}
                    required
                    placeholder="e.g. Stone-ground daily on traditional stone mills in Indore. Free doorstep delivery on orders above ₹499."
                    className="w-full px-3 py-2 bg-primary-bg border border-border-neutral rounded-xl text-text-main placeholder:text-text-muted focus:outline-none focus:border-brand shadow-xs"
                  />
                </div>

                {/* Desktop Primary Image Upload */}
                <div className="p-4 rounded-xl bg-surface-subtle border border-border-neutral space-y-2">
                  <span className="text-xs font-bold text-text-main block">
                    1. Desktop Banner Image <span className="text-status-error">*</span>
                  </span>
                  <ImageUpload
                    value={formData.desktopImage}
                    onChange={(url) => setFormData((p) => ({ ...p, desktopImage: url }))}
                    label="Desktop Banner Image"
                    hint="Recommended: 1200x600px or 16:9 ratio. Drag & drop or select file."
                    required={true}
                  />
                </div>

                {/* Mobile Optional Image Upload */}
                <div className="p-4 rounded-xl bg-surface-subtle border border-border-neutral space-y-2">
                  <span className="text-xs font-bold text-text-main block">
                    2. Mobile Banner Image (Optional)
                  </span>
                  <ImageUpload
                    value={formData.mobileImage}
                    onChange={(url) => setFormData((p) => ({ ...p, mobileImage: url }))}
                    label="Mobile Banner Image"
                    hint="Optional portrait or square image optimized for phone screens (e.g. 600x600px)."
                    required={false}
                  />
                </div>

                {/* Call-to-Action (Button Text & Link) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-text-main mb-1">
                      Button Text
                    </label>
                    <input
                      type="text"
                      value={formData.buttonText}
                      onChange={(e) => setFormData((p) => ({ ...p, buttonText: e.target.value }))}
                      placeholder="e.g. Shop Now, Explore Offers"
                      className="w-full px-3 py-2 bg-primary-bg border border-border-neutral rounded-xl text-text-main focus:outline-none focus:border-brand shadow-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-text-main mb-1">
                      Destination Target
                    </label>
                    <select
                      value={formData.targetType}
                      onChange={(e) => handleDestinationTypeChange(e.target.value)}
                      className="w-full px-3 py-2 bg-primary-bg border border-border-neutral rounded-xl text-text-main focus:outline-none focus:border-brand shadow-xs"
                    >
                      <option value="CATEGORY">Link to Specific Category</option>
                      <option value="PRODUCT">Link to Specific Product</option>
                      <option value="CUSTOM">Custom Internal Route</option>
                      <option value="NONE">No Action Link</option>
                    </select>
                  </div>
                </div>

                {/* Dynamic Destination Selector */}
                {formData.targetType === 'CATEGORY' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-text-main mb-1">
                      Select Target Category
                    </label>
                    <select
                      value={formData.buttonLink}
                      onChange={(e) => setFormData((p) => ({ ...p, buttonLink: e.target.value }))}
                      className="w-full px-3 py-2 bg-primary-bg border border-border-neutral rounded-xl text-text-main focus:outline-none focus:border-brand shadow-xs"
                    >
                      {categories.map((c) => (
                        <option key={c._id} value={`/categories/${c.slug}`}>
                          {c.name} (/categories/{c.slug})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {formData.targetType === 'PRODUCT' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-text-main mb-1">
                      Select Target Product
                    </label>
                    <select
                      value={formData.buttonLink}
                      onChange={(e) => setFormData((p) => ({ ...p, buttonLink: e.target.value }))}
                      className="w-full px-3 py-2 bg-primary-bg border border-border-neutral rounded-xl text-text-main focus:outline-none focus:border-brand shadow-xs"
                    >
                      {products.map((pr) => (
                        <option key={pr._id} value={`/products/${pr.slug}`}>
                          {pr.name} (/products/{pr.slug})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {formData.targetType === 'CUSTOM' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-text-main mb-1">
                      Custom Destination Route
                    </label>
                    <input
                      type="text"
                      value={formData.buttonLink}
                      onChange={(e) => setFormData((p) => ({ ...p, buttonLink: e.target.value }))}
                      placeholder="/categories or /cart"
                      className="w-full px-3 py-2 bg-primary-bg border border-border-neutral rounded-xl text-text-main focus:outline-none focus:border-brand shadow-xs font-mono"
                    />
                  </div>
                )}

                {/* Scheduling & Priority Section */}
                <div className="p-4 rounded-xl bg-surface-subtle border border-border-neutral space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-text-main">
                    <Calendar className="w-4 h-4 text-brand" />
                    <span>Publication Schedule & Display Priority</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-text-muted mb-1">
                        Start Date & Time (Optional)
                      </label>
                      <input
                        type="datetime-local"
                        value={formData.startDate}
                        onChange={(e) => setFormData((p) => ({ ...p, startDate: e.target.value }))}
                        className="w-full px-3 py-2 bg-surface border border-border-neutral rounded-xl text-text-main text-xs focus:outline-none focus:border-brand shadow-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-text-muted mb-1">
                        End Date & Time (Auto-expiry)
                      </label>
                      <input
                        type="datetime-local"
                        value={formData.endDate}
                        onChange={(e) => setFormData((p) => ({ ...p, endDate: e.target.value }))}
                        className="w-full px-3 py-2 bg-surface border border-border-neutral rounded-xl text-text-main text-xs focus:outline-none focus:border-brand shadow-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-text-muted mb-1">
                        Display Priority (Higher = First)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="10000"
                        value={formData.priority}
                        onChange={(e) => setFormData((p) => ({ ...p, priority: e.target.value }))}
                        className="w-full px-3 py-2 bg-surface border border-border-neutral rounded-xl text-text-main font-mono text-xs focus:outline-none focus:border-brand shadow-xs"
                      />
                    </div>
                  </div>

                  {/* Active Toggle */}
                  <div className="pt-2 flex items-center justify-between border-t border-border-neutral">
                    <div>
                      <span className="font-bold text-text-main block">Active on Storefront</span>
                      <span className="text-[11px] text-text-muted">
                        When active, banner shows during its valid scheduled window.
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={(e) => setFormData((p) => ({ ...p, isActive: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-border-neutral peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border-neutral after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand" />
                    </label>
                  </div>
                </div>

                {/* Live Preview Card */}
                {formData.title && formData.desktopImage && (
                  <div className="space-y-2 pt-2">
                    <span className="text-xs font-bold text-text-muted uppercase tracking-wider block">
                      Live Storefront Preview
                    </span>
                    <div className="border border-border-neutral rounded-2xl overflow-hidden bg-surface p-4 sm:p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        {formData.badge && (
                          <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-brand-light text-brand font-bold border border-brand/20">
                            {formData.badge}
                          </span>
                        )}
                        <h4 className="text-lg sm:text-xl font-bold font-heading text-text-main">
                          {formData.title}
                        </h4>
                        <p className="text-xs text-text-muted line-clamp-2">{formData.subtitle}</p>
                        <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand text-white font-bold text-xs mt-2">
                          <span>{formData.buttonText || 'Shop Now'}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                      <div className="w-full md:w-48 h-32 rounded-xl overflow-hidden border border-border-neutral bg-surface-subtle shrink-0">
                        <img
                          src={formData.desktopImage}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Pinned Footer */}
              <div className="shrink-0 px-6 py-4 border-t border-border-neutral bg-surface flex items-center justify-end gap-3 z-10">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={actionLoading}
                  className="px-4 py-2.5 rounded-xl border border-border-neutral hover:bg-surface-subtle text-xs font-semibold text-text-muted transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-bold transition shadow-xs flex items-center gap-2"
                >
                  {actionLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span>{editingBanner ? 'Update Banner' : 'Create Banner'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── STOREFRONT LIVE PREVIEW MODAL ─── */}
      {previewModalOpen && previewBanner && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
          onClick={() => setPreviewModalOpen(false)}
        >
          <div
            className="bg-surface rounded-2xl border border-border-neutral shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col max-h-[90dvh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-3.5 border-b border-border-neutral flex items-center justify-between bg-surface-subtle">
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold font-heading text-text-main">Storefront Live Preview</span>
                <div className="flex items-center gap-1 bg-surface border border-border-neutral rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => setPreviewDevice('desktop')}
                    className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 transition ${
                      previewDevice === 'desktop' ? 'bg-brand text-white' : 'text-text-muted hover:text-text-main'
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    <span>Desktop</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDevice('mobile')}
                    className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 transition ${
                      previewDevice === 'mobile' ? 'bg-brand text-white' : 'text-text-muted hover:text-text-main'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Mobile</span>
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-main"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Preview Viewport */}
            <div className="p-6 overflow-y-auto flex items-center justify-center bg-primary-bg min-h-[380px]">
              <div
                className={`transition-all duration-300 w-full ${
                  previewDevice === 'mobile' ? 'max-w-sm border-4 border-gray-800 rounded-3xl overflow-hidden shadow-2xl p-2 bg-surface' : 'max-w-3xl'
                }`}
              >
                <div className={`rounded-2xl sm:rounded-3xl border border-border-neutral overflow-hidden bg-surface shadow-md flex flex-row items-stretch justify-between w-full select-none ${
                  previewDevice === 'mobile' ? 'h-[210px]' : 'h-[320px] md:h-[385px]'
                }`}>
                  <div className={`${previewDevice === 'mobile' ? 'w-[58%] p-4 space-y-1.5' : 'w-[48%] p-6 md:p-10 space-y-3'} h-full flex flex-col justify-center`}>
                    {previewBanner.badge && (
                      <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold px-2.5 py-0.5 rounded-full bg-brand-light text-brand border border-brand/20 w-fit">
                        <Sparkles className="w-3 h-3" />
                        {previewBanner.badge}
                      </span>
                    )}
                    <h3 className={`${previewDevice === 'mobile' ? 'text-base font-bold' : 'text-xl sm:text-2xl lg:text-[28px] font-extrabold'} font-heading text-text-main leading-tight line-clamp-2`}>
                      {previewBanner.title}
                    </h3>
                    <p className="text-[11px] sm:text-xs text-text-muted leading-relaxed line-clamp-2 max-w-sm">
                      {previewBanner.subtitle}
                    </p>
                    <div className="pt-1">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-brand text-white text-[11px] sm:text-xs font-bold shadow-xs transition"
                      >
                        <span>{previewBanner.buttonText || 'Shop Now'}</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div className={`${previewDevice === 'mobile' ? 'w-[42%]' : 'w-[52%]'} h-full relative bg-surface-subtle overflow-hidden`}>
                    <img
                      src={
                        previewDevice === 'mobile' && previewBanner.mobileImage
                          ? previewBanner.mobileImage
                          : previewBanner.desktopImage
                      }
                      alt={previewBanner.title}
                      className="w-full h-full object-cover object-center pointer-events-none"
                    />
                    <div className="absolute inset-y-0 left-0 w-16 md:w-32 bg-gradient-to-r from-surface via-surface/60 to-transparent pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRMATION DIALOG ─── */}
      {deleteConfirmOpen && bannerToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn"
          onClick={() => setDeleteConfirmOpen(false)}
        >
          <div
            className="bg-surface rounded-2xl border border-border-neutral shadow-xl max-w-md w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-status-error/10 text-status-error flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold font-heading text-text-main">Delete Promotional Banner?</h3>
              <p className="text-xs text-text-muted">
                Are you sure you want to permanently delete{' '}
                <span className="font-bold text-text-main">"{bannerToDelete.name}"</span>? This will immediately
                remove it from the customer storefront.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                disabled={actionLoading}
                className="px-4 py-2.5 rounded-xl border border-border-neutral text-xs font-semibold text-text-muted hover:bg-surface-subtle transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={actionLoading}
                className="px-5 py-2.5 rounded-xl bg-status-error hover:bg-status-error/90 text-white text-xs font-bold transition shadow-xs flex items-center gap-2"
              >
                {actionLoading ? 'Deleting...' : 'Delete Banner'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Contextual Bulk Action Bar */}
      <BulkActionBar
        selectedCount={bulk.selectedCount}
        totalMatching={meta.total || 0}
        currentPageCount={banners.length}
        selectAllMatching={bulk.selectAllMatching}
        onSelectAllMatching={bulk.handleSelectAllMatching}
        onClearSelection={bulk.clearSelection}
        itemName="banners"
        actions={[
          {
            id: 'activate',
            label: 'Activate',
            icon: CheckCircle2,
            variant: 'primary',
            onClick: () => handleTriggerBulkBannerStatus(true),
          },
          {
            id: 'deactivate',
            label: 'Deactivate',
            icon: AlertCircle,
            variant: 'warning',
            onClick: () => handleTriggerBulkBannerStatus(false),
          },
          {
            id: 'delete',
            label: 'Delete Selected',
            icon: Trash2,
            variant: 'danger',
            onClick: handleTriggerBulkBannerDelete,
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
            fetchBanners();
          }}
        />
      )}
    </div>
  );
}
