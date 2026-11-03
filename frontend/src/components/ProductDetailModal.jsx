/**
 * Product Detail Modal Component.
 *
 * Provides a comprehensive, accessible product inspection dialog:
 * - Product image with fallback.
 * - Title, brand, and category badges.
 * - Full detailed description.
 * - Pack size / variant selection (1 kg, 5 kg, 10 kg, etc.) updating price and availability in real time.
 * - Live synchronization with centralized CartContext:
 *   - Detects if currently selected variant is already in cart.
 *   - If added, displays "− quantity +" controls and "View Cart".
 *   - If not added, displays "Add to Bag".
 *   - Switching variants immediately updates the displayed quantity.
 * - Genuine discount badge if MRP > selling price.
 * - Stock availability indicator and maximum stock limit handling.
 *
 * @module components/ProductDetailModal
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Plus,
  Minus,
  ShoppingBag,
  Check,
  AlertCircle,
  Truck,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCart, getCartItemKey } from '../context/CartContext.jsx';
import { ImageWithSkeleton } from './skeleton/index.js';

export function ProductDetailModal({ product, isOpen, onClose }) {
  const {
    getItemQty,
    addToCart,
    updateQty,
    triggerFlyToCart,
    getSelectedVariant,
    setSelectedVariant,
  } = useCart();
  const navigate = useNavigate();
  const imageRef = useRef(null);

  const [initialQuantity, setInitialQuantity] = useState(1);
  const [addedToast, setAddedToast] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Close on Escape key & lock body scroll while modal is open
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  // Reset initial quantity and toast when product opens or changes (never force-revert selected variant)
  useEffect(() => {
    if (product) {
      setInitialQuantity(1);
      setAddedToast(false);
    }
  }, [product?._id, isOpen]);

  if (!isOpen || !product) return null;

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

  // Add brand new item to bag
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

  // Stepper controls when item is already in cart
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
      {/* Backdrop */}
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      {/* Modal Card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={product.name}
        onClick={(e) => e.stopPropagation()}
        className="relative bg-surface border border-border-neutral rounded-2xl max-w-2xl w-full shadow-2xl z-10 animate-scaleUp overflow-hidden max-h-[90dvh] flex flex-col text-text-main"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 z-30 w-8 h-8 rounded-full bg-surface/90 backdrop-blur-xs hover:bg-border-neutral border border-border-neutral/60 text-text-muted hover:text-text-main flex items-center justify-center transition active:scale-95 shadow-xs"
          aria-label="Close product details"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Scrollable Modal Body (Contains Image + Details) */}
        <div className="overflow-y-auto flex-1 p-4 sm:p-6 flex flex-col md:flex-row gap-4 md:gap-6">
          {/* Product Image Column */}
          <div className="w-full md:w-5/12 flex flex-col items-center shrink-0">
            <div className="relative w-full max-h-52 sm:max-h-64 md:max-h-none aspect-square bg-surface-subtle border border-border-neutral rounded-xl overflow-hidden flex items-center justify-center">
              <ImageWithSkeleton
                imgRef={imageRef}
                src={
                  product.images?.[0] ||
                  'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80'
                }
                alt={product.name}
                className="w-full h-full object-cover"
                loading="eager"
              />
              {hasDiscount && (
                <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded bg-brand text-white font-bold text-[10px] shadow-xs">
                  {discountPercent}% OFF
                </span>
              )}
            </div>

            <div className="mt-3 w-full p-2.5 rounded-xl bg-surface-subtle border border-border-neutral text-[11px] text-text-muted space-y-1">
              <div className="flex items-center gap-1.5 text-brand font-semibold">
                <Truck className="w-3.5 h-3.5" />
                <span>Delivered in 90-120 mins in Indore</span>
              </div>
              <div className="flex items-center gap-1.5 text-text-muted">
                <ShieldCheck className="w-3.5 h-3.5 text-brand" />
                <span>100% Genuine Quality Guarantee</span>
              </div>
            </div>
          </div>

          {/* Product Info & Actions Column */}
          <div className="md:w-7/12 flex-1 flex flex-col justify-between overflow-y-auto">
            <div>
              {/* Brand & Category */}
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand bg-brand-light px-2 py-0.5 rounded border border-brand/20">
                  {product.brand || 'Khushboo Pure'}
                </span>
                {product.category?.name && (
                  <span className="text-[10px] text-text-muted font-medium">
                    {product.category.name}
                  </span>
                )}
              </div>

              {/* Product Title */}
              <h2 className="text-lg sm:text-xl font-bold font-heading text-text-main leading-snug">
                {product.name}
              </h2>

              {/* Price Row */}
              <div className="flex items-baseline gap-2.5 mt-2.5">
                <span className="text-2xl font-extrabold font-heading text-brand font-mono">
                  ₹{priceRupees}
                </span>
                {hasDiscount && (
                  <span className="text-sm text-text-muted line-through font-mono">
                    ₹{mrpRupees}
                  </span>
                )}
                <span className="text-xs text-text-muted">
                  ({activeVariant.label})
                </span>
              </div>

              {/* Stock Availability */}
              <div className="mt-2 flex items-center gap-2 text-xs">
                {isOutOfStock ? (
                  <span className="inline-flex items-center gap-1 text-status-error font-semibold">
                    <AlertCircle className="w-3.5 h-3.5" /> Out of stock
                  </span>
                ) : isLowStock ? (
                  <span className="inline-flex items-center gap-1 text-status-warning font-semibold">
                    <AlertCircle className="w-3.5 h-3.5" /> Only {activeVariant.stock} left in stock
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-status-success font-medium">
                    <Check className="w-3.5 h-3.5" /> In Stock for Indore Delivery
                  </span>
                )}
              </div>

              {/* Pack Size Variants Selector */}
              {variants.length > 0 && (
                <div className="mt-4">
                  <span className="text-xs font-semibold text-text-main block mb-2">
                    Select Pack Size:
                  </span>
                  <div className="flex flex-wrap gap-2">
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
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition flex items-center gap-1.5 ${
                            isSelected
                              ? 'border-brand bg-brand-light text-brand font-bold ring-1 ring-brand/30 shadow-xs'
                              : 'border-border-neutral bg-surface text-text-muted hover:text-text-main'
                          }`}
                        >
                          <span>{v.label}</span>
                          {vQtyInCart > 0 && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-brand text-white font-mono font-bold">
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
              <div className="mt-4 pt-3 border-t border-border-neutral">
                <span className="text-xs font-semibold text-text-main block mb-1">
                  About this item:
                </span>
                <p className="text-xs text-text-muted leading-relaxed max-h-32 overflow-y-auto">
                  {product.description || 'Pure staples and grocery essentials sourced for daily cooking.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Pinned Bottom Actions Bar */}
        <div className="p-3.5 sm:p-5 border-t border-border-neutral bg-surface shrink-0 z-20 space-y-2.5">
          {addedToast && (
            <div className="p-2 rounded-xl bg-status-success/10 border border-status-success/20 text-status-success text-xs flex items-center justify-between animate-fadeIn">
              <span className="flex items-center gap-1.5 font-medium">
                <Check className="w-3.5 h-3.5" /> Added to your shopping bag!
              </span>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate('/cart');
                }}
                className="font-bold underline hover:text-brand flex items-center gap-1"
              >
                <span>View Bag</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}

          {qtyInCart > 0 ? (
            /* Variant is ALREADY in cart: show synchronized − quantity + stepper controls */
            <div className="flex items-center gap-3">
              <div className="flex items-center bg-surface border-2 border-brand/50 rounded-xl p-1 shadow-xs shrink-0">
                <button
                  type="button"
                  onClick={handleDecreaseCart}
                  className="w-9 h-9 rounded-lg bg-surface-subtle hover:bg-border-neutral flex items-center justify-center text-text-main transition active:scale-95"
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-4 h-4 text-brand font-bold" />
                </button>
                <span className="w-10 text-center text-sm font-extrabold text-brand font-mono">
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
                onClick={() => {
                  onClose();
                  navigate('/cart');
                }}
                className="flex-1 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 bg-brand-light text-brand border border-brand/30 hover:bg-brand hover:text-white transition active:scale-98 shadow-xs"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>
                  {qtyInCart} in Bag • View Cart (₹{((activeVariant.pricePaise * qtyInCart) / 100).toFixed(0)})
                </span>
              </button>
            </div>
          ) : (
            /* Variant is NOT in cart: show initial quantity stepper + Add to Bag button */
            <div className="flex items-center gap-3">
              <div className="flex items-center bg-surface border border-border-neutral rounded-xl p-1 shadow-xs shrink-0">
                <button
                  type="button"
                  onClick={() => setInitialQuantity((q) => Math.max(1, q - 1))}
                  className="w-8 h-8 rounded-lg bg-surface-subtle hover:bg-border-neutral flex items-center justify-center text-text-main transition active:scale-95"
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-8 text-center text-xs font-bold text-brand font-mono">
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
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold transition active:scale-95 ${
                    initialQuantity >= (activeVariant.stock || 1)
                      ? 'bg-border-neutral text-text-muted cursor-not-allowed opacity-60'
                      : 'bg-brand hover:bg-brand-hover'
                  }`}
                  aria-label="Increase quantity"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Add to Bag Button */}
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={isOutOfStock || isSubmitting}
                className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition ${
                  isOutOfStock
                    ? 'bg-surface-subtle text-text-muted border border-border-neutral cursor-not-allowed shadow-none'
                    : 'bg-brand hover:bg-brand-hover text-white active:scale-98'
                }`}
              >
                <ShoppingBag className="w-4 h-4" />
                <span>
                  {isOutOfStock
                    ? 'Out of Stock'
                    : `Add to Bag • ₹${(((activeVariant.pricePaise || 0) * initialQuantity) / 100).toFixed(0)}`}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
