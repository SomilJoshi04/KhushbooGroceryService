/**
 * Admin Categories Management View.
 *
 * Route: /admin/categories
 * Allows administrators to add, edit, reorder, and toggle visibility of grocery departments.
 *
 * @module pages/admin/AdminCategories
 */

import React, { useState, useEffect } from 'react';
import { apiClient } from '../../config/api.js';
import {
  Grid,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  X,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { ImageUpload } from '../../components/common/ImageUpload.jsx';
import { SkeletonCategoryGrid } from '../../components/skeleton/index.js';
import { swrCache } from '../../utils/swrCache.js';
import { resolveImageUrl, getApiUploadUrl, NEUTRAL_PRODUCT_PLACEHOLDER } from '../../config/api.js';

export function AdminCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    image: '',
    order: 0,
    isActive: true,
  });

  const fetchCategories = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/v1/categories');
      if (res.data?.success) {
        setCategories(res.data.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to load categories.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleOpenAdd = () => {
    setEditingCategory(null);
    setFormData({
      name: '',
      slug: '',
      description: '',
      image: '',
      order: categories.length + 1,
      isActive: true,
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleOpenEdit = (cat) => {
    setEditingCategory(cat);
    setFormData({
      name: cat.name || '',
      slug: cat.slug || '',
      description: cat.description || '',
      image: cat.image || '',
      order: cat.order ?? 0,
      isActive: cat.isActive ?? true,
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError('');

    try {
      const payload = {
        name: formData.name.trim(),
        slug: formData.slug.trim().toLowerCase(),
        description: formData.description.trim(),
        image: formData.image.trim(),
        order: Number(formData.order) || 0,
        isActive: formData.isActive,
      };

      if (editingCategory) {
        await apiClient.put(`/v1/categories/${editingCategory._id}`, payload);
      } else {
        await apiClient.post('/v1/categories', payload);
      }

      swrCache.invalidate('categories');
      swrCache.invalidate('products');

      setModalOpen(false);
      await fetchCategories();
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || 'Failed to save category.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleDeactivate = async (cat) => {
    const action = cat.isActive ? 'deactivate' : 'activate';
    if (!window.confirm(`Are you sure you want to ${action} "${cat.name}"?`)) return;

    try {
      if (cat.isActive) {
        await apiClient.delete(`/v1/categories/${cat._id}`);
      } else {
        await apiClient.put(`/v1/categories/${cat._id}`, { isActive: true });
      }
      swrCache.invalidate('categories');
      swrCache.invalidate('products');
      await fetchCategories();
    } catch (err) {
      alert(err.message || 'Failed to update category status.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-text-main">Category Departments</h1>
          <p className="text-xs text-text-muted mt-1">
            Organize departments, upload category banners, and configure storefront display ordering.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="self-start sm:self-auto px-4 py-2.5 bg-brand hover:bg-brand-hover text-white font-semibold text-xs rounded-xl flex items-center gap-2 transition shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Department</span>
        </button>
      </div>

      {loading ? (
        <SkeletonCategoryGrid count={8} />
      ) : error ? (
        <div className="p-6 bg-red-50 border border-red-200 text-status-error rounded-2xl text-center">
          {error}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {categories.map((cat) => (
            <div
              key={cat._id}
              className="bg-surface border border-border-neutral rounded-2xl overflow-hidden flex flex-col justify-between hover:border-brand/30 shadow-xs transition"
            >
              <div className="relative aspect-4/3 w-full bg-surface-subtle overflow-hidden">
                <img
                  src={resolveImageUrl(cat.image) || NEUTRAL_PRODUCT_PLACEHOLDER}
                  alt={cat.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    if (!e.currentTarget.dataset.fallbackAttempted) {
                      e.currentTarget.dataset.fallbackAttempted = 'true';
                      const apiFallback = getApiUploadUrl(cat.image);
                      if (apiFallback) {
                        e.currentTarget.src = apiFallback;
                        return;
                      }
                    }
                    e.currentTarget.src = NEUTRAL_PRODUCT_PLACEHOLDER;
                  }}
                />
                <div className="absolute top-3 left-3 bg-surface/90 backdrop-blur-xs px-2 py-0.5 rounded-lg border border-border-neutral text-[10px] font-mono text-brand font-semibold shadow-xs">
                  Order #{cat.order}
                </div>
                <div className="absolute top-3 right-3">
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                      cat.isActive
                        ? 'bg-emerald-50 text-status-success border border-emerald-200'
                        : 'bg-red-50 text-status-error border border-red-200'
                    }`}
                  >
                    {cat.isActive ? 'Active' : 'Hidden'}
                  </span>
                </div>
              </div>

              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div>
                  <h3 className="font-bold text-sm text-text-main truncate">{cat.name}</h3>
                  <span className="text-[10px] font-mono text-text-muted block">{cat.slug}</span>
                  <p className="text-[11px] text-text-muted mt-1 line-clamp-2 leading-relaxed">
                    {cat.description || 'No description provided.'}
                  </p>
                </div>

                <div className="pt-2 border-t border-border-neutral flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(cat)}
                    className="px-2.5 py-1 rounded-lg bg-surface hover:bg-surface-subtle text-brand font-semibold border border-border-neutral flex items-center gap-1 transition shadow-xs"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>Edit</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleDeactivate(cat)}
                    className={`p-1.5 rounded-lg border transition ${
                      cat.isActive
                        ? 'text-status-error hover:bg-red-50 border-red-200'
                        : 'text-status-success hover:bg-emerald-50 border-emerald-200'
                    }`}
                    title={cat.isActive ? 'Hide Category' : 'Activate Category'}
                  >
                    {cat.isActive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Category Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn">
          <div className="relative w-full max-w-md bg-surface border border-border-neutral rounded-2xl p-6 text-text-main shadow-xl space-y-4">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-subtle transition"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold font-heading text-text-main">
              {editingCategory ? 'Edit Department' : 'Add New Department'}
            </h3>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-status-error">
                {formError}
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-text-main mb-1">Department Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setFormData((p) => ({
                      ...p,
                      name,
                      slug: p.slug ? p.slug : name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40),
                    }));
                  }}
                  required
                  placeholder="e.g. Wheat Flour & Grains"
                  className="w-full px-3 py-2 bg-primary-bg border border-border-neutral rounded-xl text-text-main placeholder:text-text-muted focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-text-main mb-1">Slug (URL)</label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData((p) => ({ ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '') }))}
                  required
                  placeholder="e.g. wheat-flour"
                  className="w-full px-3 py-2 bg-primary-bg border border-border-neutral rounded-xl text-brand font-mono focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                />
              </div>

              <div>
                <ImageUpload
                  value={formData.image}
                  onChange={(newUrl) => setFormData((p) => ({ ...p, image: newUrl }))}
                  label="Department Banner / Thumbnail"
                  hint="Select category thumbnail from device (JPEG, PNG, WebP up to 5 MB), or enter URL."
                  required={true}
                  uploadFolder="categories"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-text-main mb-1">Short Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                  rows={2}
                  placeholder="Fresh stone-ground wheat, multigrain, etc."
                  className="w-full px-3 py-2 bg-primary-bg border border-border-neutral rounded-xl text-text-main placeholder:text-text-muted focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 items-center">
                <div>
                  <label className="block text-[11px] font-semibold text-text-main mb-1">Display Order</label>
                  <input
                    type="number"
                    value={formData.order}
                    onChange={(e) => setFormData((p) => ({ ...p, order: Number(e.target.value) }))}
                    min={0}
                    className="w-full px-3 py-2 bg-primary-bg border border-border-neutral rounded-xl text-text-main focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                  />
                </div>

                <label className="flex items-center gap-2 pt-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData((p) => ({ ...p, isActive: e.target.checked }))}
                    className="w-4 h-4 accent-brand rounded"
                  />
                  <span className="text-xs font-semibold text-text-main">Active in store</span>
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-surface hover:bg-surface-subtle border border-border-neutral text-text-main font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-white font-semibold transition disabled:opacity-50 shadow-xs"
                >
                  {submitting ? 'Saving...' : editingCategory ? 'Update Department' : 'Create Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
