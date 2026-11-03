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
      <div className="relative h-[210px] sm:h-[250px] md:h-[320px] lg:h-[385px] w-full rounded-2xl sm:rounded-3xl bg-surface border border-border-neutral overflow-hidden shadow-xs flex flex-col justify-between p-6 sm:p-10 md:p-12">
        {/* Full-bleed subtle shimmer background */}
        <SkeletonBase className="absolute inset-0 w-full h-full rounded-none opacity-40 pointer-events-none" />

        {/* Content Area */}
        <div className="relative z-10 max-w-md space-y-3 sm:space-y-4">
          {/* Badge */}
          <SkeletonBadge width="w-24 sm:w-28" height="h-6" rounded="rounded-full" />

          {/* Heading */}
          <SkeletonBase className="h-7 sm:h-9 md:h-11 w-4/5 sm:w-full rounded-lg" />

          {/* Subtitle */}
          <SkeletonBase className="h-3.5 sm:h-4 w-3/4 sm:w-5/6 rounded" />

          {/* CTA Button */}
          <div className="pt-2">
            <SkeletonButton height="h-9 sm:h-10" width="w-32 sm:w-36" rounded="rounded-xl" />
          </div>
        </div>

        {/* Carousel Pagination Dots */}
        <div className="relative z-10 flex justify-center gap-1.5 self-center">
          <SkeletonBase className="w-5 h-2 rounded-full" />
          <SkeletonBase className="w-2 h-2 rounded-full" />
          <SkeletonBase className="w-2 h-2 rounded-full" />
        </div>
      </div>
      <span className="sr-only">Loading promotional banners...</span>
    </div>
  );
}

