/**
 * Admin Product & Variant Management View.
 *
 * Route: /admin/products
 * Allows administrators to add, edit, unpublish, and manage multi-variant grocery items.
 * All prices are mapped safely to/from integer paise.
 *
 * @module pages/admin/AdminProducts
 */

import React, { useState, useEffect, useRef } from 'react';
import { apiClient, resolveImageUrl, getApiUploadUrl, NEUTRAL_PRODUCT_PLACEHOLDER } from '../../config/api.js';
import {
  ShoppingBag,
  Plus,
  Search,
  Edit2,
  Trash2,
  RefreshCw,
  X,
  AlertCircle,
  CheckCircle2,
  Image as ImageIcon,
} from 'lucide-react';
import { ImageUpload } from '../../components/common/ImageUpload.jsx';
import { Pagination } from '../../components/Pagination.jsx';
import { useBulkSelection } from '../../hooks/useBulkSelection.js';
import { BulkActionBar } from '../../components/BulkActionBar.jsx';
import { BulkConfirmModal } from '../../components/BulkConfirmModal.jsx';
import { SkeletonTable, ImageWithSkeleton } from '../../components/skeleton/index.js';
import { swrCache } from '../../utils/swrCache.js';

export function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pagination, setPagination] = useState({ totalPages: 1, totalRecords: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const isFirstMount = useRef(true);

  // Modal State (Create / Edit)
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const formBodyRef = useRef(null);

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    category: '',
    brand: 'Khushboo Pure',
    images: [],
    isVeg: true,
    isPublished: true,
    variants: [
      {
        sku: '',
        label: '1 kg',
        unit: 'kg',
        quantity: 1,
        priceRupees: '55',
        mrpRupees: '65',
        stock: 50,
        weightGrams: 1000,
      },
    ],
  });

  // Bulk Selection hook & modal
  const bulk = useBulkSelection(pagination.totalRecords);
  const [bulkConfig, setBulkConfig] = useState(null);
  const [bulkResultSummary, setBulkResultSummary] = useState(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        limit: pageSize,
      };
      if (search.trim()) params.search = search.trim();
      if (selectedCategory !== 'ALL') params.category = selectedCategory;

      const res = await apiClient.get('/v1/admin/products', { params });
      if (res.data?.success) {
        setProducts(res.data.data || []);
        if (res.data.pagination) {
          setPagination(res.data.pagination);
        } else {
          setPagination({
            totalPages: res.data.totalPages || 1,
            totalRecords: res.data.total || (res.data.data ? res.data.data.length : 0),
          });
        }
        bulk.clearSelection();
      }
    } catch (err) {
      setError(err.message || 'Failed to load products.');
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerBulkStatus = (isPublished) => {
    setBulkConfig({
      title: isPublished ? 'Publish Selected Products' : 'Archive Selected Products',
      description: `You are about to ${isPublished ? 'publish' : 'archive'} ${bulk.selectedCount} product(s).`,
      affectedCount: bulk.selectedCount,
      itemName: 'products',
      confirmLabel: isPublished ? 'Publish Selected' : 'Archive Selected',
      confirmVariant: isPublished ? 'primary' : 'warning',
      requireReason: false,
      reversibilityNotice: isPublished
        ? 'Products will immediately become visible to customers for ordering.'
        : 'Archived products will be hidden from storefront browsing.',
      onConfirm: async () => {
        setBulkLoading(true);
        try {
          const res = await apiClient.post('/v1/admin/products/bulk-status', {
            ids: bulk.selectedIds,
            selectAllMatching: bulk.selectAllMatching,
            filter: { category: selectedCategory },
            isPublished,
          });
          setBulkResultSummary(res.data);
        } catch (err) {
          setError(err.response?.data?.message || 'Bulk status update failed.');
          setBulkConfig(null);
        } finally {
          setBulkLoading(false);
        }
      },
    });
  };

  const handleTriggerBulkDelete = () => {
    setBulkConfig({
      title: 'Bulk Delete Products',
      description: `Are you sure you want to delete ${bulk.selectedCount} product(s)?`,
      affectedCount: bulk.selectedCount,
      itemName: 'products',
      confirmLabel: 'Delete Products',
      confirmVariant: 'danger',
      requireReason: false,
      reversibilityNotice:
        'Products referenced by historical customer orders or invoices will be archived/unpublished instead of deleted to preserve fulfillment history.',
      onConfirm: async () => {
        setBulkLoading(true);
        try {
          const res = await apiClient.post('/v1/admin/products/bulk-delete', {
            ids: bulk.selectedIds,
            selectAllMatching: bulk.selectAllMatching,
            filter: { category: selectedCategory },
          });
          setBulkResultSummary(res.data);
        } catch (err) {
          setError(err.response?.data?.message || 'Bulk product deletion failed.');
          setBulkConfig(null);
        } finally {
          setBulkLoading(false);
        }
      },
    });
  };

  // Load categories once on mount
  useEffect(() => {
    apiClient
      .get('/v1/categories')
      .then((res) => {
        if (res.data?.success) setCategories(res.data.data || []);
      })
      .catch(() => {});
  }, []);

  // Fetch when page, pageSize, or category changes
  useEffect(() => {
    fetchProducts();
  }, [page, pageSize, selectedCategory]);

  // Debounced search
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    const timer = setTimeout(() => {
      setPage(1);
      fetchProducts();
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const handleOpenAddModal = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      slug: '',
      description: '',
      category: categories[0]?._id || '',
      brand: 'Khushboo Pure',
      images: [],
      isVeg: true,
      isPublished: true,
      variants: [
        {
          sku: `SKU-${Date.now().toString().slice(-6)}`,
          label: '1 kg',
          unit: 'kg',
          quantity: 1,
          priceRupees: '60',
          mrpRupees: '75',
          stock: 50,
          weightGrams: 1000,
        },
      ],
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleOpenEditModal = (prod) => {
    setEditingProduct(prod);
    setFormData({
      name: prod.name || '',
      slug: prod.slug || '',
      description: prod.description || '',
      category: prod.category?._id || prod.category || '',
      brand: prod.brand || 'Khushboo Pure',
      images: Array.isArray(prod.images) ? prod.images : [],
      isVeg: prod.isVeg ?? true,
      isPublished: prod.isPublished ?? true,
      variants: prod.variants?.map((v) => ({
        sku: v.sku,
        label: v.label,
        unit: v.unit,
        quantity: v.quantity,
        priceRupees: (v.pricePaise / 100).toFixed(0),
        mrpRupees: (v.mrpPaise / 100).toFixed(0),
        stock: v.stock,
        weightGrams: v.weightGrams,
      })) || [],
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleAddVariant = () => {
    setFormData((prev) => ({
      ...prev,
      variants: [
        ...prev.variants,
        {
          sku: `SKU-${Date.now().toString().slice(-6)}`,
          label: '5 kg',
          unit: 'kg',
          quantity: 5,
          priceRupees: '280',
          mrpRupees: '340',
          stock: 30,
          weightGrams: 5000,
        },
      ],
    }));
  };

  const handleRemoveVariant = (index) => {
    if (formData.variants.length <= 1) {
      alert('A product must contain at least one variant.');
      return;
    }
    setFormData((prev) => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index),
    }));
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingProduct(null);
    setFormError('');
  };

  // Lock background scroll and listen for Escape key
  useEffect(() => {
    if (!modalOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleCloseModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Prevent background page scrolling
    const originalBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const adminMainScroll = document.getElementById('admin-main-scroll');
    const originalAdminOverflow = adminMainScroll ? adminMainScroll.style.overflow : '';
    if (adminMainScroll) {
      adminMainScroll.style.overflow = 'hidden';
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalBodyOverflow;
      if (adminMainScroll) {
        adminMainScroll.style.overflow = originalAdminOverflow;
      }
    };
  }, [modalOpen]);

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    // Pre-validation with automatic scrolling to first invalid field
    if (!formData.name.trim()) {
      setFormError('Product Name is required.');
      const el = document.getElementById('product-name-input');
      el?.focus();
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (!formData.slug.trim()) {
      setFormError('URL Slug is required.');
      const el = document.getElementById('product-slug-input');
      el?.focus();
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (!formData.category) {
      setFormError('Please select a department for this product.');
      const el = document.getElementById('product-category-input');
      el?.focus();
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const cleanImages = formData.images.filter(Boolean);
    if (cleanImages.length === 0) {
      setFormError('A product primary image is required.');
      const el = document.getElementById('product-image-section');
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (!formData.variants || formData.variants.length === 0) {
      setFormError('At least one product pack variant is required.');
      const el = document.getElementById('product-variants-section');
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    for (let i = 0; i < formData.variants.length; i++) {
      const v = formData.variants[i];
      if (!v.sku.trim()) {
        setFormError(`Variant #${i + 1} requires an SKU code.`);
        const el = document.getElementById(`variant-sku-${i}`);
        el?.focus();
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      if (!v.label.trim()) {
        setFormError(`Variant #${i + 1} requires a pack label (e.g., 500 g, 1 kg).`);
        const el = document.getElementById(`variant-label-${i}`);
        el?.focus();
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      if (isNaN(Number(v.priceRupees)) || Number(v.priceRupees) <= 0) {
        setFormError(`Variant #${i + 1} (${v.label || 'Pack'}) must have a valid selling price greater than ₹0.`);
        const el = document.getElementById(`variant-price-${i}`);
        el?.focus();
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      if (isNaN(Number(v.mrpRupees)) || Number(v.mrpRupees) <= 0) {
        setFormError(`Variant #${i + 1} (${v.label || 'Pack'}) must have a valid MRP greater than ₹0.`);
        const el = document.getElementById(`variant-mrp-${i}`);
        el?.focus();
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      if (isNaN(Number(v.stock)) || Number(v.stock) < 0) {
        setFormError(`Variant #${i + 1} (${v.label || 'Pack'}) stock quantity cannot be negative.`);
        const el = document.getElementById(`variant-stock-${i}`);
        el?.focus();
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        slug: formData.slug.trim().toLowerCase(),
        description: formData.description.trim(),
        category: formData.category,
        brand: formData.brand.trim() || 'Khushboo Pure',
        images: cleanImages,
        isVeg: formData.isVeg,
        isPublished: formData.isPublished,
        variants: formData.variants.map((v) => ({
          sku: v.sku.toUpperCase().trim(),
          label: v.label.trim(),
          unit: v.unit || 'kg',
          quantity: Number(v.quantity) || 1,
          pricePaise: Math.round(Number(v.priceRupees) * 100),
          mrpPaise: Math.round(Number(v.mrpRupees || v.priceRupees) * 100),
          stock: Number(v.stock),
          weightGrams: Number(v.weightGrams) || 1000,
        })),
      };

      if (editingProduct) {
        await apiClient.put(`/v1/products/${editingProduct._id}`, payload);
      } else {
        await apiClient.post('/v1/products', payload);
      }

      swrCache.invalidate('products');

      setModalOpen(false);
      setEditingProduct(null);
      await fetchProducts();
    } catch (err) {
      let errMsg = err.response?.data?.message || err.message || 'Error saving product.';
      if (Array.isArray(err.response?.data?.details) && err.response.data.details.length > 0) {
        const detailMsg = err.response.data.details
          .map((d) => (d.message ? `${d.message}` : `${d.field}`))
          .join('; ');
        errMsg = `${errMsg} — ${detailMsg}`;
      }
      setFormError(errMsg);
      formBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-text-main">Product Catalog & Variants</h1>
          <p className="text-xs text-text-muted mt-1">
            Configure grocery items, pack sizes, stock availability, and prices in rupees.
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="self-start sm:self-auto px-4 py-2.5 bg-brand hover:bg-brand-hover text-white font-semibold text-xs rounded-xl flex items-center gap-2 transition shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Grocery Product</span>
        </button>
      </div>

      {/* Toolbar */}
      <div className="bg-surface border border-border-neutral rounded-2xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 shadow-xs">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-3 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products by name, brand, SKU..."
            className="w-full bg-primary-bg border border-border-neutral rounded-xl pl-10 pr-3.5 py-2 text-xs text-text-main placeholder:text-text-muted focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-text-muted font-medium">Department:</span>
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPage(1);
            }}
            className="bg-primary-bg border border-border-neutral text-text-main rounded-xl px-3 py-1.5 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
          >
            <option value="ALL">All Departments</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Products Table */}
      {loading ? (
        <SkeletonTable rows={8} columns={6} showToolbar={false} showPagination={true} />
      ) : error ? (
        <div className="p-6 bg-red-50 border border-red-200 text-status-error rounded-2xl text-center">
          {error}
        </div>
      ) : products.length === 0 ? (
        <div className="p-12 text-center bg-surface border border-border-neutral rounded-2xl space-y-2 shadow-xs">
          <ShoppingBag className="w-10 h-10 text-text-muted/40 mx-auto" />
          <h3 className="text-base font-bold text-text-main">No products found</h3>
        </div>
      ) : (
        <div className="bg-surface border border-border-neutral rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[750px] text-left text-xs">
              <thead className="bg-surface-subtle text-[11px] uppercase tracking-wider text-text-muted border-b border-border-neutral">
                <tr>
                  <th className="p-4 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={
                        products.length > 0 &&
                        bulk.getPageSelectionState(products.map((p) => p._id)).isAllSelected
                      }
                      onChange={() => bulk.toggleSelectPage(products.map((p) => p._id))}
                      className="rounded accent-brand"
                    />
                  </th>
                  <th className="p-4 font-semibold">Product</th>
                  <th className="p-4 font-semibold">Department</th>
                  <th className="p-4 font-semibold">Pack Variants</th>
                  <th className="p-4 font-semibold">Price Range</th>
                  <th className="p-4 font-semibold">Status</th>
                  <th className="p-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-neutral">
                {products.map((p) => {
                  const prices = p.variants?.map((v) => v.pricePaise / 100) || [0];
                  const minPrice = Math.min(...prices);
                  const maxPrice = Math.max(...prices);
                  const isSelected = bulk.isSelected(p._id);

                  return (
                    <tr
                      key={p._id}
                      className={`transition ${isSelected ? 'bg-brand-light/30' : 'hover:bg-surface-subtle/60'}`}
                    >
                      <td className="p-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => bulk.toggleSelect(p._id)}
                          className="rounded accent-brand"
                        />
                      </td>
                      <td className="p-4 flex items-center gap-3">
                        <ImageWithSkeleton
                          src={p.images?.[0]}
                          alt={p.name}
                          aspectRatio="aspect-square"
                          containerClassName="w-12 h-12 rounded-xl shrink-0 bg-surface-subtle border border-border-neutral overflow-hidden"
                          className="w-full h-full object-cover rounded-xl"
                        />
                        <div>
                          <span className="font-bold text-text-main block max-w-xs truncate">{p.name}</span>
                          <span className="text-[10px] text-brand font-mono">{p.slug}</span>
                        </div>
                      </td>

                      <td className="p-4 text-text-main font-semibold">
                        {p.category?.name || 'Uncategorized'}
                      </td>

                      <td className="p-4">
                        <div className="flex flex-wrap gap-1">
                          {p.variants?.map((v) => (
                            <span
                              key={v.sku}
                              className="px-2 py-0.5 rounded-md bg-surface-subtle border border-border-neutral text-[10px] font-mono text-text-main"
                            >
                              {v.label} ({v.stock} in stock)
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="p-4 font-bold text-text-main">
                        {minPrice === maxPrice ? `₹${minPrice}` : `₹${minPrice} – ₹${maxPrice}`}
                      </td>

                      <td className="p-4">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                            p.isPublished
                              ? 'bg-emerald-50 text-status-success border border-emerald-200'
                              : 'bg-surface-subtle text-text-muted border border-border-neutral'
                          }`}
                        >
                          {p.isPublished ? 'Published' : 'Archived'}
                        </span>
                      </td>

                      <td className="p-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(p)}
                          className="px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-subtle border border-border-neutral text-brand font-semibold transition inline-flex items-center gap-1.5 shadow-xs"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="px-5 pb-3">
            <Pagination
              currentPage={page}
              totalPages={pagination.totalPages}
              totalRecords={pagination.totalRecords}
              pageSize={pageSize}
              onPageChange={(p) => setPage(p)}
              onPageSizeChange={(sz) => {
                setPageSize(sz);
                setPage(1);
              }}
              pageSizeOptions={[10, 20, 50]}
              loading={loading}
              itemName="products"
            />
          </div>
        </div>
      )}

      {/* ── Add / Edit Product Modal (Fixed Viewport with Scrollable Body) ─── */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/50 backdrop-blur-xs animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseModal();
          }}
        >
          <div
            className="relative w-full max-w-2xl sm:max-w-3xl max-h-[90dvh] bg-surface border border-border-neutral rounded-2xl text-text-main shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-modal-title"
          >
            {/* Header: fixed/pinned at top */}
            <div className="shrink-0 px-6 py-4 border-b border-border-neutral flex items-center justify-between bg-surface z-10">
              <div className="pr-4">
                <h3 id="product-modal-title" className="text-base sm:text-lg font-bold font-heading text-text-main">
                  {editingProduct ? 'Edit Grocery Item' : 'Add New Grocery Product'}
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  {editingProduct
                    ? 'Update grocery item details, pack sizes, stock, and imagery'
                    : 'Create a new grocery item with multi-pack variants'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="p-2 rounded-xl text-text-muted hover:text-text-main hover:bg-surface-subtle transition"
                aria-label="Close modal"
                title="Close (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form wrapping scrollable body and sticky footer */}
            <form onSubmit={handleFormSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              {/* Scrollable Body: middle section scrolls independently */}
              <div
                ref={formBodyRef}
                className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 sm:p-6 space-y-5 text-xs"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                {formError && (
                  <div
                    id="product-form-error"
                    className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-status-error flex items-start gap-2.5 animate-fadeIn"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span className="leading-relaxed font-medium">{formError}</span>
                  </div>
                )}

                {/* Basic Details: Name and Slug */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label htmlFor="product-name-input" className="block text-[11px] font-semibold text-text-main mb-1">
                      Product Name <span className="text-status-error">*</span>
                    </label>
                    <input
                      id="product-name-input"
                      type="text"
                      value={formData.name}
                      onChange={(e) => {
                        const name = e.target.value;
                        setFormData((p) => ({
                          ...p,
                          name,
                          slug: p.slug ? p.slug : name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50),
                        }));
                      }}
                      required
                      placeholder="e.g. Khushboo Pure Sharbati Wheat Flour"
                      className="w-full px-3 py-2 bg-primary-bg border border-border-neutral rounded-xl text-text-main placeholder:text-text-muted focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand shadow-xs"
                    />
                  </div>

                  <div>
                    <label htmlFor="product-slug-input" className="block text-[11px] font-semibold text-text-main mb-1">
                      URL Slug <span className="text-status-error">*</span>
                    </label>
                    <input
                      id="product-slug-input"
                      type="text"
                      value={formData.slug}
                      onChange={(e) => setFormData((p) => ({ ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '') }))}
                      required
                      placeholder="e.g. khushboo-pure-sharbati-flour"
                      className="w-full px-3 py-2 bg-primary-bg border border-border-neutral rounded-xl text-brand font-mono focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand shadow-xs"
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label htmlFor="product-description-input" className="block text-[11px] font-semibold text-text-main mb-1">
                    Description <span className="text-status-error">*</span>
                  </label>
                  <textarea
                    id="product-description-input"
                    value={formData.description}
                    onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                    required
                    rows={2}
                    placeholder="Describe whole-wheat purity, stone-ground mill benefits, freshness, etc."
                    className="w-full px-3 py-2 bg-primary-bg border border-border-neutral rounded-xl text-text-main placeholder:text-text-muted focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand shadow-xs"
                  />
                </div>

                {/* Department / Category Selection & Brand */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label htmlFor="product-category-input" className="block text-[11px] font-semibold text-text-main mb-1">
                      Department <span className="text-status-error">*</span>
                    </label>
                    <select
                      id="product-category-input"
                      value={formData.category}
                      onChange={(e) => setFormData((p) => ({ ...p, category: e.target.value }))}
                      required
                      className="w-full px-3 py-2 bg-primary-bg border border-border-neutral rounded-xl text-text-main focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand shadow-xs"
                    >
                      <option value="">Select department</option>
                      {categories.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="product-brand-input" className="block text-[11px] font-semibold text-text-main mb-1">
                      Brand
                    </label>
                    <input
                      id="product-brand-input"
                      type="text"
                      value={formData.brand}
                      onChange={(e) => setFormData((p) => ({ ...p, brand: e.target.value }))}
                      placeholder="e.g. Khushboo Pure"
                      className="w-full px-3 py-2 bg-primary-bg border border-border-neutral rounded-xl text-text-main focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand shadow-xs"
                    />
                  </div>
                </div>

                {/* Direct File & Mobile Image Upload */}
                <div id="product-image-section">
                  <ImageUpload
                    value={formData.images[0] || ''}
                    onChange={(newUrl) => setFormData((p) => ({ ...p, images: newUrl ? [newUrl] : [] }))}
                    label="Product Primary Image"
                    hint="Select image from device (JPEG, PNG, WebP up to 5 MB), drag & drop, or provide URL."
                    required={true}
                    uploadFolder="products"
                  />
                </div>

                {/* Variants Section */}
                <div id="product-variants-section" className="pt-2 border-t border-border-neutral space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-text-main text-xs block">
                        Product Variants (Pack Sizes & Stock) <span className="text-status-error">*</span>
                      </span>
                      <span className="text-[10px] text-text-muted">
                        Configure pack sizes, selling price, MRP, and warehouse stock
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddVariant}
                      className="px-2.5 py-1.5 rounded-xl bg-brand-light text-brand hover:bg-brand-light/80 border border-brand/20 text-[11px] font-semibold transition flex items-center gap-1 shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Pack Variant</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    {formData.variants.map((v, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-surface-subtle border border-border-neutral rounded-xl grid grid-cols-2 sm:grid-cols-6 gap-2.5 items-center shadow-xs"
                      >
                        <div>
                          <label htmlFor={`variant-sku-${idx}`} className="text-[10px] font-semibold text-text-muted block mb-0.5">
                            SKU *
                          </label>
                          <input
                            id={`variant-sku-${idx}`}
                            type="text"
                            value={v.sku}
                            onChange={(e) => {
                              const val = e.target.value.toUpperCase();
                              setFormData((prev) => {
                                const vars = [...prev.variants];
                                vars[idx].sku = val;
                                return { ...prev, variants: vars };
                              });
                            }}
                            required
                            placeholder="SKU"
                            className="w-full px-2 py-1.5 bg-surface border border-border-neutral rounded-lg text-brand font-mono text-[11px] focus:outline-none focus:border-brand shadow-xs"
                          />
                        </div>

                        <div>
                          <label htmlFor={`variant-label-${idx}`} className="text-[10px] font-semibold text-text-muted block mb-0.5">
                            Label *
                          </label>
                          <input
                            id={`variant-label-${idx}`}
                            type="text"
                            value={v.label}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFormData((prev) => {
                                const vars = [...prev.variants];
                                vars[idx].label = val;
                                return { ...prev, variants: vars };
                              });
                            }}
                            required
                            placeholder="e.g. 1 kg"
                            className="w-full px-2 py-1.5 bg-surface border border-border-neutral rounded-lg text-text-main text-[11px] focus:outline-none focus:border-brand shadow-xs"
                          />
                        </div>

                        <div>
                          <label htmlFor={`variant-price-${idx}`} className="text-[10px] font-semibold text-text-muted block mb-0.5">
                            Selling (₹) *
                          </label>
                          <input
                            id={`variant-price-${idx}`}
                            type="number"
                            value={v.priceRupees}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFormData((prev) => {
                                const vars = [...prev.variants];
                                vars[idx].priceRupees = val;
                                return { ...prev, variants: vars };
                              });
                            }}
                            required
                            min={1}
                            placeholder="55"
                            className="w-full px-2 py-1.5 bg-surface border border-border-neutral rounded-lg text-text-main text-[11px] font-mono focus:outline-none focus:border-brand shadow-xs"
                          />
                        </div>

                        <div>
                          <label htmlFor={`variant-mrp-${idx}`} className="text-[10px] font-semibold text-text-muted block mb-0.5">
                            MRP (₹) *
                          </label>
                          <input
                            id={`variant-mrp-${idx}`}
                            type="number"
                            value={v.mrpRupees}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFormData((prev) => {
                                const vars = [...prev.variants];
                                vars[idx].mrpRupees = val;
                                return { ...prev, variants: vars };
                              });
                            }}
                            required
                            min={1}
                            placeholder="65"
                            className="w-full px-2 py-1.5 bg-surface border border-border-neutral rounded-lg text-text-muted text-[11px] font-mono focus:outline-none focus:border-brand shadow-xs"
                          />
                        </div>

                        <div>
                          <label htmlFor={`variant-stock-${idx}`} className="text-[10px] font-semibold text-text-muted block mb-0.5">
                            Stock Qty *
                          </label>
                          <input
                            id={`variant-stock-${idx}`}
                            type="number"
                            value={v.stock}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFormData((prev) => {
                                const vars = [...prev.variants];
                                vars[idx].stock = val;
                                return { ...prev, variants: vars };
                              });
                            }}
                            required
                            min={0}
                            placeholder="50"
                            className="w-full px-2 py-1.5 bg-surface border border-border-neutral rounded-lg text-status-success font-semibold text-[11px] font-mono focus:outline-none focus:border-brand shadow-xs"
                          />
                        </div>

                        <div className="flex justify-end pt-3 sm:pt-4">
                          <button
                            type="button"
                            onClick={() => handleRemoveVariant(idx)}
                            className="p-1.5 text-status-error hover:bg-red-50 rounded-lg transition"
                            title="Remove variant"
                            aria-label={`Remove variant ${idx + 1}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Publishing and Veg status */}
                <div className="flex flex-wrap items-center gap-6 pt-2 border-t border-border-neutral">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formData.isPublished}
                      onChange={(e) => setFormData((p) => ({ ...p, isPublished: e.target.checked }))}
                      className="w-4 h-4 accent-brand rounded"
                    />
                    <span className="text-xs text-text-main font-semibold">Publish item on storefront</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formData.isVeg}
                      onChange={(e) => setFormData((p) => ({ ...p, isVeg: e.target.checked }))}
                      className="w-4 h-4 accent-brand rounded"
                    />
                    <span className="text-xs text-text-main font-semibold">100% Vegetarian Item</span>
                  </label>
                </div>
              </div>

              {/* Footer: persistent / fixed at bottom */}
              <div className="shrink-0 px-6 py-4 border-t border-border-neutral bg-surface-subtle/80 flex items-center justify-between gap-3 z-10">
                <span className="text-[11px] text-text-muted hidden sm:inline-block">
                  All prices and stocks sync across Indore store in real-time.
                </span>
                <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-surface hover:bg-surface-subtle border border-border-neutral text-text-main font-semibold text-xs transition shadow-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-white font-semibold text-xs transition disabled:opacity-50 shadow-xs flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>{editingProduct ? 'Update Product' : 'Create Product'}</span>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Contextual Bulk Action Bar */}
      <BulkActionBar
        selectedCount={bulk.selectedCount}
        totalMatching={pagination.totalRecords}
        currentPageCount={products.length}
        selectAllMatching={bulk.selectAllMatching}
        onSelectAllMatching={bulk.handleSelectAllMatching}
        onClearSelection={bulk.clearSelection}
        itemName="products"
        actions={[
          {
            id: 'publish',
            label: 'Publish',
            icon: CheckCircle2,
            variant: 'primary',
            onClick: () => handleTriggerBulkStatus(true),
          },
          {
            id: 'archive',
            label: 'Archive',
            icon: AlertCircle,
            variant: 'warning',
            onClick: () => handleTriggerBulkStatus(false),
          },
          {
            id: 'delete',
            label: 'Delete Selected',
            icon: Trash2,
            variant: 'danger',
            onClick: handleTriggerBulkDelete,
          },
        ]}
      />

      {/* Bulk Confirm Modal */}
      {bulkConfig && (
        <BulkConfirmModal
          isOpen={Boolean(bulkConfig)}
          onClose={() => {
            setBulkConfig(null);
            setBulkResultSummary(null);
          }}
          onConfirm={(reason) => bulkConfig.onConfirm(reason)}
          title={bulkConfig.title}
          description={bulkConfig.description}
          affectedCount={bulkConfig.affectedCount}
          itemName={bulkConfig.itemName}
          confirmLabel={bulkConfig.confirmLabel}
          confirmVariant={bulkConfig.confirmVariant}
          requireReason={bulkConfig.requireReason}
          reasonPlaceholder={bulkConfig.reasonPlaceholder}
          reversibilityNotice={bulkConfig.reversibilityNotice}
          loading={bulkLoading}
          resultSummary={bulkResultSummary}
          onDone={() => {
            setBulkConfig(null);
            setBulkResultSummary(null);
            fetchProducts();
          }}
        />
      )}
    </div>
  );
}
