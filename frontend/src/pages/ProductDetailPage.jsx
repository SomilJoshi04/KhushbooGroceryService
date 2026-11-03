/**
 * Dedicated Product Detail Page Component.
 *
 * Route: /products/:slug
 * Standalone deep-linkable product detail view:
 * - High-definition image with fallback on subtle neutral background.
 * - Breadcrumbs back to Storefront and Category.
 * - Live variant pack-size selector (1 kg, 5 kg, 10 kg).
 * - Real-time price, MRP, and stock availability updates.
 * - Centralized live synchronization with CartContext:
 *   - Displays "− quantity +" when variant is in cart.
 *   - Displays "Add to Bag" when variant is not in cart.
 *   - Immediate bidirectional synchronization across product listings, modal, and header.
 *
 * @module pages/ProductDetailPage
 */

import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { apiClient, resolveImageUrl, getApiUploadUrl, NEUTRAL_PRODUCT_PLACEHOLDER } from '../config/api.js';
import { useCart, getCartItemKey } from '../context/CartContext.jsx';
import { SkeletonProductDetail, ImageWithSkeleton } from '../components/skeleton/index.js';
import {
  ArrowLeft,
  ShoppingBag,
  Truck,
  ShieldCheck,
  Check,
  Plus,
  Minus,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

export function ProductDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const {
    getItemQty,
    addToCart,
    updateQty,
    triggerFlyToCart,
    getSelectedVariant,
    setSelectedVariant,
  } = useCart();
  const imageRef = useRef(null);

  const [product, setProduct] = useState(null);
  const [initialQuantity, setInitialQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addedToast, setAddedToast] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function fetchProduct() {
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.get(`/v1/products/${slug}`);
        if (res.data?.success && res.data?.data) {
          setProduct(res.data.data);
          setInitialQuantity(1);
        } else {
          setError('Product not found.');
        }
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Failed to load product details.');
      } finally {
        setLoading(false);
      }
    }

    fetchProduct();
  }, [slug]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <SkeletonProductDetail isModal={false} />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center bg-primary-bg min-h-[60vh]">
        <div className="w-16 h-16 rounded-2xl bg-status-error/10 border border-status-error/20 text-status-error flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold font-heading text-text-main mb-2">Item Not Found</h2>
        <p className="text-xs text-text-muted mb-6">
          {error || 'This grocery item does not exist or has been archived.'}
        </p>
        <Link
          to="/"
          className="px-5 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-white font-bold text-xs transition shadow-xs"
        >
          Return to Storefront
        </Link>
      </div>
    );
  }

  const variants = product.variants || [];
  const activeVariant = getSelectedVariant(product) || variants[0] || {
    sku: 'UNKNOWN',
    label: 'Standard Pack',
    pricePaise: 0,
    mrpPaise: 0,
    stock: 0,
  };

  const selectedVariantIndex = Math.max(
    0,
    variants.findIndex((v) => {
      if (activeVariant._id && v._id) return String(v._id) === String(activeVariant._id);
      if (activeVariant.sku && v.sku) return v.sku === activeVariant.sku;
      return v.label === activeVariant.label;
    })
  );

  const itemKey = getCartItemKey(product._id, activeVariant);
  const qtyInCart = getItemQty(product._id, activeVariant);

  const isOutOfStock = (activeVariant.stock || 0) <= 0;
  const isLowStock = (activeVariant.stock || 0) > 0 && activeVariant.stock <= 5;
  const isMaxStockReached = qtyInCart >= (activeVariant.stock || 0);

  const priceRupees = ((activeVariant.pricePaise || 0) / 100).toFixed(0);
  const mrpRupees = ((activeVariant.mrpPaise || 0) / 100).toFixed(0);
  const hasDiscount = (activeVariant.mrpPaise || 0) > (activeVariant.pricePaise || 0);
  const discountPercent = hasDiscount
    ? Math.round(
        ((activeVariant.mrpPaise - activeVariant.pricePaise) / activeVariant.mrpPaise) * 100
      )
    : 0;

  const handleAddToCart = async (e) => {
    if (isOutOfStock || isSubmitting) return;
    setIsSubmitting(true);

    const qtyToAdd = Math.max(1, initialQuantity);
    const res = await addToCart(product, activeVariant, qtyToAdd);

    if (res?.success) {
      triggerFlyToCart({
        startElement: imageRef.current || e?.currentTarget,
        imageUrl: product.images?.[0],
      });

      setAddedToast(true);
      setTimeout(() => {
        setAddedToast(false);
      }, 1800);
    }
    setIsSubmitting(false);
  };

  const handleIncreaseCart = (e) => {
    if (isMaxStockReached) return;
    updateQty(itemKey, 1);
    triggerFlyToCart({
      startElement: e.currentTarget,
      imageUrl: product.images?.[0],
    });
  };

  const handleDecreaseCart = () => {
    updateQty(itemKey, -1);
  };

  return (
    <div className="min-h-screen py-8 bg-primary-bg text-text-main">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-2 text-xs text-text-muted">
          <Link to="/" className="hover:text-brand transition flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Storefront</span>
          </Link>
          <span>/</span>
          {product.category?.slug && (
            <>
              <Link to={`/categories/${product.category.slug}`} className="hover:text-brand transition">
                {product.category.name}
              </Link>
              <span>/</span>
            </>
          )}
          <span className="text-text-main font-semibold truncate max-w-xs">{product.name}</span>
        </nav>

        {/* Product Container Card */}
        <div className="bg-surface border border-border-neutral rounded-2xl p-6 sm:p-8 shadow-xs grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* Left Column: Product Visuals */}
          <div className="md:col-span-5 space-y-4">
            <div className="relative aspect-square w-full bg-surface-subtle border border-border-neutral rounded-xl overflow-hidden flex items-center justify-center shadow-xs">
              <ImageWithSkeleton
                imgRef={imageRef}
                src={product.images?.[0]}
                alt={product.name}
                aspectRatio="aspect-square"
                containerClassName="w-full h-full"
                className="w-full h-full object-cover"
                priority={true}
              />
              {hasDiscount && (
                <span className="absolute top-3 left-3 px-2 py-0.5 rounded bg-brand text-white font-bold text-xs shadow-xs z-10 pointer-events-none">
                  {discountPercent}% OFF
                </span>
              )}
            </div>

            <div className="p-3.5 rounded-xl bg-surface-subtle border border-border-neutral text-xs text-text-muted space-y-1.5">
              <div className="flex items-center gap-2 text-brand font-semibold">
                <Truck className="w-4 h-4 text-brand" />
                <span>Indore Express: Delivered in 90-120 mins</span>
              </div>
              <div className="flex items-center gap-2 text-text-muted">
                <ShieldCheck className="w-4 h-4 text-brand" />
                <span>100% Pure & Stone-Ground Grocery Guarantee</span>
              </div>
            </div>
          </div>

          {/* Right Column: Product Info & Actions */}
          <div className="md:col-span-7 space-y-5">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand bg-brand-light px-2.5 py-0.5 rounded border border-brand/20">
                  {product.brand || 'Khushboo Pure'}
                </span>
                {product.category?.name && (
                  <span className="text-xs text-text-muted font-medium">
                    {product.category.name}
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-text-main leading-tight">
                {product.name}
              </h1>

              {/* Price Row */}
              <div className="flex items-baseline gap-3 mt-3">
                <span className="text-3xl font-extrabold font-heading text-brand font-mono">
                  ₹{priceRupees}
                </span>
                {hasDiscount && (
                  <span className="text-base text-text-muted line-through font-mono">
                    ₹{mrpRupees}
                  </span>
                )}
                <span className="text-xs text-text-muted">
                  ({activeVariant.label})
                </span>
              </div>

              {/* Stock availability */}
              <div className="mt-2 text-xs">
                {isOutOfStock ? (
                  <span className="text-status-error font-semibold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> Currently Out of Stock
                  </span>
                ) : isLowStock ? (
                  <span className="text-status-warning font-semibold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> Only {activeVariant.stock} packs left in stock!
                  </span>
                ) : (
                  <span className="text-status-success font-medium flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> In Stock for Same-Day Indore Delivery
                  </span>
                )}
              </div>
            </div>

            {/* Pack Size Variants Selector */}
            {variants.length > 0 && (
              <div className="pt-2 border-t border-border-neutral">
                <label className="text-xs font-semibold text-text-main block mb-2">
                  Select Pack Size:
                </label>
                <div className="flex flex-wrap gap-2.5">
                  {variants.map((v, idx) => {
                    const vQtyInCart = getItemQty(product._id, v);
                    const isSelected = selectedVariantIndex === idx;

                    return (
                      <button
                        key={v.sku || v._id || idx}
                        type="button"
                        onClick={() => {
                          setSelectedVariant(product._id, v._id || v.sku || v.label);
                          setInitialQuantity(1);
                        }}
                        className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition shadow-xs flex items-center gap-2 ${
                          isSelected
                            ? 'border-brand bg-brand-light text-brand font-bold ring-1 ring-brand/30'
                            : 'border-border-neutral bg-surface text-text-muted hover:text-text-main hover:bg-surface-subtle'
                        }`}
                      >
                        <div>
                          <span>{v.label}</span>
                          <span className="block text-[10px] text-text-muted font-normal mt-0.5">
                            ₹{((v.pricePaise || 0) / 100).toFixed(0)}
                          </span>
                        </div>
                        {vQtyInCart > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand text-white font-mono font-bold">
                            {vQtyInCart} in bag
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Description */}
            <div className="pt-3 border-t border-border-neutral">
              <h3 className="text-xs font-semibold text-text-main block mb-1.5">
                Product Details:
              </h3>
              <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
                {product.description ||
                  'Authentic traditional grocery staples sourced with utmost purity for daily healthy cooking. Cleaned, sorted, and packed to maintain traditional aroma and nutrition.'}
              </p>
            </div>

            {/* Quantity Controls & Add to Cart Area */}
            <div className="pt-4 border-t border-border-neutral space-y-3">
              {addedToast && (
                <div className="p-3 rounded-xl bg-status-success/10 border border-status-success/20 text-status-success text-xs flex items-center justify-between animate-fadeIn">
                  <span className="flex items-center gap-1.5 font-semibold">
                    <Check className="w-4 h-4" /> Added to your shopping bag!
                  </span>
                  <button
                    type="button"
                    onClick={() => navigate('/cart')}
                    className="font-bold underline hover:text-brand"
                  >
                    Go to Cart →
                  </button>
                </div>
              )}

              {qtyInCart > 0 ? (
                /* Variant is ALREADY in cart */
                <div className="flex items-center gap-3">
                  <div className="flex items-center bg-surface border-2 border-brand/50 rounded-xl p-1 shadow-xs">
                    <button
                      type="button"
                      onClick={handleDecreaseCart}
                      className="w-9 h-9 rounded-lg bg-surface-subtle hover:bg-border-neutral flex items-center justify-center text-text-main transition active:scale-95"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-4 h-4 text-brand font-bold" />
                    </button>
                    <span className="w-12 text-center text-base font-extrabold text-brand font-mono">
                      {qtyInCart}
                    </span>
                    <button
                      type="button"
                      onClick={handleIncreaseCart}
                      disabled={isMaxStockReached}
                      className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold transition active:scale-95 ${
                        isMaxStockReached
                          ? 'bg-border-neutral text-text-muted cursor-not-allowed opacity-60'
                          : 'bg-brand hover:bg-brand-hover text-white shadow-xs'
                      }`}
                      aria-label="Increase quantity"
                      title={isMaxStockReached ? 'Maximum stock reached' : 'Add one more'}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* View Cart Button */}
                  <button
                    type="button"
                    onClick={() => navigate('/cart')}
                    className="flex-1 py-3 px-5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 bg-brand-light text-brand border border-brand/30 hover:bg-brand hover:text-white transition active:scale-98 shadow-xs"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>
                      {qtyInCart} in Bag • View Cart (₹{((activeVariant.pricePaise * qtyInCart) / 100).toFixed(0)})
                    </span>
                  </button>
                </div>
              ) : (
                /* Variant is NOT in cart */
                <div className="flex items-center gap-3">
                  {/* Stepper */}
                  <div className="flex items-center bg-surface border border-border-neutral rounded-xl p-1 shadow-xs">
                    <button
                      type="button"
                      onClick={() => setInitialQuantity((q) => Math.max(1, q - 1))}
                      className="w-9 h-9 rounded-lg bg-surface-subtle hover:bg-border-neutral flex items-center justify-center text-text-main transition active:scale-95"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-10 text-center text-sm font-bold text-brand font-mono">
                      {initialQuantity}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setInitialQuantity((q) =>
                          activeVariant.stock > 0 ? Math.min(activeVariant.stock, q + 1) : q + 1
                        )
                      }
                      disabled={initialQuantity >= (activeVariant.stock || 1)}
                      className={`w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold transition active:scale-95 ${
                        initialQuantity >= (activeVariant.stock || 1)
                          ? 'bg-border-neutral text-text-muted cursor-not-allowed opacity-60'
                          : 'bg-brand hover:bg-brand-hover'
                      }`}
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Add to Bag Button */}
                  <button
                    type="button"
                    onClick={handleAddToCart}
                    disabled={isOutOfStock || isSubmitting}
                    className={`flex-1 py-3 px-5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition active:scale-98 ${
                      isOutOfStock
                        ? 'bg-border-neutral text-text-muted cursor-not-allowed shadow-none'
                        : 'bg-brand hover:bg-brand-hover text-white'
                    }`}
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>
                      {isOutOfStock
                        ? 'Currently Out of Stock'
                        : `Add to Bag • ₹${(((activeVariant.pricePaise || 0) * initialQuantity) / 100).toFixed(0)}`}
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
