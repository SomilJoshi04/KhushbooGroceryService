/**
 * Category Card, Category Grid, and Category Carousel Skeletons.
 *
 * Matches the layout of CategoriesPage.jsx and CategoryCarousel.jsx.
 *
 * @module components/skeleton/SkeletonCategoryCard
 */

import React from 'react';
import { SkeletonBase, SkeletonText, SkeletonTitle } from './SkeletonBase.jsx';

/**
 * Category Card Skeleton for CategoriesPage.
 */
export function SkeletonCategoryCard({ className = '' }) {
  return (
    <div
      aria-hidden="true"
      className={`bg-surface border border-border-neutral rounded-2xl p-5 space-y-4 shadow-xs ${className}`}
    >
      {/* Category Image */}
      <div className="aspect-4/3 w-full bg-surface-subtle rounded-xl overflow-hidden">
        <SkeletonBase className="w-full h-full rounded-none" />
      </div>

      {/* Category Title & Description */}
      <div className="space-y-2">
        <SkeletonTitle height="h-5" width="w-2/3" />
        <SkeletonText lines={2} height="h-3" lastLineWidth="w-4/5" />
      </div>

      {/* Action link */}
      <div className="pt-2 border-t border-border-neutral">
        <SkeletonBase className="h-4 w-28 rounded" />
      </div>
    </div>
  );
}

/**
 * Category Grid Skeleton.
 */
export function SkeletonCategoryGrid({
  count = 8,
  className = 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6',
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading grocery departments"
      className={className}
    >
      {[...Array(count)].map((_, idx) => (
        <SkeletonCategoryCard key={idx} />
      ))}
      <span className="sr-only">Loading grocery departments...</span>
    </div>
  );
}

/**
 * Category Carousel Horizontal Track Skeleton for Storefront Homepage.
 */
export function SkeletonCategoryCarousel({ count = 8, className = '' }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading category carousel"
      className={`py-4 border-b border-border-neutral ${className}`}
    >
      {/* Section Header */}
      <div className="flex items-center justify-between mb-3">
        <SkeletonBase className="h-5 w-36 rounded" />
        <SkeletonBase className="h-5 w-16 rounded" />
      </div>

      {/* Horizontal Carousel Track */}
      <div className="flex gap-4 overflow-hidden">
        {[...Array(count)].map((_, idx) => (
          <div key={idx} className="shrink-0 flex flex-col items-center gap-2">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl bg-surface-subtle border border-border-neutral overflow-hidden shadow-xs">
              <SkeletonBase className="w-full h-full rounded-none" />
            </div>
            <SkeletonBase className="w-14 h-2.5 rounded" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading categories...</span>
    </div>
  );
}

