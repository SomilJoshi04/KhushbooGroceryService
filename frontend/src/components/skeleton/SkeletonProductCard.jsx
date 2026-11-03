/**
 * Grocery Product Card & Product Grid Skeletons.
 *
 * Precisely matches the dimensions, typography, pack selector, and button layout
 * of ProductCard.jsx to eliminate cumulative layout shift (CLS).
 *
 * @module components/skeleton/SkeletonProductCard
 */

import React from 'react';
import { SkeletonBase, SkeletonText, SkeletonBadge } from './SkeletonBase.jsx';

/**
 * Individual product card skeleton placeholder.
 */
export function SkeletonProductCard({ className = '' }) {
  return (
    <div
      aria-hidden="true"
      className={`bg-surface border border-border-neutral rounded-xl overflow-hidden flex flex-col justify-between shadow-xs ${className}`}
    >
      {/* Product Image Area */}
      <div className="relative aspect-square w-full bg-surface-subtle border-b border-border-neutral overflow-hidden">
        <SkeletonBase className="w-full h-full rounded-none" />
        {/* Discount Badge Placeholder */}
        <div className="absolute top-2 left-2">
          <SkeletonBadge width="w-12" height="h-4" rounded="rounded" />
        </div>
      </div>

      {/* Product Information Body */}
      <div className="p-3 flex-1 flex flex-col justify-between space-y-2.5">
        <div>
          {/* Brand/category mini indicator */}
          <SkeletonBase className="w-16 h-3 rounded mb-1.5" />

          {/* Product Name (2 lines matching clamped title) */}
          <SkeletonText lines={2} height="h-3.5" gap="gap-1.5" lastLineWidth="w-3/4" />
        </div>

        {/* Variant Pack Selector chip */}
        <SkeletonBase className="w-full h-6 rounded-lg" />

        {/* Price & Action Button Footer */}
        <div className="pt-2 border-t border-border-neutral flex items-center justify-between gap-1.5">
          <div className="flex items-baseline gap-1.5">
            <SkeletonBase className="w-12 h-5 rounded" />
            <SkeletonBase className="w-8 h-3 rounded" />
          </div>
          <SkeletonBase className="w-16 h-7 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/**
 * Product grid placeholder matching responsive storefront breakpoints.
 */
export function SkeletonProductGrid({
  count = 10,
  className = 'grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4',
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading grocery products"
      className={className}
    >
      {[...Array(count)].map((_, idx) => (
        <SkeletonProductCard key={idx} />
      ))}
      <span className="sr-only">Loading grocery products...</span>
    </div>
  );
}

