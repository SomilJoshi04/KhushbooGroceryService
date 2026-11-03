/**
 * Progressive Image Component with Integrated Skeleton Loading.
 *
 * Implements:
 * - Stable container dimensions matching exact aspect ratio to prevent layout shifts (CLS).
 * - Instant detection of cached images (skips skeleton if browser already has asset in cache).
 * - Priority hints (`fetchPriority="high"`, `loading="eager"`) for above-the-fold hero and top product cards.
 * - Smooth opacity transition upon image load completion.
 * - Asynchronous decoding (`decoding="async"`) to unblock the main browser rendering thread.
 * - Fallback image replacement on network or 404 image errors.
 *
 * @module components/skeleton/ImageWithSkeleton
 */

import React, { useState, useEffect, useRef } from 'react';
import { SkeletonBase } from './SkeletonBase.jsx';

const DEFAULT_FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80';

export function ImageWithSkeleton({
  src,
  alt = '',
  className = '',
  containerClassName = '',
  aspectRatio = 'aspect-square',
  fallbackSrc = DEFAULT_FALLBACK_IMAGE,
  loading = 'lazy',
  priority = false,
  decoding = 'async',
  sizes,
  imgRef,
  onLoad,
  onError,
  ...props
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [imageSrc, setImageSrc] = useState(src || fallbackSrc);
  const internalRef = useRef(null);

  // Sync internal image src if src prop changes
  useEffect(() => {
    setImageSrc(src || fallbackSrc);
    setIsLoaded(false);
    setHasError(false);
  }, [src, fallbackSrc]);

  // Check if image is already cached and completed by browser immediately
  useEffect(() => {
    const el = imgRef?.current || internalRef.current;
    if (el && el.complete && el.naturalWidth > 0) {
      setIsLoaded(true);
    }
  }, [imageSrc, imgRef]);

  const handleImageLoad = (e) => {
    setIsLoaded(true);
    if (typeof onLoad === 'function') {
      onLoad(e);
    }
  };

  const handleImageError = (e) => {
    setHasError(true);
    setIsLoaded(true); // Stop skeleton on error
    if (imageSrc !== fallbackSrc) {
      setImageSrc(fallbackSrc);
    }
    if (typeof onError === 'function') {
      onError(e);
    }
  };

  // Determine effective loading & fetchpriority
  const effectiveLoading = priority ? 'eager' : loading;
  const effectiveFetchPriority = priority ? 'high' : 'auto';

  return (
    <div
      className={`relative w-full overflow-hidden ${aspectRatio} ${containerClassName}`}
    >
      {/* Shimmer skeleton overlay while downloading */}
      {!isLoaded && (
        <SkeletonBase
          className="absolute inset-0 w-full h-full rounded-none"
        />
      )}

      {/* Actual image with responsive and performance attributes */}
      <img
        ref={(node) => {
          internalRef.current = node;
          if (typeof imgRef === 'function') {
            imgRef(node);
          } else if (imgRef && typeof imgRef === 'object') {
            imgRef.current = node;
          }
        }}
        src={imageSrc}
        alt={alt}
        loading={effectiveLoading}
        decoding={decoding}
        fetchpriority={effectiveFetchPriority}
        sizes={sizes}
        onLoad={handleImageLoad}
        onError={handleImageError}
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        } ${className}`}
        {...props}
      />
    </div>
  );
}
