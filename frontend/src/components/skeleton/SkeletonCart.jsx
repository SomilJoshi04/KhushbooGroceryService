/**
 * Shopping Cart & Cart Item Skeletons.
 *
 * Matches the layout of CartPage.jsx and CartDrawer.jsx.
 *
 * @module components/skeleton/SkeletonCart
 */

import React from 'react';
import { SkeletonBase, SkeletonText, SkeletonButton } from './SkeletonBase.jsx';

/**
 * Single Cart Item Row Skeleton.
 */
export function SkeletonCartItem({ className = '' }) {
  return (
    <div
      aria-hidden="true"
      className={`p-3.5 sm:p-4 bg-surface border border-border-neutral rounded-xl flex items-center gap-3.5 shadow-2xs ${className}`}
    >
      {/* Thumbnail */}
      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-surface-subtle border border-border-neutral overflow-hidden shrink-0">
        <SkeletonBase className="w-full h-full rounded-none" />
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <SkeletonBase className="h-4 w-3/4 rounded" />
        <SkeletonBase className="h-3 w-20 rounded" />
        <SkeletonBase className="h-4 w-16 rounded font-bold" />
      </div>

      {/* Stepper Placeholder */}
      <div className="shrink-0 flex items-center gap-2">
        <SkeletonBase className="w-20 h-8 rounded-lg" />
      </div>
    </div>
  );
}

/**
 * Complete Cart Page Skeleton Layout.
 */
export function SkeletonCartPage({ className = '' }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading shopping cart"
      className={`w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 ${className}`}
    >
      {/* Page Heading */}
      <div className="flex items-center justify-between mb-6">
        <SkeletonBase className="h-8 w-44 rounded-lg" />
        <SkeletonBase className="h-4 w-28 rounded" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Cart Items List */}
        <div className="lg:col-span-8 space-y-3.5">
          <SkeletonCartItem />
          <SkeletonCartItem />
          <SkeletonCartItem />
        </div>

        {/* Right Column: Order Summary Bill Card */}
        <div className="lg:col-span-4 bg-surface border border-border-neutral rounded-2xl p-5 shadow-xs space-y-4">
          <SkeletonBase className="h-5 w-32 rounded font-bold" />

          {/* Delivery progress bar */}
          <div className="p-3 bg-surface-subtle border border-border-neutral rounded-xl space-y-2">
            <SkeletonBase className="h-3.5 w-4/5 rounded" />
            <SkeletonBase className="h-2 w-full rounded-full" />
          </div>

          {/* Price Rows */}
          <div className="space-y-2.5 pt-2 border-t border-border-neutral text-xs">
            <div className="flex justify-between">
              <SkeletonBase className="h-3.5 w-20 rounded" />
              <SkeletonBase className="h-3.5 w-16 rounded" />
            </div>
            <div className="flex justify-between">
              <SkeletonBase className="h-3.5 w-24 rounded" />
              <SkeletonBase className="h-3.5 w-14 rounded" />
            </div>
            <div className="flex justify-between pt-2 border-t border-border-neutral">
              <SkeletonBase className="h-5 w-24 rounded font-bold" />
              <SkeletonBase className="h-5 w-20 rounded font-bold" />
            </div>
          </div>

          {/* Checkout Button */}
          <div className="pt-2">
            <SkeletonButton height="h-12" width="w-full" rounded="rounded-xl" />
          </div>
        </div>
      </div>
      <span className="sr-only">Loading shopping cart...</span>
    </div>
  );
}

