/**
 * Home Page — Main Grocery Discovery & Storefront.
 *
 * Combines horizontal category carousel, search, filterable catalog,
 * and delivery guarantees for Indore residents.
 * Styled with warm ivory background, white product cards, and deep forest green accents.
 *
 * @module pages/HomePage
 */

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiClient } from '../config/api.js';
import { CategoryCarousel } from '../components/CategoryCarousel.jsx';
import { PromotionalBannerCarousel } from '../components/PromotionalBannerCarousel.jsx';
import { ProductCard } from '../components/ProductCard.jsx';
import { ProductDetailModal } from '../components/ProductDetailModal.jsx';
import { SkeletonProductGrid } from '../components/skeleton/index.js';
import { swrCache } from '../utils/swrCache.js';
import { Search, ShoppingBag, ArrowUpDown, X } from 'lucide-react';
import { useStoreSettings } from '../context/StoreSettingsContext.jsx';

export function HomePage({ onOpenAuth }) {
  const { settings } = useStoreSettings();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSearch = searchParams.get('search') || '';

  const defaultCacheKey = 'products:All:newest:false:';
  const initialProductsCached = swrCache.get(defaultCacheKey);
  const initialCategoriesCached = swrCache.get('categories');

  const [categories, setCategories] = useState(() => initialCategoriesCached?.data || []);
  const [products, setProducts] = useState(() => initialProductsCached?.data || []);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [sortOption, setSortOption] = useState('newest');
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [loading, setLoading] = useState(() => !initialProductsCached?.data);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(() => !initialCategoriesCached?.data);
  const [error, setError] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const abortControllerRef = React.useRef(null);
  const categoryCarouselRef = React.useRef(null);
  const productSectionRef = React.useRef(null);
  const scrollAnimationRef = React.useRef(null);

  // Clean up any pending scroll animations on unmount
  useEffect(() => {
    return () => {
      if (scrollAnimationRef.current) {
        cancelAnimationFrame(scrollAnimationRef.current);
      }
    };
  }, []);

  /**
   * Smart check to determine if the product section is already sufficiently visible in the viewport.
   * - In Scenario A (user at top of page, products below fold): returns false -> trigger auto-scroll.
   * - In Scenario B (user already scrolled down browsing products): returns true -> do not scroll.
   */
  const isProductSectionSufficientlyVisible = (el) => {
    if (!el) return true;
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;

    // If top of product section is below 40% of viewport height (or > 300px),
    // product cards are hidden below the fold.
    const isTooFarDown = rect.top > Math.min(300, vh * 0.4);
    const isOffscreenBottom = rect.top >= vh;

    return !isTooFarDown && !isOffscreenBottom;
  };

  /**
   * Handles user tapping on a category from the category carousel.
   * Implements conditional smart scrolling without layout shifts or unwanted jumps.
   */
  const handleCategorySelect = (slug) => {
    // Scenario C: Do nothing if tapping the currently active category
    if (slug === selectedCategory) {
      return;
    }

    const isMobileViewport = typeof window !== 'undefined' && window.innerWidth < 1024;
    const alreadyVisible = isProductSectionSufficientlyVisible(productSectionRef.current);

    setSelectedCategory(slug);

    // Scenario B & Desktop: Preserve current browsing position if already visible or on desktop
    if (!isMobileViewport || alreadyVisible) {
      return;
    }

    // Scenario A: Customer is at the top of the homepage and products are below the fold
    if (scrollAnimationRef.current) {
      cancelAnimationFrame(scrollAnimationRef.current);
    }

    scrollAnimationRef.current = requestAnimationFrame(() => {
      const targetEl = categoryCarouselRef.current || productSectionRef.current;
      if (!targetEl) return;

      const headerEl = document.querySelector('header');
      const headerHeight = headerEl ? headerEl.getBoundingClientRect().height : 64;

      const targetTop = targetEl.getBoundingClientRect().top + window.pageYOffset;
      const finalScrollY = Math.max(0, targetTop - headerHeight - 6);

      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      window.scrollTo({
        top: finalScrollY,
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
      });
    });
  };

  // Sync search input if URL search param changes
  useEffect(() => {
    if (initialSearch !== searchQuery) {
      setSearchQuery(initialSearch);
    }
  }, [initialSearch]);

  // Close product detail modal when authentication modal opens
  useEffect(() => {
    const handleAuthOpen = () => {
      setSelectedProduct(null);
    };
    window.addEventListener('khushboo:open_auth', handleAuthOpen);
    return () => window.removeEventListener('khushboo:open_auth', handleAuthOpen);
  }, []);

  const handleClearSearch = () => {
    setSearchQuery('');
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('search');
    setSearchParams(newParams, { replace: true });
  };

  // Load Categories with SWR cache
  useEffect(() => {
    swrCache.fetchWithSWR(
      'categories',
      async () => {
        const res = await apiClient.get('/v1/categories');
        return Array.isArray(res.data?.data) ? res.data.data : [];
      },
      {
        ttlMs: 5 * 60 * 1000,
        onSuccess: (data) => {
          setCategories(data);
          setCategoriesLoading(false);
        },
        onError: (err) => {
          console.error('[home] Error loading categories:', err.message);
          setCategoriesLoading(false);
        },
      }
    );
  }, []);

  // Fetch Products matching filters with debouncing, AbortController, and SWR caching
  useEffect(() => {
    const trimmedSearch = searchQuery.trim();
    const cacheKey = `products:${selectedCategory}:${sortOption}:${onlyInStock}:${trimmedSearch}`;
    const cached = swrCache.get(cacheKey);

    // If cached data is present, display immediately (0ms)
    if (cached && cached.data) {
      setProducts(cached.data);
      setLoading(false);
      setError(null);
      if (!cached.isStale) {
        return;
      }
      setIsRevalidating(true);
    } else {
      setLoading(true);
      setError(null);
    }

    const timer = setTimeout(async () => {
      // Abort previous in-flight request if user is filtering or typing rapidly
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const params = { sort: sortOption };
        if (selectedCategory && selectedCategory !== 'All') {
          params.category = selectedCategory;
        }
        if (trimmedSearch) {
          params.search = trimmedSearch;
        }
        if (onlyInStock) {
          params.inStock = 'true';
        }

        const res = await apiClient.get('/v1/products', {
          params,
          signal: controller.signal,
        });

        if (res.data?.success && Array.isArray(res.data.data)) {
          setProducts(res.data.data);
          swrCache.set(cacheKey, res.data.data, 3 * 60 * 1000);
        } else {
          setProducts([]);
        }
      } catch (err) {
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
          return;
        }
        setError(err.message || 'Failed to load grocery items.');
      } finally {
        setLoading(false);
        setIsRevalidating(false);
      }
    }, trimmedSearch ? 250 : 0);

    return () => {
      clearTimeout(timer);
    };
  }, [selectedCategory, sortOption, onlyInStock, searchQuery]);

  return (
    <div className="min-h-screen pb-16 bg-primary-bg text-text-main">
      {/* Hero Banner Section */}
      <section className="bg-surface-subtle border-b border-border-neutral">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="max-w-2xl text-center md:text-left space-y-4">
            <div className="inline-flex items-center px-3.5 py-1.5 rounded-full bg-brand-light text-brand border border-brand/20 text-xs font-bold tracking-wide">
              <span>{settings.tagline || '100% Pure & Stone-Ground Groceries'}</span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold font-heading text-text-main tracking-tight leading-tight">
              Fresh Daily Grocery Essentials <br className="hidden sm:inline" />
              <span className="text-brand">Delivered in {settings.serviceCity || 'Indore'}</span>
            </h1>
            <p className="text-sm sm:text-base text-text-muted leading-relaxed">
              Premium Sharbati Whole Wheat Flour, Stone-Ground Gram Flour, Unpolished Pulses, Whole Spices, and Pure Cow Ghee. Free delivery to your doorstep on orders above ₹{settings.freeDeliveryThresholdRupees}.
            </p>
          </div>

          {/* Service Guarantee Card */}
          <div className="bg-surface border border-border-neutral rounded-2xl p-5 shadow-xs shrink-0 w-full sm:w-80 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-brand">
              <span className="text-base">📍</span>
              <span>Express {settings.serviceCity || 'Indore'} Dispatch</span>
            </div>
            <div className="text-xs text-text-main space-y-1.5">
              <div className="flex justify-between border-b border-border-neutral pb-1.5">
                <span className="text-text-muted">Central Hub:</span>
                <span className="font-semibold text-text-main truncate max-w-[170px]" title={settings.address}>
                  {settings.centralHub || 'Geeta Bhawan, MG Road'}
                </span>
              </div>
              <div className="flex justify-between border-b border-border-neutral pb-1.5">
                <span className="text-text-muted">Speed:</span>
                <span className="font-semibold text-brand">
                  {settings.estimatedDeliveryWindow || '90–120 Minutes'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Min Order:</span>
                <span className="font-semibold text-text-main">
                  ₹{settings.minOrderAmountRupees}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 pt-2">
        {/* Active Promotional Banners */}
        <PromotionalBannerCarousel />

        {/* Horizontal Category Carousel Section */}
        <div ref={categoryCarouselRef} className="scroll-mt-20">
          <CategoryCarousel
            categories={categories}
            activeSlug={selectedCategory}
            onSelectCategory={handleCategorySelect}
            loading={categoriesLoading}
          />
        </div>

        {/* Toolbar: Category Title / Active Search Filter, Sort, and In-Stock Toggle */}
        <div
          ref={productSectionRef}
          className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 bg-surface p-3.5 sm:p-4 rounded-2xl border border-border-neutral shadow-xs scroll-mt-20"
        >
          {/* Left: Active Search Filter Chip OR Category Heading */}
          <div className="flex items-center justify-between sm:justify-start gap-2 min-w-0">
            {searchQuery ? (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-brand-light border border-brand/20 text-brand text-xs font-semibold shadow-xs">
                <Search className="w-3.5 h-3.5 text-brand shrink-0" />
                <span className="truncate">
                  Results for: <strong className="font-bold font-mono">"{searchQuery}"</strong>
                </span>
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="w-4 h-4 rounded-full hover:bg-brand/20 flex items-center justify-center transition text-brand cursor-pointer ml-1 shrink-0"
                  title="Clear search filter"
                  aria-label="Clear search filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm sm:text-base font-bold font-heading text-text-main truncate">
                  {selectedCategory === 'All'
                    ? 'All Grocery Essentials'
                    : categories.find((c) => c.slug === selectedCategory)?.name || selectedCategory}
                </span>
                <span className="text-[11px] sm:text-xs text-text-muted font-mono shrink-0">
                  ({products.length} {products.length === 1 ? 'item' : 'items'})
                </span>
              </div>
            )}

            {(selectedCategory !== 'All' || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('All');
                  handleClearSearch();
                }}
                className="sm:hidden text-xs text-brand font-semibold hover:underline shrink-0"
              >
                Reset
              </button>
            )}
          </div>

          {/* Right Controls: In-Stock Toggle & Sort Dropdown (Balanced 50/50 on Mobile) */}
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
            {/* In-Stock Toggle */}
            <label className="flex items-center justify-center sm:justify-start gap-2 px-3 py-2 bg-surface-subtle hover:bg-surface rounded-xl border border-border-neutral text-xs font-semibold text-text-main cursor-pointer hover:border-brand/40 transition select-none shadow-2xs">
              <input
                type="checkbox"
                checked={onlyInStock}
                onChange={(e) => setOnlyInStock(e.target.checked)}
                className="w-3.5 h-3.5 accent-brand rounded cursor-pointer shrink-0"
              />
              <span className="whitespace-nowrap">In-Stock Only</span>
            </label>

            {/* Sort Dropdown */}
            <div className="flex items-center justify-between sm:justify-start gap-1.5 px-3 py-2 bg-surface-subtle rounded-xl border border-border-neutral text-xs font-semibold text-text-main shadow-2xs">
              <div className="flex items-center gap-1.5 min-w-0 w-full">
                <ArrowUpDown className="w-3.5 h-3.5 text-brand shrink-0" />
                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value)}
                  className="bg-transparent text-text-main focus:outline-none cursor-pointer w-full text-xs font-semibold truncate"
                >
                  <option value="newest" className="bg-surface text-text-main">Newest Arrivals</option>
                  <option value="price_asc" className="bg-surface text-text-main">Price: Low to High</option>
                  <option value="price_desc" className="bg-surface text-text-main">Price: High to Low</option>
                  <option value="name_asc" className="bg-surface text-text-main">Name: A to Z</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Product Count & Filter Label */}
        <div className="flex items-center justify-between text-xs text-text-muted px-1">
          <span>
            Showing <strong className="text-text-main">{products.length}</strong> items
            {selectedCategory !== 'All' && (
              <> in department <strong className="text-brand">
                {categories.find((c) => c.slug === selectedCategory)?.name || selectedCategory}
              </strong></>
            )}
          </span>
          {(selectedCategory !== 'All' || searchQuery) && (
            <button
              onClick={() => {
                setSelectedCategory('All');
                handleClearSearch();
              }}
              className="text-brand font-semibold hover:underline cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Products Grid */}
        {loading && products.length === 0 ? (
          <SkeletonProductGrid count={10} />
        ) : error && products.length === 0 ? (
          <div className="p-8 rounded-2xl bg-status-error/10 border border-status-error/20 text-center text-status-error space-y-3">
            <p className="font-semibold text-sm">{error}</p>
            <button
              onClick={() => {
                swrCache.invalidate('products');
                setLoading(true);
                setError(null);
              }}
              className="px-4 py-2 bg-brand hover:bg-brand-hover text-white rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : products.length === 0 ? (
          <div className="p-10 text-center rounded-2xl bg-surface border border-border-neutral space-y-3 shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-surface-subtle mx-auto flex items-center justify-center text-text-muted">
              <ShoppingBag className="w-7 h-7 text-brand" />
            </div>
            <h3 className="text-base font-bold text-text-main">No products found</h3>
            <p className="text-xs text-text-muted max-w-sm mx-auto">
              We couldn't find any items matching your selected criteria. Try resetting your search or choosing another department.
            </p>
            <button
              onClick={() => {
                setSelectedCategory('All');
                setSearchQuery('');
              }}
              className="mt-2 px-4 py-2 bg-brand hover:bg-brand-hover text-white font-bold text-xs rounded-xl transition shadow-xs"
            >
              Show All Products
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
            {products.map((product, idx) => (
              <ProductCard
                key={product._id}
                product={product}
                priority={idx < 4}
                onOpenDetails={(p) => setSelectedProduct(p)}
              />
            ))}
          </div>
        )}

        {/* Product Details Modal */}
        <ProductDetailModal
          product={selectedProduct}
          isOpen={Boolean(selectedProduct)}
          onClose={() => setSelectedProduct(null)}
        />
      </div>
    </div>
  );
}
