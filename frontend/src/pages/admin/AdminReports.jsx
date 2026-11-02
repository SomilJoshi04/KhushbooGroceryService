/**
 * Admin Reports & Analytics View.
 *
 * Route: /admin/reports
 * Aggregates real database sales, payment mode distribution, daily order trends,
 * and top-performing grocery products from MongoDB Atlas.
 *
 * @module pages/admin/AdminReports
 */

import React, { useState, useEffect } from 'react';
import { apiClient } from '../../config/api.js';
import {
  BarChart3,
  TrendingUp,
  CreditCard,
  Banknote,
  Package,
  Calendar,
  IndianRupee,
  RefreshCw,
  ShoppingBag,
  Award,
  AlertCircle,
} from 'lucide-react';
import { Pagination } from '../../components/Pagination.jsx';

export function AdminReports() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [productsPage, setProductsPage] = useState(1);
  const [productsPageSize, setProductsPageSize] = useState(10);

  const fetchReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/v1/admin/reports', {
        params: {
          productsPage,
          productsLimit: productsPageSize,
        },
      });
      if (res.data?.success && res.data?.data) {
        setData(res.data.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to load statistical reports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [productsPage, productsPageSize]);

  if (loading && !data) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-text-muted">
        <RefreshCw className="w-8 h-8 animate-spin text-brand mb-3" />
        <p className="text-xs font-medium">Computing database reports & aggregations...</p>
      </div>
    );
  }

  const { ordersByPayment = [], recentDaysSales = [], topSellingProducts = [] } = data || {};

  // Calculations
  const totalReportedRevenuePaise = ordersByPayment.reduce((acc, curr) => acc + (curr.revenuePaise || 0), 0);
  const totalReportedOrders = ordersByPayment.reduce((acc, curr) => acc + (curr.count || 0), 0);
  const avgOrderValueRupees =
    totalReportedOrders > 0 ? (totalReportedRevenuePaise / totalReportedOrders / 100).toFixed(0) : 0;

  // Max daily revenue for relative bar heights
  const maxDayRevenue = Math.max(...recentDaysSales.map((d) => d.revenuePaise || 0), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-text-main flex items-center gap-2.5">
            <BarChart3 className="w-6 h-6 text-brand" />
            Reports & Business Intelligence
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Real sales trends, payment mode splits, and product performance computed from verified MongoDB records.
          </p>
        </div>

        <button
          onClick={fetchReports}
          className="p-2.5 rounded-xl bg-surface border border-border-neutral text-text-muted hover:text-text-main hover:bg-surface-subtle transition self-start sm:self-auto flex items-center gap-2 text-xs font-semibold shadow-xs"
        >
          <RefreshCw className={`w-4 h-4 text-text-muted ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-status-error text-xs flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface border border-border-neutral rounded-2xl p-5 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted block mb-1">
            Lifetime Net Revenue
          </span>
          <div className="text-2xl font-bold font-heading text-text-main font-mono">
            ₹{(totalReportedRevenuePaise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <span className="text-[10px] text-status-success font-semibold mt-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            Excludes cancelled orders
          </span>
        </div>

        <div className="bg-surface border border-border-neutral rounded-2xl p-5 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted block mb-1">
            Total Completed Orders
          </span>
          <div className="text-2xl font-bold font-heading text-text-main font-mono">
            {totalReportedOrders}
          </div>
          <span className="text-[10px] text-text-muted font-medium mt-1 block">
            Across central Indore delivery zones
          </span>
        </div>

        <div className="bg-surface border border-border-neutral rounded-2xl p-5 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted block mb-1">
            Average Order Value (AOV)
          </span>
          <div className="text-2xl font-bold font-heading text-text-main font-mono">
            ₹{avgOrderValueRupees}
          </div>
          <span className="text-[10px] text-text-muted font-medium mt-1 block">
            Average basket size per order
          </span>
        </div>
      </div>

      {/* Grid: Daily Sales Trend & Payment Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Sales Chart Table */}
        <div className="lg:col-span-2 bg-surface border border-border-neutral rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold font-heading text-text-main flex items-center gap-2">
                <Calendar className="w-4 h-4 text-brand" />
                Recent Daily Sales Activity
              </h2>
              <p className="text-[11px] text-text-muted mt-0.5">
                Real date-by-date order count and gross sales volume.
              </p>
            </div>
            <span className="text-[11px] text-text-muted font-mono">Past 14 Days</span>
          </div>

          {recentDaysSales.length === 0 ? (
            <div className="py-12 text-center text-xs text-text-muted">
              No recent order activity recorded.
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              {recentDaysSales.map((day) => {
                const dayRupees = (day.revenuePaise / 100).toFixed(0);
                const percent = Math.min(100, Math.max(8, Math.round((day.revenuePaise / maxDayRevenue) * 100)));

                return (
                  <div key={day._id} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-mono text-text-main font-semibold">{day._id}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-text-muted text-[11px]">{day.orders} {day.orders === 1 ? 'order' : 'orders'}</span>
                        <span className="text-text-main font-mono font-bold">₹{Number(dayRupees).toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                    <div className="w-full h-2 bg-surface-subtle rounded-full overflow-hidden border border-border-neutral">
                      <div
                        className="h-full bg-brand rounded-full transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Payment Channels Card */}
        <div className="bg-surface border border-border-neutral rounded-2xl p-6 shadow-xs space-y-4">
          <div>
            <h2 className="text-sm font-bold font-heading text-text-main flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-brand" />
              Payment Methods Breakdown
            </h2>
            <p className="text-[11px] text-text-muted mt-0.5">
              Cash on delivery vs. verified online payments.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            {ordersByPayment.map((p) => {
              const share = totalReportedRevenuePaise > 0
                ? Math.round((p.revenuePaise / totalReportedRevenuePaise) * 100)
                : 0;

              return (
                <div key={p._id} className="p-3.5 bg-surface-subtle rounded-xl border border-border-neutral space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {p._id === 'COD' ? (
                        <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 text-status-success flex items-center justify-center">
                          <Banknote className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center">
                          <CreditCard className="w-4 h-4" />
                        </div>
                      )}
                      <div>
                        <span className="text-xs font-bold text-text-main block">
                          {p._id === 'COD' ? 'Cash on Delivery (COD)' : 'Online / UPI Paid'}
                        </span>
                        <span className="text-[10px] text-text-muted">{p.count} orders</span>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-brand">
                      {share}%
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-xs pt-1 border-t border-border-neutral">
                    <span className="text-text-muted text-[11px]">Total Volume:</span>
                    <span className="font-mono text-text-main font-semibold">
                      ₹{((p.revenuePaise || 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Best-Selling Grocery Products */}
      <div className="bg-surface border border-border-neutral rounded-2xl p-6 shadow-xs space-y-4">
        <div>
          <h2 className="text-sm font-bold font-heading text-text-main flex items-center gap-2">
            <Award className="w-4 h-4 text-brand" />
            Top-Performing Grocery Catalog Items
          </h2>
          <p className="text-[11px] text-text-muted mt-0.5">
            Ranked by total units fulfilled across all orders.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[550px] text-left text-xs text-text-main">
            <thead className="bg-surface-subtle border-b border-border-neutral text-[11px] uppercase tracking-wider text-text-muted">
              <tr>
                <th className="px-5 py-3 font-semibold">Rank</th>
                <th className="px-5 py-3 font-semibold">Product Name</th>
                <th className="px-5 py-3 font-semibold text-center">Units Sold</th>
                <th className="px-5 py-3 font-semibold text-right">Generated Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-neutral font-medium">
              {topSellingProducts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-text-muted">
                    No sales data available yet.
                  </td>
                </tr>
              ) : (
                topSellingProducts.map((p, idx) => (
                  <tr key={p._id || idx} className="hover:bg-surface-subtle/60 transition">
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg text-xs font-bold ${
                        idx === 0 ? 'bg-brand-light text-brand border border-brand/20' :
                        idx === 1 ? 'bg-surface-subtle text-text-main border border-border-neutral' :
                        idx === 2 ? 'bg-amber-50 text-status-warning border border-amber-200' : 'text-text-muted'
                      }`}>
                        {idx + 1}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-bold text-text-main">
                      {p._id || 'Unknown Item'}
                    </td>
                    <td className="px-5 py-3 text-center font-mono text-brand font-bold">
                      {p.totalUnitsSold} packs
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-text-main font-bold">
                      ₹{((p.revenuePaise || 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {data?.pagination && data.pagination.totalRecords > 0 && (
          <div className="pt-2">
            <Pagination
              currentPage={productsPage}
              totalPages={data.pagination.totalPages}
              totalRecords={data.pagination.totalRecords}
              pageSize={productsPageSize}
              onPageChange={(p) => setProductsPage(p)}
              onPageSizeChange={(sz) => {
                setProductsPageSize(sz);
                setProductsPage(1);
              }}
              pageSizeOptions={[5, 10, 20]}
              loading={loading}
              itemName="products"
            />
          </div>
        )}
      </div>
    </div>
  );
}
