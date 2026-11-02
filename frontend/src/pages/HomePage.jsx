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
import { Search, ShoppingBag, ArrowUpDown, X } from 'lucide-react';
import { useStoreSettings } from '../context/StoreSettingsContext.jsx';

export function HomePage({ onOpenAuth }) {
  const { settings } = useStoreSettings();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSearch = searchParams.get('search') || '';

  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [sortOption, setSortOption] = useState('newest');
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [loading, setLoading] = useState(true);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);

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

  // Load Categories from backend
  useEffect(() => {
    async function loadCategories() {
      setCategoriesLoading(true);
      try {
        const res = await apiClient.get('/v1/categories');
        if (res.data?.success && Array.isArray(res.data.data)) {
          setCategories(res.data.data);
        }
      } catch (err) {
        console.error('[home] Error loading categories:', err.message);
      } finally {
        setCategoriesLoading(false);
      }
    }
    loadCategories();
  }, []);

  // Fetch Products matching filters
  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        sort: sortOption,
      };
      if (selectedCategory && selectedCategory !== 'All') {
        params.category = selectedCategory;
      }
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }
      if (onlyInStock) {
        params.inStock = 'true';
      }

      const res = await apiClient.get('/v1/products', { params });
      if (res.data?.success && Array.isArray(res.data.data)) {
        setProducts(res.data.data);
      } else {
        setProducts([]);
      }
    } catch (err) {
      setError(err.message || 'Failed to load grocery items.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
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
        <CategoryCarousel
          categories={categories}
          activeSlug={selectedCategory}
          onSelectCategory={(slug) => setSelectedCategory(slug)}
          loading={categoriesLoading}
        />

        {/* Toolbar: Category Title / Active Search Filter, Sort, and In-Stock Toggle */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 bg-surface p-3.5 sm:p-4 rounded-2xl border border-border-neutral shadow-xs">
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
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
            {[...Array(10)].map((_, idx) => (
              <div
                key={idx}
                className="bg-surface border border-border-neutral rounded-xl p-3 space-y-3 animate-pulse shadow-xs"
              >
                <div className="aspect-square bg-surface-subtle rounded-lg" />
                <div className="h-3.5 bg-surface-subtle rounded w-3/4" />
                <div className="h-3 bg-surface-subtle rounded w-1/2" />
                <div className="h-7 bg-surface-subtle rounded-lg" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-8 rounded-2xl bg-status-error/10 border border-status-error/20 text-center text-status-error space-y-3">
            <p className="font-semibold text-sm">{error}</p>
            <button
              onClick={fetchProducts}
              className="px-4 py-2 bg-brand hover:bg-brand-hover text-white rounded-xl text-xs font-bold transition"
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
            {products.map((product) => (
              <ProductCard
                key={product._id}
                product={product}
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
