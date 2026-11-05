/**
 * Promotional Hero Banner Skeleton.
 *
 * Matches the responsive heights and text hierarchy of PromotionalBannerCarousel.jsx.
 *
 * @module components/skeleton/SkeletonBanner
 */

import React from 'react';
import { SkeletonBase, SkeletonBadge, SkeletonButton } from './SkeletonBase.jsx';

export function SkeletonBanner({ className = '' }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading promotional banners"
      className={`w-full ${className}`}
    >
      <div className="relative w-full aspect-[2/1] sm:aspect-[2.2/1] md:aspect-[2.5/1] lg:aspect-[2.7/1] max-h-[420px] rounded-2xl sm:rounded-3xl bg-surface-subtle border border-border-neutral overflow-hidden shadow-xs flex flex-col justify-end p-4 sm:p-6 md:p-8">
        {/* Full-bleed subtle shimmer background matching promotional image */}
        <SkeletonBase className="absolute inset-0 w-full h-full rounded-none opacity-50 pointer-events-none" />

        {/* Carousel Pagination Dots Placeholder */}
        <div className="relative z-10 flex justify-center gap-1.5 self-center">
          <SkeletonBase className="w-5 h-1.5 sm:h-2 rounded-full" />
          <SkeletonBase className="w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full" />
          <SkeletonBase className="w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full" />
        </div>
      </div>
      <span className="sr-only">Loading promotional banners...</span>
    </div>
  );
}

