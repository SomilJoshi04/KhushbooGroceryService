/**
* Promotional Banner Carousel Component — Khushboo Grocery Storefront.
*
* Implements:
* - Full-width promotional banner presentation preserving complete artwork.
* - Responsive aspect ratio container:
*   - Mobile (320px–480px): aspect-[2/1] (smooth scaling without cropping)
*   - Small Tablet (481px–767px): aspect-[2.3/1]
*   - Tablet (768px–1023px): aspect-[2.6/1]
*   - Desktop (1024px+): aspect-[3/1] with max-h-[420px]
* - Uses edge-to-edge `object-cover` without side pillarboxing or empty gaps.
* - No side-by-side split layout: removes the 58%/42% split that cropped banners on mobile.
* - Intelligent text overlay: displays HTML text over a soft gradient ONLY if `showTextOverlay` is enabled, avoiding text duplication when artwork has its own copy.
* - Full-card clickability leading to banner target link.
* - Auto-rotation (6s) with pause on hover/focus, swipe gestures, and keyboard navigation.
*
* @module components/PromotionalBannerCarousel
*/

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { apiClient, resolveImageUrl, getApiUploadUrl, NEUTRAL_BANNER_PLACEHOLDER } from '../config/api.js';
import { SkeletonBanner } from './skeleton/index.js';
import { swrCache } from '../utils/swrCache.js';

const FALLBACK_BANNER_IMAGE = NEUTRAL_BANNER_PLACEHOLDER;

export function PromotionalBannerCarousel({ className = '' }) {
  const cachedBanners = swrCache.get('banners');
  const [banners, setBanners] = useState(() => cachedBanners?.data || []);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [loading, setLoading] = useState(() => !cachedBanners?.data);

  const touchStartXRef = useRef(0);
  const touchEndXRef = useRef(0);
  const navigate = useNavigate();

  // Load eligible published banners from public API with SWR cache
  useEffect(() => {
    swrCache.fetchWithSWR(
      'banners',
      async () => {
        const res = await apiClient.get('/v1/banners');
        return Array.isArray(res.data?.data) ? res.data.data : [];
      },
      {
        ttlMs: 5 * 60 * 1000,
        onSuccess: (data) => {
          setBanners(data);
          setLoading(false);
        },
        onError: (err) => {
          console.warn('[banners] Could not fetch promotional banners:', err.message);
          setLoading(false);
        },
      }
    );
  }, []);

  const totalBanners = banners.length;

  const goToNext = useCallback(() => {
    if (totalBanners <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % totalBanners);
  }, [totalBanners]);

  const goToPrev = useCallback(() => {
    if (totalBanners <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + totalBanners) % totalBanners);
  }, [totalBanners]);

  // Auto-rotation timer (6 seconds), respects reduced-motion and pauses on hover/focus
  useEffect(() => {
    if (totalBanners <= 1 || isPaused) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) return;

    const timer = setInterval(() => {
      goToNext();
    }, 6000);

    return () => clearInterval(timer);
  }, [totalBanners, isPaused, goToNext]);

  // Touch Swipe handlers
  const handleTouchStart = (e) => {
    touchStartXRef.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e) => {
    touchEndXRef.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    const diff = touchStartXRef.current - touchEndXRef.current;
    const threshold = 50;
    if (diff > threshold) {
      goToNext();
    } else if (diff < -threshold) {
      goToPrev();
    }
  };

  // Content-shaped loading skeleton matches responsive aspect ratio of the loaded banner
  if (loading) {
    return <SkeletonBanner className={className} />;
  }

  // Graceful empty state: render nothing if no eligible banners exist
  if (totalBanners === 0) {
    return null;
  }

  const currentBanner = banners[currentIndex] || banners[0];

  const handleBannerAction = () => {
    const dest = currentBanner.buttonLink || '/categories';
    if (dest.startsWith('http://') || dest.startsWith('https://')) {
      window.location.href = dest;
    } else {
      navigate(dest);
    }
  };

  return (
    <section
      className={`w-full ${className}`}
      aria-roledescription="carousel"
      aria-label="Promotional Banners"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        onClick={handleBannerAction}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleBannerAction();
          }
        }}
        className="relative w-full overflow-hidden rounded-2xl sm:rounded-3xl border border-border-neutral bg-surface shadow-xs transition-all select-none cursor-pointer group focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2"
        title={currentBanner.title ? `Promotional Offer: ${currentBanner.title}` : 'Promotional Offer'}
      >
        {/* Full-Width Clickable Banner Image: edge-to-edge display with zero side spaces and zero infinite loops */}
        <div className="relative w-full aspect-[2/1] sm:aspect-[2.2/1] md:aspect-[2.5/1] lg:aspect-[2.7/1] max-h-[420px] flex items-center justify-center overflow-hidden">
          <img
            key={currentBanner._id || currentIndex}
            src={resolveImageUrl(currentBanner.desktopImage || currentBanner.mobileImage)}
            alt={currentBanner.title || 'Promotional Banner'}
            loading="lazy"
            className="w-full h-full object-cover object-center block pointer-events-none transition-transform duration-500 group-hover:scale-[1.01]"
            onError={(e) => {
              if (e.currentTarget.dataset.failed) return;
              e.currentTarget.dataset.failed = 'true';
              e.currentTarget.src = FALLBACK_BANNER_IMAGE;
            }}
          />
        </div>

        {/* Carousel Navigation Arrows (visible only if multiple banners) */}
        {totalBanners > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goToPrev();
              }}
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-7 h-7 sm:w-10 sm:h-10 rounded-full bg-surface/90 hover:bg-surface border border-border-neutral text-text-main flex items-center justify-center shadow-md transition active:scale-95 focus:outline-none focus:ring-2 focus:ring-brand z-30 cursor-pointer"
              aria-label="Previous promotional banner"
            >
              <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goToNext();
              }}
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-7 h-7 sm:w-10 sm:h-10 rounded-full bg-surface/90 hover:bg-surface border border-border-neutral text-text-main flex items-center justify-center shadow-md transition active:scale-95 focus:outline-none focus:ring-2 focus:ring-brand z-30 cursor-pointer"
              aria-label="Next promotional banner"
            >
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Pagination Indicators / Dots */}
            <div
              className="absolute bottom-2 sm:bottom-3.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-30 px-2.5 sm:px-3 py-1 rounded-full bg-surface/85 backdrop-blur-xs border border-border-neutral/60 shadow-xs"
              role="tablist"
              aria-label="Carousel navigation indicators"
            >
              {banners.map((b, idx) => {
                const isActive = idx === currentIndex;
                return (
                  <button
                    key={b._id || idx}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-label={`Go to slide ${idx + 1}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentIndex(idx);
                    }}
                    className={`transition-all rounded-full cursor-pointer ${isActive
                      ? 'w-5 h-1.5 sm:h-2 bg-brand'
                      : 'w-1.5 sm:w-2 h-1.5 sm:h-2 bg-text-muted/40 hover:bg-text-muted'
                      }`}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

export default PromotionalBannerCarousel;
