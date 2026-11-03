import React from 'react';
import { SkeletonBase, SkeletonText, SkeletonTitle, SkeletonButton, SkeletonAvatar, SkeletonBadge } from './SkeletonBase.jsx';

/**
 * Order Card Skeleton for Customer Account Order History.
 * Matches AccountPage order card layout.
 */
export function SkeletonOrderCard() {
  return (
    <div className="bg-surface border border-border-neutral rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-neutral pb-3">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <SkeletonBadge width="w-24" height="h-5" />
            <SkeletonBadge width="w-20" height="h-5" />
          </div>
          <SkeletonText width="160px" height="h-3" />
        </div>

        <div className="space-y-1 text-left sm:text-right">
          <SkeletonTitle height="h-5" width="80px" className="sm:ml-auto" />
          <SkeletonText width="100px" height="h-3" className="sm:ml-auto" />
        </div>
      </div>

      {/* Items list preview */}
      <div className="space-y-2 py-1">
        {[1, 2].map((idx) => (
          <div key={idx} className="flex items-center justify-between text-xs py-1">
            <div className="flex items-center gap-2">
              <SkeletonBase className="w-5 h-5 rounded-md shrink-0" />
              <SkeletonText width="180px" height="h-3" />
            </div>
            <SkeletonText width="50px" height="h-3" />
          </div>
        ))}
      </div>

      {/* Action footer */}
      <div className="pt-3 border-t border-border-neutral flex flex-wrap items-center justify-between gap-2">
        <SkeletonText width="120px" height="h-3" />
        <div className="flex items-center gap-2">
          <SkeletonButton className="w-24 h-8" />
          <SkeletonButton className="w-24 h-8" />
        </div>
      </div>
    </div>
  );
}

/**
 * Order List Skeleton (multiple cards)
 */
export function SkeletonOrderList({ count = 3 }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading your order history">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonOrderCard key={i} />
      ))}
    </div>
  );
}

/**
 * Address Card Skeleton
 */
export function SkeletonAddressCard() {
  return (
    <div className="bg-surface border border-border-neutral rounded-2xl p-5 space-y-3 shadow-xs">
      <div className="flex items-center justify-between">
        <SkeletonBadge width="w-16" height="h-5" />
        <SkeletonBase className="w-5 h-5 rounded-full" />
      </div>
      <SkeletonTitle height="h-4" width="70%" />
      <SkeletonText width="90%" height="h-3" />
      <SkeletonText width="60%" height="h-3" />
      <div className="pt-2 flex items-center gap-2">
        <SkeletonButton className="w-20 h-7" />
        <SkeletonButton className="w-16 h-7" />
      </div>
    </div>
  );
}

/**
 * Full Customer Account Page Skeleton.
 * Shown during authLoading or initial account fetch.
 */
export function SkeletonAccountPage() {
  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-8" aria-busy="true" aria-label="Loading account profile">
      {/* Profile Header Card */}
      <div className="bg-surface border border-border-neutral rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row items-center sm:items-start gap-5">
        <SkeletonAvatar size="w-20 h-20" />
        <div className="space-y-2 text-center sm:text-left flex-1">
          <SkeletonTitle height="h-6" width="180px" className="mx-auto sm:mx-0" />
          <SkeletonText width="140px" height="h-3" className="mx-auto sm:mx-0" />
          <SkeletonBadge width="w-28" height="h-5" className="mx-auto sm:mx-0" />
        </div>
        <SkeletonButton className="w-28 h-9" />
      </div>

      {/* Tabs navigation pill bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-border-neutral">
        {[1, 2, 3, 4, 5].map((tab) => (
          <SkeletonBase key={tab} className="h-9 w-28 rounded-xl shrink-0" />
        ))}
      </div>

      {/* Main Tab Content */}
      <div className="space-y-4">
        <SkeletonOrderList count={3} />
      </div>
    </div>
  );
}

