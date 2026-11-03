/**
 * Admin Orders Management View.
 *
 * Route: /admin/orders
 * Supports full order search, filtering by status and payment method,
 * status transitions with state-machine validation, and delivery notes.
 *
 * @module pages/admin/AdminOrders
 */

import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiClient } from '../../config/api.js';
import { Pagination } from '../../components/Pagination.jsx';
import { useBulkSelection } from '../../hooks/useBulkSelection.js';
import { BulkActionBar } from '../../components/BulkActionBar.jsx';
import { BulkConfirmModal } from '../../components/BulkConfirmModal.jsx';
import { SkeletonTable } from '../../components/skeleton/index.js';
import {
  Package,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  MapPin,
  RefreshCw,
  X,
  CreditCard,
  Banknote,
  AlertCircle,
  Truck,
  ArrowRight,
} from 'lucide-react';

export function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    pageSize: 6,
    totalOrders: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  });
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSearch = searchParams.get('search') || '';
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState(initialSearch);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Bulk Selection hook & modals
  const bulk = useBulkSelection(pagination.totalOrders);
  const [bulkConfig, setBulkConfig] = useState(null);
  const [bulkResultSummary, setBulkResultSummary] = useState(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Status Update Modal State
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [newStatus, setNewStatus] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState('');

  const abortControllerRef = useRef(null);

  const fetchOrders = async (targetPage = page, querySearch = search) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const params = { page: targetPage, limit: 6 };
      if (statusFilter !== 'ALL') params.status = statusFilter;
      const effectiveSearch = (querySearch !== undefined ? querySearch : search).trim();
      if (effectiveSearch) params.search = effectiveSearch;

      const res = await apiClient.get('/v1/admin/orders', {
        params,
        signal: controller.signal,
      });

      if (res.data?.success) {
        const orderList = res.data?.data?.orders || (Array.isArray(res.data?.data) ? res.data.data : []);
        const paginationMeta = res.data?.data?.pagination || {
          currentPage: res.data?.page || targetPage,
          pageSize: 6,
          totalOrders: res.data?.total ?? orderList.length,
          totalPages: res.data?.totalPages || 1,
          hasNextPage: targetPage < (res.data?.totalPages || 1),
          hasPreviousPage: targetPage > 1,
        };

        // Clamping check: if current page exceeds total pages, jump to last valid page
        if (paginationMeta.totalPages > 0 && targetPage > paginationMeta.totalPages) {
          setPage(paginationMeta.totalPages);
          return;
        }

        setOrders(orderList);
        setTotal(paginationMeta.totalOrders);
        setPagination(paginationMeta);
        bulk.clearSelection();
      }
    } catch (err) {
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
        return;
      }
      setError(err.response?.data?.message || err.message || 'Failed to load orders.');
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  };

  const handleTriggerBulkOrderStatus = (targetStatus) => {
    const isCancel = targetStatus === 'CANCELLED';
    setBulkConfig({
      title: isCancel ? 'Cancel Selected Orders' : `Mark Orders as ${targetStatus.replace(/_/g, ' ')}`,
      description: `You are about to transition ${bulk.selectedCount} order(s) to status ${targetStatus}.`,
      affectedCount: bulk.selectedCount,
      itemName: 'orders',
      confirmLabel: `${targetStatus.replace(/_/g, ' ')}`,
      confirmVariant: isCancel ? 'danger' : 'primary',
      requireReason: isCancel,
      reasonPlaceholder: isCancel ? 'Mandatory cancellation reason (e.g. customer requested cancellation / stock shortage)...' : '',
      reversibilityNotice: isCancel
        ? 'Cancelled orders will automatically release reserved product inventory back to stock.'
        : 'Order status state machine will validate and process eligible orders.',
      onConfirm: async (reason) => {
        setBulkLoading(true);
        try {
          const res = await apiClient.post('/v1/admin/orders/bulk-status', {
            ids: bulk.selectedIds,
            selectAllMatching: bulk.selectAllMatching,
            filter: { status: statusFilter },
            status: targetStatus,
            note: reason,
          });
          setBulkResultSummary(res.data);
        } catch (err) {
          setError(err.response?.data?.message || 'Bulk order status update failed.');
          setBulkConfig(null);
        } finally {
          setBulkLoading(false);
        }
      },
    });
  };

  useEffect(() => {
    const urlQuery = searchParams.get('search') || '';
    setSearch(urlQuery);
    fetchOrders(page, urlQuery);
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [page, statusFilter, searchParams]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const trimmed = search.trim();
    if (trimmed) {
      setSearchParams({ search: trimmed });
    } else {
      setSearchParams({});
    }
    if (page === 1) {
      fetchOrders(1, trimmed);
    } else {
      setPage(1);
    }
  };

  const handleClearSearch = () => {
    setSearch('');
    setSearchParams({});
    if (page === 1) {
      fetchOrders(1, '');
    } else {
      setPage(1);
    }
  };

  const handleOpenStatusModal = (order) => {
    setSelectedOrder(order);
    setNewStatus(order.orderStatus);
    setStatusNote('');
    setUpdateError('');
  };

  const handleStatusSubmit = async (e) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setUpdating(true);
    setUpdateError('');
    try {
      await apiClient.patch(`/v1/admin/orders/${selectedOrder._id}/status`, {
        status: newStatus,
        note: statusNote,
      });
      setSelectedOrder(null);
      await fetchOrders(page);
    } catch (err) {
      setUpdateError(err.response?.data?.message || err.message || 'Failed to update order status.');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-text-main">Order Management</h1>
          <p className="text-xs text-text-muted mt-1">
            Track, dispatch, update status, and manage doorstep deliveries across Indore.
          </p>
        </div>

        <button
          onClick={fetchOrders}
          className="self-start sm:self-auto px-3.5 py-2 bg-surface hover:bg-surface-subtle border border-border-neutral text-xs font-semibold text-text-main rounded-xl flex items-center gap-2 transition shadow-xs"
        >
          <RefreshCw className="w-3.5 h-3.5 text-text-muted" />
          <span>Refresh Orders</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface border border-border-neutral rounded-2xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 shadow-xs">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-3 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Order Number, Customer, Phone..."
            className="w-full bg-primary-bg border border-border-neutral rounded-xl pl-10 pr-9 py-2 text-xs text-text-main placeholder:text-text-muted focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
          />
          {search && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-2.5 top-2.5 p-0.5 text-text-muted hover:text-text-main rounded-md transition"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </form>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs pb-1 sm:pb-0">
          {['ALL', 'PLACED', 'CONFIRMED', 'PROCESSING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'].map((st) => (
            <button
              key={st}
              onClick={() => {
                setStatusFilter(st);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition text-xs ${
                statusFilter === st
                  ? 'bg-brand text-white shadow-xs'
                  : 'bg-surface text-text-muted hover:text-text-main border border-border-neutral hover:bg-surface-subtle'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Active Search / Filter Indicator */}
      {search && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-brand-light/70 border border-brand/20 rounded-xl text-xs text-brand font-medium animate-fadeIn">
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-brand shrink-0" />
            <span>
              Showing search result for: <strong className="font-mono text-text-main">{search}</strong> ({pagination.totalOrders} order{pagination.totalOrders === 1 ? '' : 's'} found)
            </span>
          </div>
          <button
            type="button"
            onClick={handleClearSearch}
            className="text-xs font-bold text-brand hover:underline flex items-center gap-1 cursor-pointer bg-white px-2.5 py-1 rounded-lg border border-brand/20 shadow-xs"
          >
            <span>Show All Orders</span>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Orders Table */}
      {loading ? (
        <SkeletonTable rows={6} columns={6} showToolbar={false} showPagination={true} />
      ) : error ? (
        <div className="p-8 bg-red-50 border border-red-200 text-status-error rounded-2xl text-center space-y-3">
          <p className="text-sm font-semibold">{error}</p>
          <button
            onClick={fetchOrders}
            className="px-4 py-2 bg-status-error text-white rounded-xl text-xs font-semibold hover:bg-red-700 transition"
          >
            Retry
          </button>
        </div>
      ) : orders.length === 0 ? (
        <div className="p-12 text-center bg-surface border border-border-neutral rounded-2xl space-y-3 shadow-xs">
          <Package className="w-12 h-12 text-text-muted/40 mx-auto" />
          <h3 className="text-base font-bold text-text-main">No orders match criteria</h3>
          <p className="text-xs text-text-muted">Try changing your search term or status filter.</p>
        </div>
      ) : (
        <div className="bg-surface border border-border-neutral rounded-2xl overflow-hidden shadow-xs">
          {/* Mobile Card Layout (Shown on mobile screens < md) */}
          <div className="block md:hidden divide-y divide-border-neutral">
            {orders.map((ord) => {
              const totalRupees = ((ord.pricing?.grandTotalPaise || 0) / 100).toFixed(0);
              const customerName = ord.deliveryAddress?.recipientName || ord.customer?.name || 'Customer';
              const customerPhone = ord.deliveryAddress?.phone || ord.customer?.phone || '—';
              const itemsCount = ord.items?.length || 0;
              const formattedDate = new Date(ord.createdAt).toLocaleString('en-IN', {
                dateStyle: 'short',
                timeStyle: 'short',
              });

              const isSelected = bulk.isSelected(ord._id);
              return (
                <div key={ord._id} className={`p-4 space-y-3 transition ${isSelected ? 'bg-brand-light/30' : ''}`}>
                  {/* Top: Order Number & Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => bulk.toggleSelect(ord._id)}
                        className="mt-0.5 rounded accent-brand"
                      />
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider block mb-0.5">
                          Order Number
                        </span>
                        <span className="font-mono text-xs font-bold text-brand break-all block leading-tight">
                          {ord.orderNumber}
                        </span>
                        <span className="text-[10px] text-text-muted mt-0.5 block">
                          {itemsCount} grocery item{itemsCount === 1 ? '' : 's'}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        ord.orderStatus === 'DELIVERED'
                          ? 'bg-emerald-50 text-status-success border border-emerald-200'
                          : ord.orderStatus === 'CANCELLED'
                          ? 'bg-red-50 text-status-error border border-red-200'
                          : ord.orderStatus === 'OUT_FOR_DELIVERY'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-amber-50 text-status-warning border border-amber-200'
                      }`}
                    >
                      {ord.orderStatus}
                    </span>
                  </div>

                  {/* Customer & Address Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-2 border-t border-border-neutral/60">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider block mb-0.5">
                        Customer & Phone
                      </span>
                      <span className="font-bold text-text-main block truncate">
                        {customerName}
                      </span>
                      <span className="text-[11px] text-text-muted font-mono block">
                        {customerPhone}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider block mb-0.5">
                        Delivery Address
                      </span>
                      <span className="text-text-main line-clamp-1 block">
                        {ord.deliveryAddress?.street || 'Local Address'}
                      </span>
                      <span className="text-[10px] text-text-muted font-medium block">
                        Indore • PIN {ord.deliveryAddress?.pincode || '452001'}
                      </span>
                    </div>
                  </div>

                  {/* Amount, Mode & Date */}
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-border-neutral/60">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider block mb-0.5">
                        Amount & Mode
                      </span>
                      <span className="text-base font-extrabold text-text-main font-mono block leading-tight">
                        ₹{totalRupees}
                      </span>
                      <span className="text-[10px] text-text-muted font-medium block">
                        {ord.payment?.method || 'COD'} • {ord.payment?.status || 'PENDING'}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider block mb-0.5">
                        Order Date
                      </span>
                      <span className="text-text-muted text-[11px] block">
                        {formattedDate}
                      </span>
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => handleOpenStatusModal(ord)}
                      className="w-full py-2 px-3 rounded-xl bg-surface hover:bg-surface-subtle border border-border-neutral text-brand font-bold text-xs transition shadow-xs text-center"
                    >
                      Manage Order Status →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-xs">
              <thead className="bg-surface-subtle text-[11px] uppercase tracking-wider text-text-muted border-b border-border-neutral">
                <tr>
                  <th className="py-3 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={
                        orders.length > 0 &&
                        bulk.getPageSelectionState(orders.map((o) => o._id)).isAllSelected
                      }
                      onChange={() => bulk.toggleSelectPage(orders.map((o) => o._id))}
                      className="rounded accent-brand"
                    />
                  </th>
                  <th className="p-4 font-semibold">Order Number</th>
                  <th className="p-4 font-semibold">Customer & Phone</th>
                  <th className="p-4 font-semibold">Delivery Address</th>
                  <th className="p-4 font-semibold">Amount & Mode</th>
                  <th className="p-4 font-semibold">Order Status</th>
                  <th className="p-4 font-semibold">Date</th>
                  <th className="p-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-neutral">
                {orders.map((ord) => {
                  const totalRupees = ((ord.pricing?.grandTotalPaise || 0) / 100).toFixed(0);
                  const isSelected = bulk.isSelected(ord._id);
                  return (
                    <tr
                      key={ord._id}
                      className={`transition ${isSelected ? 'bg-brand-light/30' : 'hover:bg-surface-subtle/60'}`}
                    >
                      <td className="py-3.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => bulk.toggleSelect(ord._id)}
                          className="rounded accent-brand"
                        />
                      </td>
                      <td className="p-4">
                        <span className="font-mono font-bold text-brand block">{ord.orderNumber}</span>
                        <span className="text-[10px] text-text-muted">{ord.items?.length || 0} grocery items</span>
                      </td>

                      <td className="p-4">
                        <span className="font-bold text-text-main block truncate max-w-[150px]">
                          {ord.deliveryAddress?.recipientName || ord.customer?.name}
                        </span>
                        <span className="text-[11px] text-text-muted font-mono">
                          {ord.deliveryAddress?.phone || ord.customer?.phone}
                        </span>
                      </td>

                      <td className="p-4 max-w-xs">
                        <span className="text-text-main truncate block">
                          {ord.deliveryAddress?.street}
                        </span>
                        <span className="text-[10px] text-text-muted font-medium">
                          Indore • PIN {ord.deliveryAddress?.pincode}
                        </span>
                      </td>

                      <td className="p-4">
                        <span className="text-sm font-bold text-text-main block">₹{totalRupees}</span>
                        <span className="text-[10px] text-text-muted font-medium">
                          {ord.payment?.method} • {ord.payment?.status}
                        </span>
                      </td>

                      <td className="p-4">
                        <span
                          className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider inline-block ${
                            ord.orderStatus === 'DELIVERED'
                              ? 'bg-emerald-50 text-status-success border border-emerald-200'
                              : ord.orderStatus === 'CANCELLED'
                              ? 'bg-red-50 text-status-error border border-red-200'
                              : ord.orderStatus === 'OUT_FOR_DELIVERY'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-amber-50 text-status-warning border border-amber-200'
                          }`}
                        >
                          {ord.orderStatus}
                        </span>
                      </td>

                      <td className="p-4 text-text-muted text-[11px]">
                        {new Date(ord.createdAt).toLocaleString('en-IN', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </td>

                      <td className="p-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenStatusModal(ord)}
                          className="px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-subtle border border-border-neutral text-brand font-semibold text-xs transition shadow-xs"
                        >
                          Manage Status
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Pagination Bar */}
          <div className="px-5 py-3 bg-surface border-t border-border-neutral">
            <Pagination
              currentPage={page}
              totalPages={pagination.totalPages}
              totalOrders={pagination.totalOrders}
              pageSize={6}
              onPageChange={(newPage) => setPage(newPage)}
              loading={loading}
              itemName="orders"
            />
          </div>
        </div>
      )}

      {/* ── Status Transition Modal ───────────────────────────────────────── */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn">
          <div className="relative w-full max-w-lg bg-surface border border-border-neutral rounded-2xl p-6 text-text-main shadow-xl space-y-4">
            <button
              onClick={() => setSelectedOrder(null)}
              className="absolute top-5 right-5 p-2 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-subtle transition"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold font-heading text-text-main">
              Update Order #{selectedOrder.orderNumber}
            </h3>

            {updateError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-status-error">
                <AlertCircle className="w-4 h-4 shrink-0 text-status-error" />
                <span>{updateError}</span>
              </div>
            )}

            <div className="bg-surface-subtle p-4 rounded-xl border border-border-neutral text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-text-muted">Current Status:</span>
                <span className="font-bold text-brand">{selectedOrder.orderStatus}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Customer:</span>
                <span className="font-semibold text-text-main">{selectedOrder.deliveryAddress?.recipientName} (+91 {selectedOrder.deliveryAddress?.phone})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Destination:</span>
                <span className="text-text-main">{selectedOrder.deliveryAddress?.street}, PIN {selectedOrder.deliveryAddress?.pincode}</span>
              </div>
            </div>

            <form onSubmit={handleStatusSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-text-main font-semibold mb-1">New Workflow Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full px-3 py-2.5 bg-primary-bg border border-border-neutral rounded-xl text-text-main font-semibold focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                >
                  <option value="PLACED">1. PLACED (Order Received)</option>
                  <option value="CONFIRMED">2. CONFIRMED (Accepted)</option>
                  <option value="PROCESSING">3. PROCESSING (Packed at Warehouse)</option>
                  <option value="OUT_FOR_DELIVERY">4. OUT_FOR_DELIVERY (En route)</option>
                  <option value="DELIVERED">5. DELIVERED (Fulfilled)</option>
                  <option value="CANCELLED">6. CANCELLED (Release Stock)</option>
                </select>
                <span className="text-[10px] text-text-muted mt-1 block">
                  Cancelling an order automatically restores all reserved inventory back into available stock.
                </span>
              </div>

              <div>
                <label className="block text-text-main font-semibold mb-1">Internal Note / Dispatch Details</label>
                <input
                  type="text"
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  placeholder="e.g. Dispatched with central Indore van, ETA 45 mins"
                  className="w-full px-3 py-2.5 bg-primary-bg border border-border-neutral rounded-xl text-text-main placeholder:text-text-muted focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="flex-1 py-2.5 rounded-xl bg-surface hover:bg-surface-subtle border border-border-neutral text-text-main font-semibold transition"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="flex-1 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-white font-semibold transition disabled:opacity-50 shadow-xs"
                >
                  {updating ? 'Updating...' : 'Save Order State'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Contextual Bulk Action Bar */}
      <BulkActionBar
        selectedCount={bulk.selectedCount}
        totalMatching={pagination.totalOrders}
        currentPageCount={orders.length}
        selectAllMatching={bulk.selectAllMatching}
        onSelectAllMatching={bulk.handleSelectAllMatching}
        onClearSelection={bulk.clearSelection}
        itemName="orders"
        actions={[
          {
            id: 'confirmed',
            label: 'Mark Confirmed',
            icon: CheckCircle2,
            variant: 'primary',
            onClick: () => handleTriggerBulkOrderStatus('CONFIRMED'),
          },
          {
            id: 'processing',
            label: 'Mark Processing',
            icon: Clock,
            variant: 'neutral',
            onClick: () => handleTriggerBulkOrderStatus('PROCESSING'),
          },
          {
            id: 'out_for_delivery',
            label: 'Out for Delivery',
            icon: Truck,
            variant: 'primary',
            onClick: () => handleTriggerBulkOrderStatus('OUT_FOR_DELIVERY'),
          },
          {
            id: 'delivered',
            label: 'Mark Delivered',
            icon: CheckCircle2,
            variant: 'primary',
            onClick: () => handleTriggerBulkOrderStatus('DELIVERED'),
          },
          {
            id: 'cancel',
            label: 'Cancel Orders',
            icon: X,
            variant: 'danger',
            onClick: () => handleTriggerBulkOrderStatus('CANCELLED'),
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
            fetchOrders(page);
          }}
        />
      )}
    </div>
  );
}
