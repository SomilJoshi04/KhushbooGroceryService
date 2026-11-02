/**
 * View All Categories Page.
 *
 * Route: /categories
 * Responsive grid of all active grocery departments with imagery,
 * search filtering, descriptions, and direct drill-down links.
 * Styled with warm ivory background, white department cards, and deep forest green accents.
 *
 * @module pages/CategoriesPage
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../config/api.js';
import { Search, Grid, ArrowRight, RefreshCw } from 'lucide-react';

export function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCategories = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/v1/categories');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setCategories(res.data.data);
      } else {
        setCategories([]);
      }
    } catch (err) {
      setError(err.message || 'Unable to load categories. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const filteredCategories = categories.filter((cat) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      cat.name?.toLowerCase().includes(term) ||
      cat.description?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="min-h-screen py-10 bg-primary-bg text-text-main">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-2 text-xs text-text-muted">
          <Link to="/" className="hover:text-brand transition">Home</Link>
          <span>/</span>
          <span className="text-text-main font-semibold">All Categories</span>
        </nav>

        {/* Page Header & Search Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-neutral pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand mb-1">
              <Grid className="w-4 h-4" />
              <span>Grocery Catalog</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-text-main">
              All Grocery Departments
            </h1>
            <p className="text-xs text-text-muted mt-1 max-w-xl">
              Browse our complete range of 100% stone-ground flours, pure spices, pulses, cooking oils, pure cow ghee, and daily essentials.
            </p>
          </div>

          {/* Search Categories */}
          <div className="relative w-full sm:w-72 shrink-0">
            <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-3 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search departments..."
              className="w-full bg-surface border border-border-neutral rounded-xl pl-10 pr-3.5 py-2 text-xs text-text-main placeholder:text-text-muted focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition shadow-xs"
            />
          </div>
        </div>

        {/* Categories Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, idx) => (
              <div
                key={idx}
                className="bg-surface border border-border-neutral rounded-2xl p-5 space-y-4 animate-pulse shadow-xs"
              >
                <div className="aspect-4/3 bg-surface-subtle rounded-xl" />
                <div className="h-5 bg-surface-subtle rounded w-2/3" />
                <div className="h-3 bg-surface-subtle rounded w-full" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-8 rounded-2xl bg-status-error/10 border border-status-error/20 text-center text-status-error space-y-3">
            <p className="font-semibold text-sm">{error}</p>
            <button
              onClick={fetchCategories}
              className="px-4 py-2 bg-brand hover:bg-brand-hover rounded-xl text-xs font-bold text-white transition inline-flex items-center gap-1.5 shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-surface border border-border-neutral space-y-3 shadow-xs">
            <div className="w-16 h-16 rounded-2xl bg-surface-subtle mx-auto flex items-center justify-center text-text-muted">
              <Grid className="w-8 h-8 text-brand" />
            </div>
            <h3 className="text-base font-bold text-text-main">No categories found</h3>
            <p className="text-xs text-text-muted max-w-sm mx-auto">
              No departments matched "{search}". Try searching for another grocery term or clear your search.
            </p>
            <button
              onClick={() => setSearch('')}
              className="mt-2 px-4 py-2 bg-brand hover:bg-brand-hover text-white font-bold text-xs rounded-xl transition shadow-xs"
            >
              Clear Search
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredCategories.map((category) => (
              <Link
                key={category._id || category.slug}
                to={`/categories/${category.slug}`}
                className="group relative bg-surface border border-border-neutral hover:border-brand/40 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-sm flex flex-col justify-between"
              >
                {/* Category Image */}
                <div className="relative aspect-4/3 w-full bg-surface-subtle overflow-hidden border-b border-border-neutral">
                  <img
                    src={category.image || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80'}
                    alt={category.name}
                    className="w-full h-full object-cover group-hover:scale-102 transition duration-500"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80';
                    }}
                  />
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brand bg-surface/90 backdrop-blur-xs px-2 py-0.5 rounded border border-border-neutral shadow-xs">
                      100% Pure
                    </span>
                  </div>
                </div>

                {/* Details */}
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-heading font-bold text-base text-text-main group-hover:text-brand transition">
                      {category.name}
                    </h3>
                    <p className="text-xs text-text-muted mt-1 line-clamp-2 leading-relaxed">
                      {category.description || 'Premium stone-ground flours, fresh spices, and daily grocery essentials.'}
                    </p>
                  </div>

                  <div className="mt-4 pt-3.5 border-t border-border-neutral flex items-center justify-between text-xs font-bold text-brand group-hover:text-brand-hover">
                    <span>Explore Products</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition duration-300" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
