/**
 * Admin Customer Management Page — Suspend, Restore, and Controlled Deletion.
 *
 * Implements:
 * - Customer list with masked phone numbers, lifetime order spend, and last activity.
 * - Search by name, phone, email and status filtering (All, Active, Suspended, Anonymized).
 * - Suspend modal requiring mandatory suspension reason (revokes sessions immediately).
 * - Restore action.
 * - Controlled deletion workflow:
 *     - If orders exist: Personal data anonymized & addresses purged; order financial records retained for audit.
 *     - If 0 orders: Permanent purge.
 *     - Prevents deletion of administrative accounts.
 *
 * @module pages/admin/AdminCustomers
 */

import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  RefreshCw,
  Phone,
  Calendar,
  ShoppingBag,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  UserX,
  AlertTriangle,
  X,
  Trash2,
  Loader2,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { apiClient } from '../../config/api.js';
import { Pagination } from '../../components/Pagination.jsx';
import { useBulkSelection } from '../../hooks/useBulkSelection.js';
import { BulkActionBar } from '../../components/BulkActionBar.jsx';
import { BulkConfirmModal } from '../../components/BulkConfirmModal.jsx';

export function AdminCustomers() {
  const [customers, setCustomers] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [revealedPhones, setRevealedPhones] = useState({});
  const [notification, setNotification] = useState(null);

  // Modals state
  const [suspendTarget, setSuspendTarget] = useState(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Bulk Selection hook & modal
  const bulk = useBulkSelection(total);
  const [bulkConfig, setBulkConfig] = useState(null);
  const [bulkResultSummary, setBulkResultSummary] = useState(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const params = {
        page: String(page),
        limit: String(pageSize),
      };
      if (search.trim()) params.search = search.trim();
      if (statusFilter !== 'ALL') params.status = statusFilter;

      const res = await apiClient.get('/v1/admin/customers', { params });
      if (res.data?.success) {
        setCustomers(res.data.data || []);
        setTotal(res.data.pagination?.totalRecords ?? res.data.total ?? 0);
        setTotalPages(res.data.pagination?.totalPages ?? res.data.totalPages ?? 1);
        bulk.clearSelection();
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to load customers directory.';
      showNotification(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerBulkSuspend = () => {
    setBulkConfig({
      title: 'Bulk Suspend Customers',
      description: `You are about to suspend ${bulk.selectedCount} customer account(s). This will immediately revoke their active sessions.`,
      affectedCount: bulk.selectedCount,
      itemName: 'customers',
      confirmLabel: 'Suspend Selected',
      confirmVariant: 'warning',
      requireReason: true,
      reasonPlaceholder: 'Mandatory suspension reason for compliance audit...',
      reversibilityNotice: 'Suspended accounts can be restored at any time by an administrator.',
      onConfirm: async (reason) => {
        setBulkLoading(true);
        try {
          const res = await apiClient.post('/v1/admin/customers/bulk-suspend', {
            ids: bulk.selectedIds,
            selectAllMatching: bulk.selectAllMatching,
            filter: { search, status: statusFilter },
            reason,
          });
          setBulkResultSummary(res.data);
        } catch (err) {
          showNotification(err.response?.data?.message || 'Bulk suspension failed.', 'error');
          setBulkConfig(null);
        } finally {
          setBulkLoading(false);
        }
      },
    });
  };

  const handleTriggerBulkRestore = () => {
    setBulkConfig({
      title: 'Bulk Restore Customers',
      description: `Restore login access and account privileges for ${bulk.selectedCount} customer(s).`,
      affectedCount: bulk.selectedCount,
      itemName: 'customers',
      confirmLabel: 'Restore Accounts',
      confirmVariant: 'primary',
      requireReason: false,
      reversibilityNotice: 'Restored customers will be able to log in and place grocery orders again.',
      onConfirm: async () => {
        setBulkLoading(true);
        try {
          const res = await apiClient.post('/v1/admin/customers/bulk-restore', {
            ids: bulk.selectedIds,
            selectAllMatching: bulk.selectAllMatching,
            filter: { search, status: statusFilter },
          });
          setBulkResultSummary(res.data);
        } catch (err) {
          showNotification(err.response?.data?.message || 'Bulk restore failed.', 'error');
          setBulkConfig(null);
        } finally {
          setBulkLoading(false);
        }
      },
    });
  };

  const handleTriggerBulkDelete = () => {
    setBulkConfig({
      title: 'Bulk Delete Customer Accounts',
      description: `Are you sure you want to delete / anonymize ${bulk.selectedCount} selected customer(s)?`,
      affectedCount: bulk.selectedCount,
      itemName: 'customers',
      confirmLabel: 'Delete / Anonymize',
      confirmVariant: 'danger',
      requireReason: false,
      reversibilityNotice:
        'Customers with historical orders will be anonymized to preserve invoices, payments, and legal records. Customers with 0 orders will be permanently purged.',
      onConfirm: async () => {
        setBulkLoading(true);
        try {
          const res = await apiClient.post('/v1/admin/customers/bulk-delete', {
            ids: bulk.selectedIds,
            selectAllMatching: bulk.selectAllMatching,
            filter: { search, status: statusFilter },
          });
          setBulkResultSummary(res.data);
        } catch (err) {
          showNotification(err.response?.data?.message || 'Bulk customer deletion failed.', 'error');
          setBulkConfig(null);
        } finally {
          setBulkLoading(false);
        }
      },
    });
  };

  useEffect(() => {
    fetchCustomers();
  }, [page, pageSize, statusFilter]);

  const showNotification = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4500);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchCustomers();
  };

  const togglePhoneReveal = (id) => {
    setRevealedPhones((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Open Suspend Modal
  const openSuspendModal = (customer) => {
    setSuspendTarget(customer);
    setSuspendReason(customer.suspendedReason || '');
  };

  // Confirm Suspension
  const handleConfirmSuspend = async () => {
    if (!suspendTarget) return;
    if (!suspendReason.trim()) {
      showNotification('Please enter a mandatory suspension reason for security audit records.', 'error');
      return;
    }

    setActionLoading(true);
    try {
      const res = await apiClient.post(`/v1/admin/customers/${suspendTarget._id}/suspend`, {
        reason: suspendReason.trim(),
      });

      showNotification(res.data.message, 'success');
      setSuspendTarget(null);
      setSuspendReason('');
      fetchCustomers();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Network error while suspending customer.';
      showNotification(msg, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Restore Customer Account
  const handleRestoreCustomer = async (customer) => {
    setActionLoading(true);
    try {
      const res = await apiClient.post(`/v1/admin/customers/${customer._id}/restore`);
      showNotification(res.data.message, 'success');
      fetchCustomers();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Network error while restoring customer.';
      showNotification(msg, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Confirm Controlled Deletion
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      const res = await apiClient.delete(`/v1/admin/customers/${deleteTarget._id}`);
      showNotification(res.data.message, 'success');
      setDeleteTarget(null);
      fetchCustomers();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Deletion failed.';
      showNotification(msg, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`p-4 rounded-xl border text-xs font-semibold flex items-center justify-between shadow-md animate-fadeIn ${
            notification.type === 'error'
              ? 'bg-status-error/10 border-status-error/30 text-status-error'
              : 'bg-status-success/10 border-status-success/30 text-status-success'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>{notification.msg}</span>
          </div>
          <button type="button" onClick={() => setNotification(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-heading text-text-main">Customer Accounts & Lifecycle</h1>
          <p className="text-xs text-text-muted mt-1">
            Manage customer status, enforce security session invalidation, and execute compliant account anonymization.
          </p>
        </div>

        <button
          onClick={fetchCustomers}
          className="self-start sm:self-auto px-3.5 py-2 bg-surface hover:bg-surface-subtle border border-border-neutral text-xs font-semibold text-text-main rounded-xl flex items-center gap-2 transition shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-text-muted ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh List</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-surface border border-border-neutral rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'ALL', label: 'All Accounts' },
            { id: 'ACTIVE', label: 'Active' },
            { id: 'SUSPENDED', label: 'Suspended' },
            { id: 'ANONYMIZED', label: 'Anonymized / Deleted' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setStatusFilter(tab.id);
                setPage(1);
              }}
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
            placeholder="Search name, phone, or email..."
            className="w-full pl-9 pr-3 py-2 bg-primary-bg border border-border-neutral rounded-xl text-xs text-text-main placeholder:text-text-muted focus:outline-none focus:border-brand"
          />
        </form>
      </div>

      {/* Customers Table */}
      <div className="bg-surface border border-border-neutral rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[750px] text-left text-xs">
            <thead className="bg-surface-subtle text-[10px] uppercase tracking-wider text-text-muted border-b border-border-neutral font-bold">
              <tr>
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={
                      customers.length > 0 &&
                      bulk.getPageSelectionState(customers.map((c) => c._id)).isAllSelected
                    }
                    onChange={() => bulk.toggleSelectPage(customers.map((c) => c._id))}
                    className="rounded accent-brand"
                  />
                </th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Phone Number</th>
                <th className="py-3 px-4">Orders & Lifetime Spend</th>
                <th className="py-3 px-4">Last Activity</th>
                <th className="py-3 px-4">Account Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-neutral">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-text-muted">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-brand mb-2" />
                    <span>Loading customer accounts...</span>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-text-muted">
                    <Users className="w-8 h-8 mx-auto text-text-muted/40 mb-2" />
                    <p className="font-bold text-text-main">No customer accounts found</p>
                    <p className="text-[11px] mt-0.5">Try clearing filters or adjusting your search keyword.</p>
                  </td>
                </tr>
              ) : (
                customers.map((c) => {
                  const spentRupees = ((c.totalSpentPaise || 0) / 100).toFixed(0);
                  const isRevealed = Boolean(revealedPhones[c._id]);
                  const displayPhone = isRevealed ? c.phone : (c.phoneMasked || c.phone);
                  const isSelected = bulk.isSelected(c._id);

                  let statusBadge = (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-status-success/10 text-status-success border border-status-success/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-status-success" />
                      Active
                    </span>
                  );

                  if (c.isDeleted) {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-surface-subtle text-text-muted border border-border-neutral">
                        Anonymized
                      </span>
                    );
                  } else if (!c.isActive) {
                    statusBadge = (
                      <span
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-status-warning/10 text-status-warning border border-status-warning/20 cursor-help"
                        title={c.suspendedReason || 'Suspended'}
                      >
                        <ShieldAlert className="w-3 h-3" />
                        Suspended
                      </span>
                    );
                  }

                  return (
                    <tr
                      key={c._id}
                      className={`transition ${isSelected ? 'bg-brand-light/30' : 'hover:bg-surface-subtle/50'}`}
                    >
                      <td className="py-3.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => bulk.toggleSelect(c._id)}
                          className="rounded accent-brand"
                        />
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-brand-light text-brand font-bold flex items-center justify-center text-xs shrink-0">
                            {c.name?.[0]?.toUpperCase() || 'C'}
                          </div>
                          <div>
                            <span className="font-bold text-text-main block">{c.name}</span>
                            <span className="text-[10px] text-text-muted">
                              Registered: {new Date(c.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-text-main text-[11px]">{displayPhone}</span>
                          <button
                            type="button"
                            onClick={() => togglePhoneReveal(c._id)}
                            className="p-1 rounded text-text-muted hover:text-brand transition"
                            title={isRevealed ? 'Mask phone' : 'Show full phone'}
                          >
                            {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-text-main">{c.orderCount || 0} Orders</div>
                        <div className="text-[10px] text-status-success font-semibold">₹{spentRupees} Total</div>
                      </td>

                      <td className="py-3.5 px-4 text-text-muted text-[11px]">
                        {c.lastOrderAt ? (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-text-muted" />
                            <span>Ordered {new Date(c.lastOrderAt).toLocaleDateString()}</span>
                          </div>
                        ) : c.lastLoginAt ? (
                          <span>Active {new Date(c.lastLoginAt).toLocaleDateString()}</span>
                        ) : (
                          <span>No orders yet</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {statusBadge}
                        {c.suspendedReason && (
                          <span className="text-[10px] text-status-warning block mt-0.5 line-clamp-1 italic">
                            "{c.suspendedReason}"
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        {!c.isDeleted && (
                          <div className="flex items-center justify-end gap-1.5">
                            {c.isActive ? (
                              <button
                                type="button"
                                onClick={() => openSuspendModal(c)}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-status-warning/10 text-status-warning border border-status-warning/20 hover:bg-status-warning/20 transition"
                                title="Suspend Account"
                              >
                                Suspend
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleRestoreCustomer(c)}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-status-success/10 text-status-success border border-status-success/20 hover:bg-status-success/20 transition"
                                title="Restore Account"
                              >
                                Restore
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setDeleteTarget(c)}
                              className="p-1.5 rounded-lg text-text-muted hover:text-status-error hover:bg-status-error/10 border border-border-neutral transition"
                              title="Delete / Anonymize Customer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
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
            totalPages={totalPages}
            totalRecords={total}
            pageSize={pageSize}
            onPageChange={(p) => setPage(p)}
            onPageSizeChange={(sz) => {
              setPageSize(sz);
              setPage(1);
            }}
            pageSizeOptions={[10, 20, 50]}
            loading={loading}
            itemName="customers"
          />
        </div>
      </div>

      {/* SUSPEND CUSTOMER MODAL */}
      {suspendTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-text-main/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-surface rounded-2xl border border-border-neutral shadow-2xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-status-warning/10 text-status-warning flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold font-heading text-text-main">
                  Suspend Account: {suspendTarget.name}
                </h3>
                <p className="text-[11px] text-text-muted">
                  Phone: {suspendTarget.phone} • {suspendTarget.orderCount || 0} orders
                </p>
              </div>
            </div>

            <div className="p-3 bg-surface-subtle border border-border-neutral rounded-xl text-xs text-text-muted space-y-1">
              <p className="font-bold text-text-main">Security Enforcement:</p>
              <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                <li>All active tokens and sessions will be revoked instantly on the server.</li>
                <li>Customer will be prevented from placing new orders or logging in.</li>
                <li>Existing orders and payments are preserved for fulfillment/refunds.</li>
              </ul>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-text-main mb-1">
                Reason for Suspension (Audit & Support Log) *
              </label>
              <textarea
                rows={3}
                required
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="e.g. Chargeback investigation, suspicious activity, repeated failed OTP attempts..."
                className="w-full px-3 py-2 bg-primary-bg border border-border-neutral rounded-xl text-xs text-text-main focus:outline-none focus:border-brand"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setSuspendTarget(null)}
                className="px-4 py-2 border border-border-neutral text-xs font-semibold text-text-muted hover:text-text-main rounded-xl hover:bg-surface-subtle transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleConfirmSuspend}
                className="px-4 py-2 bg-status-warning hover:bg-status-warning/90 text-white text-xs font-bold rounded-xl transition shadow-xs disabled:opacity-50"
              >
                {actionLoading ? 'Processing...' : 'Confirm Suspension'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONTROLLED DELETION MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-text-main/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-surface rounded-2xl border border-border-neutral shadow-2xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-status-error/10 text-status-error flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold font-heading text-text-main">
                  Delete / Anonymize Customer: {deleteTarget.name}
                </h3>
                <p className="text-[11px] text-text-muted font-mono">{deleteTarget.phone}</p>
              </div>
            </div>

            <div className="p-3 bg-surface-subtle border border-border-neutral rounded-xl text-xs text-text-muted space-y-1.5">
              <span className="font-bold text-text-main block">Audit & Legal Compliance Policy:</span>
              {deleteTarget.orderCount > 0 ? (
                <p className="text-[11px] leading-relaxed">
                  This customer has <strong>{deleteTarget.orderCount} historical order(s)</strong>.
                  To comply with GST, financial audit, and tax retention laws, personal details (name, phone, email, addresses)
                  will be <strong>permanently anonymized</strong>, while invoice records remain intact without exposing personal data.
                </p>
              ) : (
                <p className="text-[11px] leading-relaxed">
                  This customer has <strong>0 orders</strong>. The account and personal profile will be <strong>permanently purged</strong> from the database.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
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
                {actionLoading ? 'Processing...' : 'Confirm Action'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={bulk.selectedCount}
        totalMatching={total}
        currentPageCount={customers.length}
        selectAllMatching={bulk.selectAllMatching}
        onSelectAllMatching={bulk.handleSelectAllMatching}
        onClearSelection={bulk.clearSelection}
        itemName="customers"
        actions={[
          {
            id: 'suspend',
            label: 'Suspend Selected',
            icon: ShieldAlert,
            variant: 'warning',
            onClick: handleTriggerBulkSuspend,
          },
          {
            id: 'restore',
            label: 'Restore Selected',
            icon: ShieldCheck,
            variant: 'primary',
            onClick: handleTriggerBulkRestore,
          },
          {
            id: 'delete',
            label: 'Delete / Archive',
            icon: Trash2,
            variant: 'danger',
            onClick: handleTriggerBulkDelete,
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
            fetchCustomers();
          }}
        />
      )}
    </div>
  );
}
