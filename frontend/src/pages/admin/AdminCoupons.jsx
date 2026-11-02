/**
 * Admin Coupons & Promotional Offers Management.
 *
 * Route: /admin/coupons
 * Allows store administrators to create, edit, activate, and deactivate coupons
 * with percentage or fixed discount, minimum order requirements, max cap, and expiration dates.
 *
 * @module pages/admin/AdminCoupons
 */

import React, { useState, useEffect } from 'react';
import { apiClient } from '../../config/api.js';
import {
  TicketPercent,
  Plus,
  RefreshCw,
  Search,
  Calendar,
  CheckCircle2,
  XCircle,
  Percent,
  IndianRupee,
  ShieldAlert,
  Edit2,
  Trash2,
  AlertCircle,
  X,
} from 'lucide-react';
import { Pagination } from '../../components/Pagination.jsx';
import { useBulkSelection } from '../../hooks/useBulkSelection.js';
import { BulkActionBar } from '../../components/BulkActionBar.jsx';
import { BulkConfirmModal } from '../../components/BulkConfirmModal.jsx';

export function AdminCoupons() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pagination, setPagination] = useState({ totalPages: 1, totalRecords: 0 });
  const isFirstMount = React.useRef(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Bulk Selection hook & modals
  const bulk = useBulkSelection(pagination.totalRecords);
  const [bulkConfig, setBulkConfig] = useState(null);
  const [bulkResultSummary, setBulkResultSummary] = useState(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Form Fields
  const [form, setForm] = useState({
    code: '',
    discountType: 'PERCENTAGE', // 'PERCENTAGE' | 'FLAT'
    discountValue: 10,
    minOrderAmountRupees: 299,
    maxDiscountAmountRupees: 100,
    validTill: '',
    usageLimit: 100,
    description: '',
    isActive: true,
  });

  const fetchCoupons = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        limit: pageSize,
      };
      if (search.trim()) params.search = search.trim();

      const res = await apiClient.get('/v1/admin/coupons', { params });
      if (res.data?.success) {
        setCoupons(res.data.data || []);
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
      setError(err.message || 'Failed to load coupons from database.');
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerBulkCouponStatus = (isActive) => {
    setBulkConfig({
      title: isActive ? 'Bulk Activate Coupons' : 'Bulk Deactivate Coupons',
      description: `You are about to ${isActive ? 'activate' : 'deactivate'} ${bulk.selectedCount} coupon(s).`,
      affectedCount: bulk.selectedCount,
      itemName: 'coupons',
      confirmLabel: `${isActive ? 'Activate' : 'Deactivate'} Selected`,
      confirmVariant: isActive ? 'primary' : 'warning',
      requireReason: false,
      reversibilityNotice: isActive
        ? 'Activated coupons can be immediately redeemed by customers at checkout.'
        : 'Deactivated coupons cannot be used for new orders.',
      onConfirm: async () => {
        setBulkLoading(true);
        try {
          const res = await apiClient.post('/v1/admin/coupons/bulk-status', {
            ids: bulk.selectedIds,
            selectAllMatching: bulk.selectAllMatching,
            filter: {},
            isActive,
          });
          setBulkResultSummary(res.data);
        } catch (err) {
          setError(err.response?.data?.message || 'Bulk coupon status update failed.');
          setBulkConfig(null);
        } finally {
          setBulkLoading(false);
        }
      },
    });
  };

  const handleTriggerBulkCouponDelete = () => {
    setBulkConfig({
      title: 'Bulk Delete / Retire Coupons',
      description: `Are you sure you want to delete ${bulk.selectedCount} coupon(s)?`,
      affectedCount: bulk.selectedCount,
      itemName: 'coupons',
      confirmLabel: 'Delete Coupons',
      confirmVariant: 'danger',
      requireReason: false,
      reversibilityNotice:
        'Coupons with prior usage history will be permanently deactivated instead of deleted to protect order audit trails.',
      onConfirm: async () => {
        setBulkLoading(true);
        try {
          const res = await apiClient.post('/v1/admin/coupons/bulk-delete', {
            ids: bulk.selectedIds,
            selectAllMatching: bulk.selectAllMatching,
            filter: {},
          });
          setBulkResultSummary(res.data);
        } catch (err) {
          setError(err.response?.data?.message || 'Bulk coupon deletion failed.');
          setBulkConfig(null);
        } finally {
          setBulkLoading(false);
        }
      },
    });
  };

  useEffect(() => {
    fetchCoupons();
  }, [page, pageSize]);

  // Debounced search
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    const timer = setTimeout(() => {
      setPage(1);
      fetchCoupons();
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const openCreateModal = () => {
    setEditingCoupon(null);
    const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    setForm({
      code: '',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      minOrderAmountRupees: 299,
      maxDiscountAmountRupees: 100,
      validTill: nextMonth.toISOString().split('T')[0],
      usageLimit: 100,
      description: '',
      isActive: true,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (coupon) => {
    setEditingCoupon(coupon);
    setForm({
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountType === 'FLAT' ? coupon.discountValue / 100 : coupon.discountValue,
      minOrderAmountRupees: coupon.minOrderAmountPaise ? coupon.minOrderAmountPaise / 100 : 0,
      maxDiscountAmountRupees: coupon.maxDiscountAmountPaise ? coupon.maxDiscountAmountPaise / 100 : 0,
      validTill: coupon.validTill ? new Date(coupon.validTill).toISOString().split('T')[0] : '',
      usageLimit: coupon.usageLimit || 0,
      description: coupon.description || '',
      isActive: coupon.isActive,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSaveCoupon = async (e) => {
    e.preventDefault();
    if (!form.code.trim()) {
      setFormError('Coupon code is required.');
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        minOrderAmountPaise: Math.round(Number(form.minOrderAmountRupees || 0) * 100),
        maxDiscountAmountPaise: Math.round(Number(form.maxDiscountAmountRupees || 0) * 100),
        validTill: form.validTill ? new Date(form.validTill).toISOString() : null,
        usageLimit: Number(form.usageLimit) || null,
        description: form.description.trim(),
        isActive: form.isActive,
      };

      if (form.discountType === 'FLAT') {
        payload.discountValue = Math.round(Number(form.discountValue) * 100);
      }

      if (editingCoupon) {
        await apiClient.patch(`/v1/admin/coupons/${editingCoupon._id}`, payload);
      } else {
        await apiClient.post('/v1/admin/coupons', payload);
      }

      setIsModalOpen(false);
      await fetchCoupons();
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || 'Failed to save coupon.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (coupon) => {
    try {
      await apiClient.patch(`/v1/admin/coupons/${coupon._id}`, {
        isActive: !coupon.isActive,
      });
      await fetchCoupons();
    } catch (err) {
      alert(err.message || 'Failed to update coupon status.');
    }
  };

  const handleDelete = async (coupon) => {
    if (!window.confirm(`Deactivate coupon "${coupon.code}"?`)) return;
    try {
      await apiClient.delete(`/v1/admin/coupons/${coupon._id}`);
      await fetchCoupons();
    } catch (err) {
      alert(err.message || 'Failed to deactivate coupon.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-text-main flex items-center gap-2.5">
            <TicketPercent className="w-6 h-6 text-brand" />
            Coupons & Promotional Offers
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Configure discount vouchers, cart thresholds, and expiration dates. Validated in real-time during checkout.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button
            onClick={fetchCoupons}
            className="p-2.5 rounded-xl bg-surface border border-border-neutral text-text-muted hover:text-text-main hover:bg-surface-subtle transition shadow-xs"
            title="Refresh Coupons"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={openCreateModal}
            className="px-4 py-2.5 bg-brand hover:bg-brand-hover text-white font-semibold text-xs rounded-xl flex items-center gap-2 shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Create Coupon</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-surface p-3 rounded-2xl border border-border-neutral max-w-md flex items-center gap-2 shadow-xs">
        <Search className="w-4 h-4 text-text-muted shrink-0" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by coupon code or offer description..."
          className="bg-transparent text-xs text-text-main placeholder:text-text-muted focus:outline-none w-full"
        />
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-status-error text-xs flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Table */}
      <div className="bg-surface border border-border-neutral rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-xs text-text-main">
            <thead className="bg-surface-subtle border-b border-border-neutral text-[11px] uppercase tracking-wider text-text-muted">
              <tr>
                <th className="py-3.5 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={
                      coupons.length > 0 &&
                      bulk.getPageSelectionState(coupons.map((c) => c._id)).isAllSelected
                    }
                    onChange={() => bulk.toggleSelectPage(coupons.map((c) => c._id))}
                    className="rounded accent-brand"
                  />
                </th>
                <th className="px-5 py-3.5 font-semibold">Code & Offer</th>
                <th className="px-5 py-3.5 font-semibold">Discount Type</th>
                <th className="px-5 py-3.5 font-semibold">Min Subtotal</th>
                <th className="px-5 py-3.5 font-semibold">Max Cap</th>
                <th className="px-5 py-3.5 font-semibold">Validity</th>
                <th className="px-5 py-3.5 font-semibold">Times Used</th>
                <th className="px-5 py-3.5 font-semibold">Status</th>
                <th className="px-5 py-3.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-neutral font-medium">
              {loading && coupons.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-text-muted">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand" />
                    Loading coupons from database...
                  </td>
                </tr>
              ) : coupons.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-text-muted">
                    No coupons found. Click "Create Coupon" to launch a new discount offer.
                  </td>
                </tr>
              ) : (
                coupons.map((c) => {
                  const isExpired = c.validTill && new Date(c.validTill) < new Date();
                  const isSelected = bulk.isSelected(c._id);
                  return (
                    <tr
                      key={c._id}
                      className={`transition ${isSelected ? 'bg-brand-light/30' : 'hover:bg-surface-subtle/60'}`}
                    >
                      <td className="py-3.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => bulk.toggleSelect(c._id)}
                          className="rounded accent-brand"
                        />
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-brand bg-brand-light border border-brand/20 px-2 py-0.5 rounded-md text-xs">
                            {c.code}
                          </span>
                        </div>
                        {c.description && (
                          <p className="text-[11px] text-text-muted mt-1 max-w-xs truncate">
                            {c.description}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {c.discountType === 'PERCENTAGE' ? (
                          <span className="inline-flex items-center gap-1 text-brand font-bold bg-brand-light px-2 py-0.5 rounded-md border border-brand/20">
                            <Percent className="w-3 h-3" />
                            {c.discountValue}% OFF
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                            <IndianRupee className="w-3 h-3" />
                            ₹{(c.discountValue / 100).toFixed(0)} FLAT
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-text-main font-mono font-semibold">
                        {c.minOrderAmountPaise > 0 ? `₹${(c.minOrderAmountPaise / 100).toFixed(0)}` : 'None'}
                      </td>
                      <td className="px-5 py-4 text-text-main font-mono font-semibold">
                        {c.maxDiscountAmountPaise > 0 ? `₹${(c.maxDiscountAmountPaise / 100).toFixed(0)}` : 'No Cap'}
                      </td>
                      <td className="px-5 py-4">
                        {c.validTill ? (
                          <div className="flex items-center gap-1.5 text-text-main">
                            <Calendar className="w-3.5 h-3.5 text-text-muted" />
                            <span className={isExpired ? 'text-status-error font-bold' : ''}>
                              {new Date(c.validTill).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </span>
                            {isExpired && <span className="text-[10px] text-status-error font-semibold">(Expired)</span>}
                          </div>
                        ) : (
                          <span className="text-text-muted">No Expiration</span>
                        )}
                      </td>
                      <td className="px-5 py-4 font-mono text-text-main">
                        {c.usedCount || 0}
                        {c.usageLimit ? ` / ${c.usageLimit}` : ' (Unlimited)'}
                      </td>
                      <td className="px-5 py-4">
                        <button
                          onClick={() => handleToggleActive(c)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold border transition shadow-xs ${
                            c.isActive
                              ? 'bg-emerald-50 text-status-success border-emerald-200 hover:bg-emerald-100'
                              : 'bg-surface-subtle text-text-muted border-border-neutral hover:bg-border-neutral'
                          }`}
                        >
                          {c.isActive ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" /> Active
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3" /> Inactive
                            </>
                          )}
                        </button>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(c)}
                            className="p-1.5 text-text-muted hover:text-brand hover:bg-surface-subtle rounded-lg transition"
                            title="Edit Coupon"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(c)}
                            className="p-1.5 text-text-muted hover:text-status-error hover:bg-red-50 rounded-lg transition"
                            title="Deactivate Coupon"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
            itemName="coupons"
          />
        </div>
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-border-neutral rounded-2xl max-w-md w-full p-6 shadow-xl relative animate-fadeIn text-text-main">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 text-text-muted hover:text-text-main p-1.5 rounded-lg hover:bg-surface-subtle transition"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold font-heading text-text-main mb-1 flex items-center gap-2">
              <TicketPercent className="w-5 h-5 text-brand" />
              {editingCoupon ? 'Edit Coupon' : 'Create New Coupon'}
            </h3>
            <p className="text-xs text-text-muted mb-5">
              Specify voucher code, discount percentage or flat amount, and usage constraints.
            </p>

            {formError && (
              <div className="p-3 mb-4 rounded-xl bg-red-50 border border-red-200 text-status-error text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveCoupon} className="space-y-4 text-xs">
              <div>
                <label className="block text-text-main font-semibold mb-1">Coupon Code *</label>
                <input
                  type="text"
                  required
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. FESTIVE20, SAVE50"
                  className="w-full bg-primary-bg border border-border-neutral rounded-xl px-3 py-2 text-brand font-mono uppercase tracking-wider focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-text-main font-semibold mb-1">Discount Type</label>
                  <select
                    value={form.discountType}
                    onChange={(e) => setForm({ ...form, discountType: e.target.value })}
                    className="w-full bg-primary-bg border border-border-neutral rounded-xl px-3 py-2 text-text-main focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                  >
                    <option value="PERCENTAGE">Percentage (%)</option>
                    <option value="FLAT">Flat Rupee (₹)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-text-main font-semibold mb-1">
                    {form.discountType === 'PERCENTAGE' ? 'Discount (%) *' : 'Discount (₹) *'}
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={form.discountType === 'PERCENTAGE' ? 90 : 5000}
                    value={form.discountValue}
                    onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                    className="w-full bg-primary-bg border border-border-neutral rounded-xl px-3 py-2 text-text-main font-mono focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-text-main font-semibold mb-1">Min Order (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.minOrderAmountRupees}
                    onChange={(e) => setForm({ ...form, minOrderAmountRupees: e.target.value })}
                    className="w-full bg-primary-bg border border-border-neutral rounded-xl px-3 py-2 text-text-main font-mono focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="block text-text-main font-semibold mb-1">Max Cap (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.maxDiscountAmountRupees}
                    onChange={(e) => setForm({ ...form, maxDiscountAmountRupees: e.target.value })}
                    placeholder="0 for no limit"
                    className="w-full bg-primary-bg border border-border-neutral rounded-xl px-3 py-2 text-text-main font-mono focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-text-main font-semibold mb-1">Valid Till Date</label>
                  <input
                    type="date"
                    value={form.validTill}
                    onChange={(e) => setForm({ ...form, validTill: e.target.value })}
                    className="w-full bg-primary-bg border border-border-neutral rounded-xl px-3 py-2 text-text-main focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="block text-text-main font-semibold mb-1">Usage Limit</label>
                  <input
                    type="number"
                    min={0}
                    value={form.usageLimit}
                    onChange={(e) => setForm({ ...form, usageLimit: e.target.value })}
                    placeholder="e.g. 500"
                    className="w-full bg-primary-bg border border-border-neutral rounded-xl px-3 py-2 text-text-main font-mono focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                  />
                </div>
              </div>

              <div>
                <label className="block text-text-main font-semibold mb-1">Offer Description</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="e.g. 10% instant discount on orders above ₹299"
                  className="w-full bg-primary-bg border border-border-neutral rounded-xl px-3 py-2 text-text-main placeholder:text-text-muted focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isActiveCoupon"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="w-4 h-4 rounded accent-brand"
                />
                <label htmlFor="isActiveCoupon" className="text-text-main font-semibold cursor-pointer">
                  Activate coupon immediately for customer checkout
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-neutral">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border-neutral text-text-muted hover:text-text-main hover:bg-surface-subtle transition font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-brand hover:bg-brand-hover text-white font-semibold transition flex items-center gap-2 shadow-xs"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : editingCoupon ? (
                    'Update Coupon'
                  ) : (
                    'Create Coupon'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Contextual Bulk Action Bar */}
      <BulkActionBar
        selectedCount={bulk.selectedCount}
        totalMatching={pagination.totalRecords}
        currentPageCount={coupons.length}
        selectAllMatching={bulk.selectAllMatching}
        onSelectAllMatching={bulk.handleSelectAllMatching}
        onClearSelection={bulk.clearSelection}
        itemName="coupons"
        actions={[
          {
            id: 'activate',
            label: 'Activate',
            icon: CheckCircle2,
            variant: 'primary',
            onClick: () => handleTriggerBulkCouponStatus(true),
          },
          {
            id: 'deactivate',
            label: 'Deactivate',
            icon: XCircle,
            variant: 'warning',
            onClick: () => handleTriggerBulkCouponStatus(false),
          },
          {
            id: 'delete',
            label: 'Delete / Retire',
            icon: Trash2,
            variant: 'danger',
            onClick: handleTriggerBulkCouponDelete,
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
            fetchCoupons();
          }}
        />
      )}
    </div>
  );
}
