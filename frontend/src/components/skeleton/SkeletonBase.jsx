/**
 * Atomic Skeleton Loading Primitives.
 *
 * Implements accessible, lightweight, design-token-matched placeholders
 * with smooth CSS shimmer and reduced-motion fallback.
 *
 * @module components/skeleton/SkeletonBase
 */

import React from 'react';

/**
 * Base skeleton block with shimmer animation.
 */
export function SkeletonBase({
  className = '',
  rounded = 'rounded-md',
  as: Component = 'div',
  ...props
}) {
  return (
    <Component
      aria-hidden="true"
      className={`animate-shimmer ${rounded} ${className}`}
      {...props}
    />
  );
}

/**
 * Single or multi-line skeleton text placeholder.
 */
export function SkeletonText({
  lines = 1,
  className = '',
  height = 'h-3.5',
  width = 'w-full',
  lastLineWidth = 'w-3/4',
  gap = 'gap-2',
}) {
  if (lines <= 1) {
    return <SkeletonBase className={`${height} ${width} rounded-sm ${className}`} />;
  }

  return (
    <div aria-hidden="true" className={`flex flex-col ${gap} ${className}`}>
      {[...Array(lines)].map((_, i) => (
        <SkeletonBase
          key={i}
          className={`${height} rounded-sm ${i === lines - 1 ? lastLineWidth : width}`}
        />
      ))}
    </div>
  );
}

/**
 * Title heading skeleton.
 */
export function SkeletonTitle({
  className = '',
  height = 'h-6',
  width = 'w-2/3',
  rounded = 'rounded-md',
}) {
  return <SkeletonBase className={`${height} ${width} ${rounded} ${className}`} />;
}

/**
 * Button skeleton.
 */
export function SkeletonButton({
  className = '',
  height = 'h-9',
  width = 'w-28',
  rounded = 'rounded-xl',
}) {
  return <SkeletonBase className={`${height} ${width} ${rounded} ${className}`} />;
}

/**
 * Circular or squircle avatar skeleton.
 */
export function SkeletonAvatar({
  size = 'w-10 h-10',
  rounded = 'rounded-full',
  className = '',
}) {
  return <SkeletonBase className={`${size} ${rounded} shrink-0 ${className}`} />;
}

/**
 * Small pill/badge skeleton.
 */
export function SkeletonBadge({
  className = '',
  width = 'w-16',
  height = 'h-5',
  rounded = 'rounded-full',
}) {
  return <SkeletonBase className={`${width} ${height} ${rounded} shrink-0 ${className}`} />;
}

