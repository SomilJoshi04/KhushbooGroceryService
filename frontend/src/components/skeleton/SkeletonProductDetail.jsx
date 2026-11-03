/**
 * Product Detail Inspection Skeleton.
 *
 * Matches the layout of ProductDetailModal.jsx and ProductDetailPage.jsx.
 *
 * @module components/skeleton/SkeletonProductDetail
 */

import React from 'react';
import {
  SkeletonBase,
  SkeletonText,
  SkeletonTitle,
  SkeletonButton,
  SkeletonBadge,
} from './SkeletonBase.jsx';

export function SkeletonProductDetail({ className = '' }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading product details"
      className={`w-full max-w-5xl mx-auto bg-surface border border-border-neutral rounded-2xl shadow-xl overflow-hidden p-4 sm:p-6 md:p-8 flex flex-col md:flex-row gap-6 md:gap-8 ${className}`}
    >
      {/* Left Column: Image & Delivery Assurance */}
      <div className="md:w-5/12 shrink-0 flex flex-col gap-4">
        <div className="aspect-square w-full rounded-xl bg-surface-subtle overflow-hidden border border-border-neutral shadow-2xs">
          <SkeletonBase className="w-full h-full rounded-none" />
        </div>

        {/* Guarantees Box */}
        <div className="p-3 bg-surface-subtle border border-border-neutral rounded-xl space-y-2">
          <SkeletonBase className="h-4 w-3/4 rounded" />
          <SkeletonBase className="h-4 w-2/3 rounded" />
        </div>
      </div>

      {/* Right Column: Details & Actions */}
      <div className="md:w-7/12 flex-1 flex flex-col justify-between space-y-6">
        <div className="space-y-4">
          {/* Brand & Category Badges */}
          <div className="flex items-center gap-2">
            <SkeletonBadge width="w-20" height="h-5" rounded="rounded" />
            <SkeletonBadge width="w-24" height="h-5" rounded="rounded" />
          </div>

          {/* Product Title */}
          <SkeletonTitle height="h-7 sm:h-8" width="w-4/5" />

          {/* Price & MRP Row */}
          <div className="flex items-baseline gap-3">
            <SkeletonBase className="h-8 w-24 rounded-lg" />
            <SkeletonBase className="h-5 w-16 rounded" />
            <SkeletonBase className="h-5 w-20 rounded-full" />
          </div>

          {/* Pack Size / Variant Selector Chips */}
          <div className="space-y-2 pt-2">
            <SkeletonBase className="h-4 w-28 rounded" />
            <div className="flex flex-wrap gap-2">
              <SkeletonBase className="w-16 h-8 rounded-lg" />
              <SkeletonBase className="w-16 h-8 rounded-lg" />
              <SkeletonBase className="w-16 h-8 rounded-lg" />
            </div>
          </div>

          {/* Stock Indicator */}
          <SkeletonBase className="h-4 w-36 rounded" />
        </div>

        {/* Action Controls & Description */}
        <div className="space-y-5 pt-4 border-t border-border-neutral">
          {/* Stepper + Add Button Row */}
          <div className="flex items-center gap-3">
            <SkeletonBase className="w-28 h-11 rounded-xl" />
            <SkeletonButton height="h-11" width="flex-1" rounded="rounded-xl" />
          </div>

          {/* Description Section */}
          <div className="space-y-2">
            <SkeletonBase className="h-4 w-32 rounded font-bold" />
            <SkeletonText lines={3} height="h-3.5" gap="gap-2" />
          </div>
        </div>
      </div>
      <span className="sr-only">Loading product details...</span>
    </div>
  );
}

