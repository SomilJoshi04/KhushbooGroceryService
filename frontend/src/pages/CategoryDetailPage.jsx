/**
 * Category-Wise Product Listing Page.
 *
 * Route: /categories/:slug
 * Displays category header banner, breadcrumb navigation,
 * sorting, filtering, and all available products belonging to this category.
 * Styled with warm ivory background, clean white cards, and deep forest green accents.
 *
 * @module pages/CategoryDetailPage
 */

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiClient } from '../config/api.js';
import { ProductCard } from '../components/ProductCard.jsx';
import { ProductDetailModal } from '../components/ProductDetailModal.jsx';
import { Search, ArrowLeft, ArrowUpDown, ShoppingBag, Grid, RefreshCw } from 'lucide-react';

export function CategoryDetailPage() {
  const { slug } = useParams();

  const [category, setCategory] = useState(null);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [sortOption, setSortOption] = useState('newest');
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [loading, setLoading] = useState(true);
  const [categoryLoading, setCategoryLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Close product detail modal when authentication modal opens
  useEffect(() => {
    const handleAuthOpen = () => {
      setSelectedProduct(null);
    };
    window.addEventListener('khushboo:open_auth', handleAuthOpen);
    return () => window.removeEventListener('khushboo:open_auth', handleAuthOpen);
  }, []);

  // Fetch Category Details
  useEffect(() => {
    async function loadCategory() {
      setCategoryLoading(true);
      setNotFound(false);
      try {
        const res = await apiClient.get(`/v1/categories/${slug}`);
        if (res.data?.success && res.data?.data) {
          setCategory(res.data.data);
        } else {
          setNotFound(true);
        }
      } catch (err) {
        if (err.response?.status === 404) {
          setNotFound(true);
        } else {
          setError(err.message || 'Error loading category.');
        }
      } finally {
        setCategoryLoading(false);
      }
    }
    loadCategory();
  }, [slug]);

  // Fetch Products in Category
  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params = {
        category: slug,
        sort: sortOption,
      };
      if (search.trim()) {
        params.search = search.trim();
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
      setError(err.message || 'Failed to load category products.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!notFound) {
      fetchProducts();
    }
  }, [slug, sortOption, onlyInStock, search, notFound]);

  if (notFound) {
    return (
      <div className="min-h-screen py-16 flex flex-col items-center justify-center text-center px-4 bg-primary-bg text-text-main">
        <div className="w-20 h-20 rounded-2xl bg-surface border border-border-neutral flex items-center justify-center text-text-muted mb-4 shadow-xs">
          <Grid className="w-10 h-10 text-brand" />
        </div>
        <h2 className="text-2xl font-bold font-heading text-text-main">Department Not Found</h2>
        <p className="text-xs text-text-muted max-w-sm mt-1 mb-6">
          The category "{slug}" does not exist or may have been updated.
        </p>
        <Link
          to="/categories"
          className="px-5 py-2.5 bg-brand hover:bg-brand-hover text-white font-bold text-xs rounded-xl transition inline-flex items-center gap-2 shadow-xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Browse All Departments</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-16 bg-primary-bg text-text-main">
      {/* Category Hero / Banner */}
      <section className="bg-surface-subtle border-b border-border-neutral">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-4">
          {/* Breadcrumbs */}
          <nav className="flex items-center gap-2 text-xs text-text-muted">
            <Link to="/" className="hover:text-brand transition">Home</Link>
            <span>/</span>
            <Link to="/categories" className="hover:text-brand transition">Categories</Link>
            <span>/</span>
            <span className="text-text-main font-semibold">
              {categoryLoading ? 'Loading...' : category?.name || slug}
            </span>
          </nav>

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand bg-brand-light px-2.5 py-1 rounded-full border border-brand/20 inline-block">
                Grocery Department
              </span>
              <h1 className="text-2xl sm:text-4xl font-extrabold font-heading text-text-main">
                {category?.name || slug}
              </h1>
              <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
                {category?.description || '100% stone-ground, pure, and fresh grocery products delivered directly in Indore.'}
              </p>
            </div>

            {/* Category Image Preview Badge */}
            {category?.image && (
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border border-border-neutral shrink-0 shadow-sm bg-surface">
                <img
                  src={category.image}
                  alt={category.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Main Listing Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        {/* Toolbar: Search inside category, In-Stock toggle, and Sorting */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-surface p-4 rounded-xl border border-border-neutral shadow-xs">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-3 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search in ${category?.name || 'this department'}...`}
              className="w-full bg-surface-subtle border border-border-neutral rounded-xl pl-10 pr-3.5 py-2 text-xs text-text-main placeholder:text-text-muted focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition shadow-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 px-3 py-2 bg-surface-subtle rounded-xl border border-border-neutral text-xs font-semibold text-text-main cursor-pointer hover:border-brand/40 transition">
              <input
                type="checkbox"
                checked={onlyInStock}
                onChange={(e) => setOnlyInStock(e.target.checked)}
                className="w-3.5 h-3.5 accent-brand rounded"
              />
              <span>In-Stock Only</span>
            </label>

            <div className="flex items-center gap-1.5 px-3 py-2 bg-surface-subtle rounded-xl border border-border-neutral text-xs font-semibold text-text-main shadow-xs">
              <ArrowUpDown className="w-3.5 h-3.5 text-brand" />
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
                className="bg-transparent text-text-main focus:outline-none cursor-pointer"
              >
                <option value="newest" className="bg-surface text-text-main">Newest</option>
                <option value="price_asc" className="bg-surface text-text-main">Price: Low to High</option>
                <option value="price_desc" className="bg-surface text-text-main">Price: High to Low</option>
                <option value="name_asc" className="bg-surface text-text-main">Name: A to Z</option>
              </select>
            </div>
          </div>
        </div>

        {/* Result Summary */}
        <div className="flex items-center justify-between text-xs text-text-muted px-1">
          <span>
            Showing <strong className="text-text-main">{products.length}</strong> available items
          </span>
          <Link to="/categories" className="text-brand font-semibold hover:underline">
            ← All Categories
          </Link>
        </div>

        {/* Products Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
            {[...Array(6)].map((_, idx) => (
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
              className="px-4 py-2 bg-brand hover:bg-brand-hover rounded-xl text-xs font-bold text-white transition inline-flex items-center gap-1.5 shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        ) : products.length === 0 ? (
          <div className="p-10 text-center rounded-2xl bg-surface border border-border-neutral space-y-3 shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-surface-subtle mx-auto flex items-center justify-center text-text-muted">
              <ShoppingBag className="w-7 h-7 text-brand" />
            </div>
            <h3 className="text-base font-bold text-text-main">No items found</h3>
            <p className="text-xs text-text-muted max-w-sm mx-auto">
              No products found in this department matching your filters.
            </p>
            <button
              onClick={() => {
                setSearch('');
                setOnlyInStock(false);
              }}
              className="mt-2 px-4 py-2 bg-brand hover:bg-brand-hover text-white font-bold text-xs rounded-xl transition shadow-xs"
            >
              Reset Filters
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
