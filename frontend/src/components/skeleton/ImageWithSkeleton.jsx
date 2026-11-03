/**
 * Progressive Image Component with Integrated Skeleton Loading.
 *
 * Implements:
 * - Stable container dimensions matching exact aspect ratio to prevent layout shifts (CLS).
 * - Instant detection of cached images (skips skeleton if browser already has asset in cache).
 * - Priority hints (`fetchPriority="high"`, `loading="eager"`) for above-the-fold hero and top cards.
 * - Smooth opacity transition upon image load completion.
 * - Asynchronous decoding (`HTMLImageElement.decode()`) off the main rendering thread.
 * - Safe tokenized cancellation so URL changes and unmounts do not cause stale state updates.
 * - Robust fallback handling with single-attempt failover and infinite loop prevention.
 * - Screen-reader friendly (skeleton is aria-hidden="true").
 *
 * @module components/skeleton/ImageWithSkeleton
 */

import React, { useState, useEffect, useRef } from 'react';
import { SkeletonBase } from './SkeletonBase.jsx';
import { resolveImageUrl, getApiUploadUrl, NEUTRAL_PRODUCT_PLACEHOLDER } from '../../config/api.js';

export function ImageWithSkeleton({
  src,
  alt = '',
  className = '',
  containerClassName = '',
  aspectRatio = 'aspect-square',
  fallbackSrc = NEUTRAL_PRODUCT_PLACEHOLDER,
  loading = 'lazy',
  priority = false,
  decoding = 'async',
  sizes,
  imgRef,
  onLoad,
  onError,
  children,
  ...props
}) {
  const hasValidInitialSrc = Boolean(src && typeof src === 'string' && src.trim().length > 0);
  const resolvedInitialSrc = hasValidInitialSrc ? resolveImageUrl(src) : fallbackSrc;

  // If there is no initial source provided, immediately display fallback without spinning skeleton
  const [isLoaded, setIsLoaded] = useState(!hasValidInitialSrc);
  const [hasError, setHasError] = useState(false);
  const [imageSrc, setImageSrc] = useState(resolvedInitialSrc || fallbackSrc);

  const internalRef = useRef(null);
  const fallbackAttemptedRef = useRef(false);
  const prevSrcRef = useRef(src);
  const srcTokenRef = useRef(0);
  const isUnmountedRef = useRef(false);

  // Sync unmount state
  useEffect(() => {
    isUnmountedRef.current = false;
    return () => {
      isUnmountedRef.current = true;
    };
  }, []);

  // Sync internal image src whenever src or fallbackSrc prop changes
  useEffect(() => {
    if (prevSrcRef.current !== src) {
      prevSrcRef.current = src;
      fallbackAttemptedRef.current = false;
      srcTokenRef.current += 1;

      const hasSrc = Boolean(src && typeof src === 'string' && src.trim().length > 0);
      const nextSrc = hasSrc ? (resolveImageUrl(src) || fallbackSrc) : fallbackSrc;

      setImageSrc(nextSrc);
      setHasError(false);

      setIsLoaded(!hasSrc);
    }
  }, [src, fallbackSrc]);

  // Check if image is already cached by browser memory cache immediately upon mount/src update
  useEffect(() => {
    const el = imgRef?.current || internalRef.current;
    if (!el) return;

    const currentToken = srcTokenRef.current;

    if (el.complete && el.naturalWidth > 0) {
      if (typeof el.decode === 'function') {
        el.decode()
          .then(() => {
            if (!isUnmountedRef.current && currentToken === srcTokenRef.current) {
              setIsLoaded(true);
            }
          })
          .catch(() => {
            if (!isUnmountedRef.current && currentToken === srcTokenRef.current && el.naturalWidth > 0) {
              setIsLoaded(true);
            }
          });
      } else {
        setIsLoaded(true);
      }
    }
  }, [imageSrc, imgRef]);

  // Handle successful image load event with asynchronous decoding
  const handleImageLoad = (e) => {
    const currentToken = srcTokenRef.current;
    const img = e.currentTarget || internalRef.current;

    if (!img) {
      if (!isUnmountedRef.current && currentToken === srcTokenRef.current) {
        setIsLoaded(true);
      }
      return;
    }

    // Attempt off-main-thread bitmap decoding where supported
    if (typeof img.decode === 'function') {
      img.decode()
        .then(() => {
          if (!isUnmountedRef.current && currentToken === srcTokenRef.current) {
            setIsLoaded(true);
            if (typeof onLoad === 'function') {
              onLoad(e);
            }
          }
        })
        .catch((_err) => {
          // If decoding was aborted (e.g. src changed mid-flight or rapid unmount)
          if (isUnmountedRef.current || currentToken !== srcTokenRef.current) return;

          // Verify if image is actually valid and has non-zero natural dimensions
          if (img.naturalWidth > 0 && img.naturalHeight > 0) {
            setIsLoaded(true);
            if (typeof onLoad === 'function') {
              onLoad(e);
            }
          } else {
            // Actual image failure or decoding corruption
            handleImageError(e);
          }
        });
    } else {
      if (!isUnmountedRef.current && currentToken === srcTokenRef.current) {
        setIsLoaded(true);
        if (typeof onLoad === 'function') {
          onLoad(e);
        }
      }
    }
  };

  // Handle image load error with single-attempt failover and infinite loop prevention
  const handleImageError = (e) => {
    const currentToken = srcTokenRef.current;
    if (isUnmountedRef.current || currentToken !== srcTokenRef.current) return;

    // Step 1: Attempt one-time failover via /api/v1/uploads if direct /uploads path failed
    if (!fallbackAttemptedRef.current && src && typeof src === 'string') {
      fallbackAttemptedRef.current = true;
      const apiFallback = getApiUploadUrl(src);
      if (apiFallback && apiFallback !== imageSrc) {
        setImageSrc(apiFallback);
        return;
      }
    }

    // Step 2: Prevent infinite error loop if fallbackSrc also fails
    setHasError(true);
    setIsLoaded(true); // Stop skeleton so user sees the fallback placeholder, not a stuck shimmer

    if (imageSrc !== fallbackSrc) {
      setImageSrc(fallbackSrc);
    }

    if (typeof onError === 'function') {
      onError(e);
    }
  };

  // Determine effective loading and priority hints
  const effectiveLoading = priority ? 'eager' : loading;
  const effectiveFetchPriority = priority ? 'high' : 'auto';

  // Only apply w-full if containerClassName does not already define an explicit width
  const hasExplicitWidth = containerClassName.includes('w-');
  const widthClass = hasExplicitWidth ? '' : 'w-full';

  return (
    <div
      className={`relative overflow-hidden ${widthClass} ${aspectRatio || ''} ${containerClassName}`}
    >
      {/* Shimmer skeleton overlay while downloading */}
      {!isLoaded && (
        <SkeletonBase
          className="absolute inset-0 w-full h-full rounded-none z-0"
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
        className={`w-full h-full object-cover transition-opacity duration-300 relative z-[1] ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        } ${className}`}
        {...props}
      />

      {/* Optional overlays, badges, or controls */}
      {children}
    </div>
  );
}

export default ImageWithSkeleton;
