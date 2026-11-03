import React from 'react';
import { SkeletonBase, SkeletonText, SkeletonTitle, SkeletonButton, SkeletonBadge } from './SkeletonBase.jsx';

/**
 * Metric Card Skeleton
 */
export function SkeletonMetricCard() {
  return (
    <div className="bg-surface border border-border-neutral rounded-xl p-5 space-y-3 shadow-xs">
      <div className="flex items-center justify-between">
        <SkeletonText width="60%" height="h-3.5" />
        <SkeletonBase className="w-8 h-8 rounded-lg" />
      </div>
      <SkeletonTitle height="h-7" width="45%" />
      <SkeletonText width="75%" height="h-2.5" />
    </div>
  );
}

/**
 * Admin Dashboard View Skeleton.
 * Matches the layout of AdminDashboard:
 * - Header title & refresh button
 * - 4 top metric cards
 * - Payment Split & Live Order Workflow Pipeline (grid-cols-1 lg:grid-cols-3)
 * - Low-stock alerts / Recent activity cards
 */
export function SkeletonDashboard() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading dashboard metrics">
      {/* Page Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <SkeletonTitle height="h-8" width="280px" />
          <SkeletonText width="340px" height="h-3" />
        </div>
        <SkeletonButton className="w-36 h-9" />
      </div>

      {/* Top 4 KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <SkeletonMetricCard />
        <SkeletonMetricCard />
        <SkeletonMetricCard />
        <SkeletonMetricCard />
      </div>

      {/* Payment Split & Order Pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payment Channels Card */}
        <div className="bg-surface border border-border-neutral rounded-xl p-6 space-y-4 shadow-xs">
          <SkeletonTitle height="h-4" width="60%" />
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-surface-subtle border border-border-neutral">
              <div className="flex items-center gap-2">
                <SkeletonBase className="w-4 h-4 rounded" />
                <SkeletonText width="130px" height="h-3" />
              </div>
              <SkeletonText width="50px" height="h-4" />
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-surface-subtle border border-border-neutral">
              <div className="flex items-center gap-2">
                <SkeletonBase className="w-4 h-4 rounded" />
                <SkeletonText width="140px" height="h-3" />
              </div>
              <SkeletonText width="60px" height="h-4" />
            </div>
          </div>
          <div className="pt-2 border-t border-border-neutral">
            <SkeletonText width="80%" height="h-2.5" />
          </div>
        </div>

        {/* Live Order Workflow Pipeline */}
        <div className="lg:col-span-2 bg-surface border border-border-neutral rounded-xl p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <SkeletonTitle height="h-4" width="200px" />
            <SkeletonText width="90px" height="h-3" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((step) => (
              <div
                key={step}
                className="p-3.5 bg-surface-subtle rounded-xl border border-border-neutral flex flex-col items-center space-y-2"
              >
                <SkeletonText width="60px" height="h-2.5" />
                <SkeletonTitle height="h-6" width="36px" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Alerts / Quick Table placeholder */}
      <div className="bg-surface border border-border-neutral rounded-xl p-6 space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SkeletonBase className="w-5 h-5 rounded-md" />
            <SkeletonTitle height="h-4" width="220px" />
          </div>
          <SkeletonText width="110px" height="h-3" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="p-3 bg-surface-subtle rounded-xl border border-border-neutral flex items-center justify-between"
            >
              <div className="space-y-1.5 flex-1 pr-4">
                <SkeletonText width="70%" height="h-3.5" />
                <SkeletonText width="45%" height="h-2.5" />
              </div>
              <SkeletonBadge width="w-14" height="h-5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

