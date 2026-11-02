/**
 * Admin Dashboard View.
 *
 * Route: /admin/dashboard
 * Aggregates real-time MongoDB statistics: revenue in paise,
 * order status distribution, low-stock warnings, and recent order stream.
 * Styled as a professional, restrained business analytics dashboard with clean white cards
 * and deep forest green accents.
 *
 * @module pages/admin/AdminDashboard
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../config/api.js';
import {
  TrendingUp,
  Package,
  Boxes,
  Users,
  AlertTriangle,
  RefreshCw,
  Banknote,
  CreditCard,
  Clock,
} from 'lucide-react';

export function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/v1/admin/dashboard');
      if (res.data?.success) {
        setStats(res.data.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to load dashboard metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-center">
        <RefreshCw className="w-8 h-8 text-brand animate-spin mb-3" />
        <p className="text-xs text-text-muted">Loading store performance metrics from MongoDB...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-2xl bg-status-error/10 border border-status-error/20 text-status-error text-center space-y-3">
        <p className="text-sm font-semibold">{error}</p>
        <button
          onClick={fetchStats}
          className="px-4 py-2 bg-brand hover:bg-brand-hover text-white rounded-xl text-xs font-bold transition shadow-xs"
        >
          Retry Fetching Metrics
        </button>
      </div>
    );
  }

  const revenuePaidRupees = ((stats?.revenue?.totalPaidPaise || 0) / 100).toFixed(0);
  const codRupees = ((stats?.revenue?.codPaise || 0) / 100).toFixed(0);
  const onlineRupees = ((stats?.revenue?.onlinePaise || 0) / 100).toFixed(0);
  const todaySalesRupees = ((stats?.today?.salesPaise || 0) / 100).toFixed(0);

  return (
    <div className="space-y-8">
      {/* Page Title & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-text-main">
            Store Performance Dashboard
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Real-time grocery business analytics for central Indore operations.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchStats}
          className="self-start sm:self-auto px-3.5 py-2 bg-surface hover:bg-surface-subtle border border-border-neutral text-xs font-semibold text-text-main rounded-xl flex items-center gap-2 transition shadow-xs"
        >
          <RefreshCw className="w-3.5 h-3.5 text-brand" />
          <span>Refresh Analytics</span>
        </button>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Paid Revenue */}
        <div className="bg-surface border border-border-neutral rounded-xl p-5 space-y-2 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-muted">Total Paid Revenue</span>
            <div className="w-8 h-8 rounded-lg bg-brand-light text-brand flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-text-main font-heading">₹{revenuePaidRupees}</div>
          <p className="text-[11px] text-text-muted">
            Online paid & collected deliveries
          </p>
        </div>

        {/* Total Orders */}
        <div className="bg-surface border border-border-neutral rounded-xl p-5 space-y-2 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-muted">Total Orders Placed</span>
            <div className="w-8 h-8 rounded-lg bg-surface-subtle border border-border-neutral text-brand flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-text-main font-heading">{stats?.totalOrders || 0}</div>
          <p className="text-[11px] text-text-muted">
            Delivered: <strong className="text-status-success">{stats?.statusCounts?.DELIVERED || 0}</strong> • Cancelled: {stats?.statusCounts?.CANCELLED || 0}
          </p>
        </div>

        {/* Today's Sales */}
        <div className="bg-surface border border-border-neutral rounded-xl p-5 space-y-2 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-muted">Today's Store Sales</span>
            <div className="w-8 h-8 rounded-lg bg-brand-light text-brand flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-text-main font-heading">₹{todaySalesRupees}</div>
          <p className="text-[11px] text-text-muted">
            {stats?.today?.orderCount || 0} orders received today
          </p>
        </div>

        {/* Active Customers */}
        <div className="bg-surface border border-border-neutral rounded-xl p-5 space-y-2 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-muted">Registered Customers</span>
            <div className="w-8 h-8 rounded-lg bg-surface-subtle border border-border-neutral text-brand flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-text-main font-heading">{stats?.customersCount || 0}</div>
          <p className="text-[11px] text-text-muted">
            Verified Indian mobile numbers
          </p>
        </div>
      </div>

      {/* Payment Split & Order Pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payment Channels */}
        <div className="bg-surface border border-border-neutral rounded-xl p-6 space-y-4 shadow-xs">
          <h3 className="text-sm font-bold font-heading text-text-main">Revenue by Payment Channel</h3>
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 rounded-xl bg-surface-subtle border border-border-neutral">
              <div className="flex items-center gap-2 text-text-main font-medium">
                <Banknote className="w-4 h-4 text-brand" />
                <span>Cash on Delivery (Doorstep)</span>
              </div>
              <span className="font-extrabold text-text-main font-mono">₹{codRupees}</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-surface-subtle border border-border-neutral">
              <div className="flex items-center gap-2 text-text-main font-medium">
                <CreditCard className="w-4 h-4 text-brand" />
                <span>Online Paid (Razorpay)</span>
              </div>
              <span className="font-extrabold text-text-main font-mono">₹{onlineRupees}</span>
            </div>
          </div>

          <div className="pt-2 text-[11px] text-text-muted border-t border-border-neutral">
            Active Catalog: <strong className="text-text-main">{stats?.activeProductsCount || 0}</strong> products published in store.
          </div>
        </div>

        {/* Order Status Stepper Snapshot */}
        <div className="lg:col-span-2 bg-surface border border-border-neutral rounded-xl p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold font-heading text-text-main">Live Order Workflow Pipeline</h3>
            <Link to="/admin/orders" className="text-xs font-bold text-brand hover:underline">
              View All Orders →
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-surface-subtle rounded-xl border border-border-neutral text-center space-y-1">
              <span className="text-[10px] uppercase font-bold text-text-muted">1. Placed</span>
              <div className="text-xl font-extrabold text-brand font-mono">{stats?.statusCounts?.PLACED || 0}</div>
            </div>

            <div className="p-3.5 bg-surface-subtle rounded-xl border border-border-neutral text-center space-y-1">
              <span className="text-[10px] uppercase font-bold text-text-muted">2. Confirmed</span>
              <div className="text-xl font-extrabold text-brand font-mono">{stats?.statusCounts?.CONFIRMED || 0}</div>
            </div>

            <div className="p-3.5 bg-surface-subtle rounded-xl border border-border-neutral text-center space-y-1">
              <span className="text-[10px] uppercase font-bold text-text-muted">3. Processing</span>
              <div className="text-xl font-extrabold text-brand font-mono">{stats?.statusCounts?.PROCESSING || 0}</div>
            </div>

            <div className="p-3.5 bg-surface-subtle rounded-xl border border-border-neutral text-center space-y-1">
              <span className="text-[10px] uppercase font-bold text-text-muted">4. Out for Delivery</span>
              <div className="text-xl font-extrabold text-status-success font-mono">{stats?.statusCounts?.OUT_FOR_DELIVERY || 0}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Low-Stock Critical Alerts */}
      {stats?.lowStockAlerts && stats.lowStockAlerts.length > 0 && (
        <div className="bg-surface border border-border-neutral rounded-xl p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-status-warning" />
              <h3 className="text-sm font-bold font-heading text-text-main">
                Low Stock Alerts ({stats.lowStockAlertsCount} variants below 10 units)
              </h3>
            </div>
            <Link to="/admin/inventory" className="text-xs font-bold text-brand hover:underline">
              Manage Inventory →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {stats.lowStockAlerts.map((alert, idx) => (
              <div
                key={idx}
                className="p-3 bg-surface-subtle rounded-xl border border-border-neutral flex items-center justify-between text-xs"
              >
                <div className="truncate max-w-[200px]">
                  <span className="font-bold text-text-main truncate block">{alert.productName}</span>
                  <span className="text-text-muted font-mono text-[11px]">{alert.sku} ({alert.label})</span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${
                    alert.stock === 0
                      ? 'bg-status-error/10 text-status-error border border-status-error/20'
                      : 'bg-status-warning/10 text-status-warning border border-status-warning/20'
                  }`}
                >
                  {alert.stock === 0 ? 'Out of Stock' : `${alert.stock} left`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Orders Stream */}
      <div className="bg-surface border border-border-neutral rounded-xl p-4 sm:p-6 space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold font-heading text-text-main">Recent Customer Orders</h3>
          <Link to="/admin/orders" className="text-xs font-bold text-brand hover:underline">
            View All ({stats?.totalOrders || 0}) →
          </Link>
        </div>

        {stats?.recentOrders?.length === 0 ? (
          <p className="text-xs text-text-muted py-4 text-center">No orders placed yet.</p>
        ) : (
          <>
            {/* Mobile Card Layout (Shown on mobile screens < md) */}
            <div className="block md:hidden space-y-3">
              {stats.recentOrders.slice(0, 5).map((ord) => {
                const totalRupees = ((ord.pricing?.grandTotalPaise || 0) / 100).toFixed(0);
                const customerName = ord.deliveryAddress?.recipientName || ord.customer?.name || 'Customer';
                const customerPhone = ord.deliveryAddress?.phone || ord.customer?.phone || '—';
                const itemsCount = ord.items?.length || 0;
                const formattedDate = new Date(ord.createdAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                });

                return (
                  <div
                    key={ord._id}
                    className="p-3.5 bg-surface-subtle/70 rounded-xl border border-border-neutral space-y-3 hover:border-brand/30 transition shadow-2xs"
                  >
                    {/* Top Header: Order ID + Status Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider block mb-0.5">
                          Order ID
                        </span>
                        <Link
                          to="/admin/orders"
                          className="font-mono text-xs font-bold text-brand hover:underline break-all block leading-tight"
                        >
                          {ord.orderNumber}
                        </Link>
                      </div>
                      <span
                        className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          ord.orderStatus === 'DELIVERED'
                            ? 'bg-status-success/10 text-status-success border border-status-success/20'
                            : ord.orderStatus === 'CANCELLED'
                            ? 'bg-status-error/10 text-status-error border border-status-error/20'
                            : ord.orderStatus === 'OUT_FOR_DELIVERY'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-brand-light text-brand border border-brand/20'
                        }`}
                      >
                        {ord.orderStatus}
                      </span>
                    </div>

                    {/* Customer & Items/Amount Row */}
                    <div className="grid grid-cols-2 gap-3 text-xs pt-2.5 border-t border-border-neutral/60">
                      <div className="min-w-0">
                        <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider block mb-0.5">
                          Customer
                        </span>
                        <span className="font-bold text-text-main block truncate">
                          {customerName}
                        </span>
                        <span className="text-[11px] text-text-muted font-mono block truncate">
                          {customerPhone}
                        </span>
                      </div>

                      <div className="text-right min-w-0">
                        <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider block mb-0.5">
                          Amount
                        </span>
                        <span className="text-sm font-extrabold text-text-main font-mono block">
                          ₹{totalRupees}
                        </span>
                        <span className="text-[11px] text-text-muted block">
                          {itemsCount} {itemsCount === 1 ? 'item' : 'items'}
                        </span>
                      </div>
                    </div>

                    {/* Footer: Payment & Date */}
                    <div className="flex items-center justify-between text-xs pt-2.5 border-t border-border-neutral/60 text-text-muted">
                      <div className="min-w-0 truncate pr-2">
                        <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider block mb-0.5">
                          Payment
                        </span>
                        <span className="font-semibold text-text-main text-[11px] truncate block">
                          {ord.payment?.method || 'COD'} ({ord.payment?.status || 'PENDING'})
                        </span>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider block mb-0.5">
                          Date
                        </span>
                        <span className="font-medium text-text-main text-[11px] block">
                          {formattedDate}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop / Tablet Table Layout (Hidden on mobile < md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-xs">
                <thead className="text-[11px] uppercase tracking-wider text-text-muted border-b border-border-neutral">
                  <tr>
                    <th className="pb-3 font-semibold">Order ID</th>
                    <th className="pb-3 font-semibold">Customer</th>
                    <th className="pb-3 font-semibold">Items</th>
                    <th className="pb-3 font-semibold">Amount</th>
                    <th className="pb-3 font-semibold">Payment</th>
                    <th className="pb-3 font-semibold">Status</th>
                    <th className="pb-3 font-semibold text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-neutral">
                  {stats.recentOrders.slice(0, 5).map((ord) => (
                    <tr key={ord._id} className="hover:bg-surface-subtle transition">
                      <td className="py-3 font-mono font-bold text-brand">{ord.orderNumber}</td>
                      <td className="py-3">
                        <div className="font-semibold text-text-main truncate max-w-[140px]">
                          {ord.deliveryAddress?.recipientName || ord.customer?.name}
                        </div>
                        <div className="text-[10px] text-text-muted font-mono">
                          {ord.deliveryAddress?.phone || ord.customer?.phone}
                        </div>
                      </td>
                      <td className="py-3 text-text-muted">{ord.items?.length || 0} items</td>
                      <td className="py-3 font-bold text-text-main font-mono">
                        ₹{((ord.pricing?.grandTotalPaise || 0) / 100).toFixed(0)}
                      </td>
                      <td className="py-3">
                        <span className="text-[11px] font-semibold text-text-main">
                          {ord.payment?.method} ({ord.payment?.status})
                        </span>
                      </td>
                      <td className="py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            ord.orderStatus === 'DELIVERED'
                              ? 'bg-status-success/10 text-status-success border border-status-success/20'
                              : ord.orderStatus === 'CANCELLED'
                              ? 'bg-status-error/10 text-status-error border border-status-error/20'
                              : 'bg-brand-light text-brand border border-brand/20'
                          }`}
                        >
                          {ord.orderStatus}
                        </span>
                      </td>
                      <td className="py-3 text-right text-text-muted text-[11px]">
                        {new Date(ord.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
