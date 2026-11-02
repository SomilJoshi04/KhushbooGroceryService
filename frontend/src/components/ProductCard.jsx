/**
 * Compact Grocery Product Card Component.
 *
 * Implements a clean, white product card against warm ivory page background:
 * - Square aspect-ratio image with subtle neutral background.
 * - Product name clamped to 2 lines with charcoal typography.
 * - Compact variant dropdown/selector with subtle border.
 * - Deep forest green genuine price, MRP strikethrough, and restrained discount badge.
 * - Centralized live cart quantity controls: shows "+ Add" when not in cart,
 *   and responsive "− quantity +" stepper when in cart.
 * - Live variant pack-size switching that immediately reflects each variant's cart state.
 * - Accessible out-of-stock and maximum-stock boundary indicators.
 *
 * @module components/ProductCard
 */

import React, { useState, useRef } from 'react';
import { Plus, Minus } from 'lucide-react';
import { useCart, getCartItemKey } from '../context/CartContext.jsx';

export function ProductCard({ product, onOpenDetails }) {
  const {
    getItemQty,
    addToCart,
    updateQty,
    triggerFlyToCart,
    getSelectedVariant,
    setSelectedVariant,
  } = useCart();
  const imageRef = useRef(null);
  const addBtnRef = useRef(null);

  const variants = product?.variants || [];
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

  const itemKey = getCartItemKey(product?._id, activeVariant);
  const qtyInCart = getItemQty(product?._id, activeVariant);

  const priceRupees = ((activeVariant.pricePaise || 0) / 100).toFixed(0);
  const mrpRupees = ((activeVariant.mrpPaise || 0) / 100).toFixed(0);
  const hasDiscount = (activeVariant.mrpPaise || 0) > (activeVariant.pricePaise || 0);
  const discountPercent = hasDiscount
    ? Math.round(
        ((activeVariant.mrpPaise - activeVariant.pricePaise) / activeVariant.mrpPaise) * 100
      )
    : 0;

  const isOutOfStock = (activeVariant.stock || 0) <= 0;
  const isMaxStockReached = qtyInCart >= (activeVariant.stock || 0);

  const handleAdd = async (e) => {
    e.stopPropagation();
    if (isOutOfStock) return;
    const res = await addToCart(product, activeVariant, 1);
    if (res?.success) {
      triggerFlyToCart({
        startElement: addBtnRef.current || imageRef.current || e.currentTarget,
        imageUrl: product.images?.[0],
      });
    }
  };

  const handleDecrease = (e) => {
    e.stopPropagation();
    updateQty(itemKey, -1);
  };

  const handleIncrease = (e) => {
    e.stopPropagation();
    if (isMaxStockReached) return;
    updateQty(itemKey, 1);
    triggerFlyToCart({
      startElement: e.currentTarget,
      imageUrl: product.images?.[0],
    });
  };

  const handleCardClick = () => {
    if (onOpenDetails) {
      onOpenDetails(product);
    }
  };

  return (
    <div
      onClick={handleCardClick}
      className="group relative bg-surface border border-border-neutral hover:border-brand/40 rounded-xl overflow-hidden transition-all duration-200 flex flex-col justify-between hover:shadow-xs cursor-pointer select-none"
    >
      {/* Product Image Container */}
      <div className="relative aspect-square w-full bg-surface-subtle overflow-hidden shrink-0 border-b border-border-neutral">
        <img
          ref={imageRef}
          src={
            product.images?.[0] ||
            'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80'
          }
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-102 transition duration-300"
          loading="lazy"
          onError={(e) => {
            e.currentTarget.src =
              'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80';
          }}
        />

        {/* Genuine Discount Badge (if applicable) */}
        {hasDiscount && (
          <span className="absolute top-2 left-2 bg-brand text-white px-1.5 py-0.5 rounded text-[10px] font-bold shadow-xs">
            {discountPercent}% OFF
          </span>
        )}

        {/* Out of Stock Overlay */}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-surface/85 backdrop-blur-xs flex items-center justify-center p-2 text-center">
            <span className="text-[11px] font-bold text-status-error bg-status-error/10 border border-status-error/20 px-2 py-0.5 rounded-full">
              Out of Stock
            </span>
          </div>
        )}
      </div>

      {/* Product Information */}
      <div className="p-3 flex-1 flex flex-col justify-between">
        <div>
          {/* Brand */}
          <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted block mb-0.5 truncate">
            {product.brand || 'Khushboo Pure'}
          </span>

          {/* Product Name (2 lines clamped) */}
          <h3
            className="font-heading font-semibold text-xs sm:text-sm text-text-main group-hover:text-brand transition line-clamp-2 h-8 sm:h-9 leading-snug"
            title={product.name}
          >
            {product.name}
          </h3>

          {/* Compact Variant Selector */}
          <div className="mt-2" onClick={(e) => e.stopPropagation()}>
            {variants.length > 1 ? (
              <select
                value={selectedVariantIndex}
                onChange={(e) => {
                  const idx = Number(e.target.value);
                  const chosen = variants[idx];
                  if (chosen) {
                    setSelectedVariant(product._id, chosen._id || chosen.sku || chosen.label);
                  }
                }}
                className="w-full bg-surface border border-border-neutral rounded-lg px-2 py-1 text-[11px] text-text-main focus:outline-none focus:border-brand cursor-pointer shadow-xs"
              >
                {variants.map((v, idx) => {
                  const vQty = getItemQty(product._id, v);
                  return (
                    <option key={v.sku || v._id || idx} value={idx}>
                      {v.label} — ₹{((v.pricePaise || 0) / 100).toFixed(0)}
                      {vQty > 0 ? ` (${vQty} in bag)` : ''}
                    </option>
                  );
                })}
              </select>
            ) : (
              <span className="inline-block text-[11px] text-text-muted font-medium py-0.5 truncate max-w-full">
                Pack: <strong className="text-text-main">{activeVariant.label}</strong>
              </span>
            )}
          </div>
        </div>

        {/* Price & Action Row */}
        <div className="mt-3 pt-2.5 border-t border-border-neutral flex items-center justify-between gap-1.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5 truncate">
              <span className="font-extrabold text-sm sm:text-base text-brand font-mono">
                ₹{priceRupees}
              </span>
              {hasDiscount && (
                <span className="text-[10px] text-text-muted line-through font-mono">
                  ₹{mrpRupees}
                </span>
              )}
            </div>
          </div>

          {/* Compact Add Button or Live Stepper */}
          <div onClick={(e) => e.stopPropagation()} className="shrink-0">
            {qtyInCart > 0 ? (
              <div className="flex items-center bg-surface border border-brand/40 rounded-lg p-0.5 shadow-xs">
                <button
                  type="button"
                  onClick={handleDecrease}
                  className="w-6 h-6 rounded bg-surface-subtle hover:bg-border-neutral active:scale-90 flex items-center justify-center text-text-main transition"
                  aria-label={`Decrease quantity of ${product.name} ${activeVariant.label}`}
                >
                  <Minus className="w-3.5 h-3.5 text-brand" />
                </button>
                <span className="w-6 text-center text-xs font-bold text-brand font-mono">
                  {qtyInCart}
                </span>
                <button
                  type="button"
                  onClick={handleIncrease}
                  disabled={isMaxStockReached}
                  className={`w-6 h-6 rounded flex items-center justify-center font-bold transition active:scale-90 ${
                    isMaxStockReached
                      ? 'bg-border-neutral text-text-muted cursor-not-allowed opacity-60'
                      : 'bg-brand hover:bg-brand-hover text-white shadow-xs'
                  }`}
                  aria-label={`Increase quantity of ${product.name} ${activeVariant.label}`}
                  title={isMaxStockReached ? `Maximum available stock (${activeVariant.stock})` : 'Add one more'}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                ref={addBtnRef}
                type="button"
                onClick={handleAdd}
                disabled={isOutOfStock}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 flex items-center gap-1 ${
                  isOutOfStock
                    ? 'bg-surface-subtle text-text-muted border border-border-neutral cursor-not-allowed'
                    : 'bg-brand hover:bg-brand-hover text-white active:scale-98 shadow-xs'
                }`}
                aria-label={`Add ${product.name} ${activeVariant.label} to cart`}
              >
                <Plus className="w-3 h-3" />
                <span>Add</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
