/**
 * Compact Horizontal Category Section Component.
 *
 * Implements a clean, restrained horizontal carousel:
 * - Uniform category image dimensions with subtle neutral borders.
 * - Restrained green accents for selected/active category.
 * - Small, unobtrusive carousel navigation buttons.
 * - Smooth scroll without page overflow.
 *
 * @module components/CategoryCarousel
 */

import React, { useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { SkeletonCategoryCarousel, ImageWithSkeleton } from './skeleton/index.js';
import { resolveImageUrl, getApiUploadUrl, NEUTRAL_PRODUCT_PLACEHOLDER } from '../config/api.js';

export function CategoryCarousel({
  categories = [],
  activeSlug = '',
  onSelectCategory,
  loading = false,
}) {
  const scrollContainerRef = useRef(null);
  const navigate = useNavigate();

  const handleScroll = (direction) => {
    if (!scrollContainerRef.current) return;
    const scrollAmount = direction === 'left' ? -260 : 260;
    scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  };

  const handleCategoryClick = (category) => {
    if (onSelectCategory) {
      onSelectCategory(category.slug);
    } else {
      navigate(`/categories/${category.slug}`);
    }
  };

  if (loading) {
    return <SkeletonCategoryCarousel count={8} />;
  }

  if (!categories || categories.length === 0) {
    return null;
  }

  return (
    <section className="py-4 sm:py-5 border-b border-border-neutral">
      {/* Header with Title and Scroll Controls */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <h2 className="text-sm sm:text-base font-bold font-heading text-text-main tracking-tight whitespace-nowrap">
            Shop by Category
          </h2>
          <span className="text-[10px] sm:text-[11px] text-text-muted font-medium bg-surface-subtle border border-border-neutral px-1.5 sm:px-2 py-0.5 rounded-full shrink-0">
            <span className="sm:hidden">{categories.length}</span>
            <span className="hidden sm:inline">{categories.length} departments</span>
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Scroll arrow buttons visible on desktop / tablet where swiping with finger doesn't exist */}
          <div className="hidden sm:flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleScroll('left')}
              className="w-7 h-7 rounded-lg bg-surface hover:bg-surface-subtle border border-border-neutral text-text-muted hover:text-text-main flex items-center justify-center transition active:scale-95 shadow-xs"
              aria-label="Scroll Categories Left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => handleScroll('right')}
              className="w-7 h-7 rounded-lg bg-surface hover:bg-surface-subtle border border-border-neutral text-text-muted hover:text-text-main flex items-center justify-center transition active:scale-95 shadow-xs"
              aria-label="Scroll Categories Right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <Link
            to="/categories"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface hover:bg-surface-subtle text-xs font-semibold text-brand border border-border-neutral hover:border-brand/40 transition shadow-xs"
          >
            <span>View All</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Horizontal Carousel */}
      <div
        ref={scrollContainerRef}
        className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 pt-1 scrollbar-none scroll-smooth select-none"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {/* "All Items" Filter Chip if filtering on homepage */}
        {onSelectCategory && (
          <div
            onClick={() => onSelectCategory('All')}
            className={`shrink-0 cursor-pointer flex flex-col items-center text-center transition ${
              activeSlug === 'All' ? 'opacity-100' : 'opacity-80 hover:opacity-100'
            }`}
          >
            <div
              className={`w-16 h-16 rounded-xl p-0.5 border transition flex items-center justify-center shadow-xs ${
                activeSlug === 'All'
                  ? 'border-brand bg-brand-light/50 ring-2 ring-brand/20'
                  : 'border-border-neutral bg-surface hover:border-brand/40'
              }`}
            >
              <div className="w-full h-full rounded-[10px] bg-surface-subtle flex flex-col items-center justify-center text-brand">
                <span className="text-xl">🛒</span>
              </div>
            </div>
            <span
              className={`mt-1.5 text-[11px] font-semibold tracking-tight block max-w-[76px] truncate ${
                activeSlug === 'All' ? 'text-brand font-bold' : 'text-text-main'
              }`}
            >
              All Items
            </span>
          </div>
        )}

        {/* Categories List */}
        {categories.map((cat) => {
          const isSelected = activeSlug === cat.slug;
          return (
            <div
              key={cat._id || cat.slug}
              onClick={() => handleCategoryClick(cat)}
              className={`shrink-0 cursor-pointer flex flex-col items-center text-center transition ${
                isSelected ? 'opacity-100' : 'opacity-85 hover:opacity-100'
              }`}
            >
              <div
                className={`w-16 h-16 rounded-xl p-0.5 border transition overflow-hidden shadow-xs ${
                  isSelected
                    ? 'border-brand bg-brand-light/50 ring-2 ring-brand/20'
                    : 'border-border-neutral bg-surface hover:border-brand/40'
                }`}
              >
                <ImageWithSkeleton
                  src={cat.image}
                  alt={cat.name}
                  aspectRatio="aspect-square"
                  containerClassName="w-full h-full rounded-[10px] bg-surface-subtle"
                  className="w-full h-full object-cover rounded-[10px]"
                />
              </div>

              {/* Category Name */}
              <span
                className={`mt-1.5 text-[11px] font-medium tracking-tight block max-w-[80px] line-clamp-2 leading-tight transition ${
                  isSelected ? 'text-brand font-bold' : 'text-text-main'
                }`}
                title={cat.name}
              >
                {cat.name}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
