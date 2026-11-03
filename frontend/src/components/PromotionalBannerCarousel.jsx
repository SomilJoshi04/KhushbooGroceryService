/**
 * Promotional Banner Carousel Component — Khushboo Grocery Storefront.
 *
 * Implements:
 * - Strict fixed-height responsive container:
 *   - Desktop (lg+): 385px (matching exact reference screenshot)
 *   - Tablet (md): 320px
 *   - Small Tablet (sm): 250px
 *   - Mobile (<sm): 210px
 * - Consistent split layout: Left text & CTA (vertically centered) + Right image (100% cover with soft gradient fade).
 * - Clamped text lines (line-clamp-2) preventing any banner from expanding or shrinking the container.
 * - Auto-rotation (6s), pauses on hover and keyboard focus, reduced-motion compliant.
 * - Mobile touch swipe gestures.
 * - Stable zero-layout-shift skeleton and graceful empty state.
 *
 * @module components/PromotionalBannerCarousel
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ArrowRight, Sparkles } from 'lucide-react';
import { apiClient } from '../config/api.js';
import { SkeletonBanner } from './skeleton/index.js';
import { swrCache } from '../utils/swrCache.js';

const FALLBACK_BANNER_IMAGE =
  'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80';

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

  // Content-shaped loading skeleton matches EXACT fixed dimensions of the loaded banner
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
      {/* 
        Fixed Dimensions Container:
        - Mobile (<640px): 210px
        - Small Tablet (640-767px): 250px
        - Tablet / Laptop (768-1023px): 320px
        - Desktop (1024px+): 385px (Exact reference size)
      */}
      <div className="h-[210px] sm:h-[250px] md:h-[320px] lg:h-[385px] w-full relative overflow-hidden rounded-2xl sm:rounded-3xl border border-border-neutral bg-surface shadow-xs transition-all select-none">
        
        {/* Banner Split Content: Always 100% height, strictly bounded */}
        <div className="flex flex-row items-stretch justify-between w-full h-full">
          
          {/* Left Text & CTA Section (Vertically Centered) */}
          <div className="w-[58%] sm:w-[55%] md:w-[48%] lg:w-[46%] h-full p-4 sm:p-6 md:p-8 lg:p-12 z-20 flex flex-col justify-center space-y-1.5 sm:space-y-2.5 md:space-y-3.5">
            {/* Promotional Badge */}
            {currentBanner.badge && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-brand-light text-brand border border-brand/20 text-[10px] sm:text-xs font-bold tracking-wide w-fit shrink-0">
                <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-brand" />
                <span>{currentBanner.badge}</span>
              </div>
            )}

            {/* Promotional Heading: Clamped to 2 lines to strictly preserve fixed height */}
            <h2 className="text-base sm:text-xl md:text-2xl lg:text-[32px] xl:text-[34px] font-extrabold font-heading text-text-main tracking-tight leading-[1.18] line-clamp-2 shrink-0">
              {currentBanner.title}
            </h2>

            {/* Promotional Subtitle / Description: Clamped to 2 lines */}
            <p className="text-[11px] sm:text-xs md:text-sm text-text-muted leading-relaxed line-clamp-2 max-w-md shrink-0">
              {currentBanner.subtitle}
            </p>

            {/* CTA Button */}
            <div className="pt-0.5 sm:pt-1">
              <button
                type="button"
                onClick={handleBannerAction}
                className="inline-flex items-center gap-1.5 sm:gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 md:px-5 md:py-2.5 lg:px-6 lg:py-3 rounded-xl bg-brand hover:bg-brand-hover text-white text-[11px] sm:text-xs md:text-sm font-bold shadow-xs transition active:scale-98 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 w-fit shrink-0 cursor-pointer"
              >
                <span>{currentBanner.buttonText || 'Shop Now'}</span>
                <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>
          </div>

          {/* Right Imagery Section: Strictly 100% height, width-bounded, object-cover */}
          <div className="w-[42%] sm:w-[45%] md:w-[52%] lg:w-[54%] h-full relative overflow-hidden bg-surface-subtle">
            <picture className="w-full h-full block">
              {currentBanner.mobileImage && (
                <source media="(max-width: 767px)" srcSet={currentBanner.mobileImage} />
              )}
              <img
                key={currentBanner._id || currentIndex}
                src={currentBanner.desktopImage}
                alt={currentBanner.title}
                loading="lazy"
                className="w-full h-full object-cover object-center block pointer-events-none transition-opacity duration-300"
                onError={(e) => {
                  e.currentTarget.src = FALLBACK_BANNER_IMAGE;
                }}
              />
            </picture>

            {/* 
              Controlled gradient overlay:
              Smooth transition from the clean surface card on the left into the photography on the right.
            */}
            <div className="absolute inset-y-0 left-0 w-16 sm:w-24 md:w-36 lg:w-48 bg-gradient-to-r from-surface via-surface/60 to-transparent pointer-events-none z-10" />
          </div>
        </div>

        {/* Carousel Navigation Arrows (visible only if multiple banners) */}
        {totalBanners > 1 && (
          <>
            <button
              type="button"
              onClick={goToPrev}
              className="absolute left-2.5 sm:left-4 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-surface/90 hover:bg-surface border border-border-neutral text-text-main flex items-center justify-center shadow-md transition active:scale-95 focus:outline-none focus:ring-2 focus:ring-brand z-30 cursor-pointer"
              aria-label="Previous promotional banner"
            >
              <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            <button
              type="button"
              onClick={goToNext}
              className="absolute right-2.5 sm:right-4 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-surface/90 hover:bg-surface border border-border-neutral text-text-main flex items-center justify-center shadow-md transition active:scale-95 focus:outline-none focus:ring-2 focus:ring-brand z-30 cursor-pointer"
              aria-label="Next promotional banner"
            >
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Pagination Indicators / Dots */}
            <div
              className="absolute bottom-2.5 sm:bottom-3.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-30 px-2.5 sm:px-3 py-1 rounded-full bg-surface/85 backdrop-blur-xs border border-border-neutral/60 shadow-xs"
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
                    onClick={() => setCurrentIndex(idx)}
                    className={`transition-all rounded-full cursor-pointer ${
                      isActive
                        ? 'w-5 h-2 bg-brand'
                        : 'w-2 h-2 bg-text-muted/40 hover:bg-text-muted'
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
