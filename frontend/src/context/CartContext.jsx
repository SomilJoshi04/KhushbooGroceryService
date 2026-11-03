/**
 * Cart Context for Grocery E-Commerce.
 *
 * Centralized, production-grade cart management:
 * - Strict Login-Required Shopping: Only authenticated customers can modify cart or checkout.
 * - Polite Guest Authentication Prompt with preserved intended action resumption.
 * - Authoritative Server Sync: Direct integration with authenticated backend cart APIs.
 * - Single source of truth across product cards, detail modals, detail pages, header, and cart.
 * - Stable unique variant identity: productId + variantId (SKU / pack size).
 * - Live quantity synchronization without page refreshes.
 * - Integer paise financial calculations for zero rounding discrepancy.
 * - Framer Motion product-to-cart flight animation orchestration.
 *
 * @module context/CartContext
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, X } from 'lucide-react';
import { CartFlyingOverlay } from '../components/CartFlyingOverlay.jsx';
import { GuestAuthPromptModal } from '../components/GuestAuthPromptModal.jsx';
import { useStoreSettings } from './StoreSettingsContext.jsx';
import { useAuth } from './AuthContext.jsx';
import { apiClient } from '../config/api.js';

const CartContext = createContext(null);

/**
 * Returns a stable unique cart item key based on product ID and variant ID/SKU.
 */
export function getCartItemKey(productId, variant) {
  if (!productId) return '';
  const vId = variant?._id || variant?.sku || variant?.label || 'default';
  return `${productId}::${vId}`;
}

/**
 * Resolves a stable unique identifier string for a variant.
 */
export function getVariantId(variant) {
  if (!variant) return '';
  return String(variant._id || variant.sku || variant.label || '');
}

/**
 * Robust item finder matching composite key or fallback variant identifiers.
 */
export function findCartItemInList(cartList, productId, variant) {
  if (!cartList || !Array.isArray(cartList) || !productId || !variant) return null;
  const targetKey = getCartItemKey(productId, variant);

  return (
    cartList.find((item) => {
      if (item.cartKey && item.cartKey === targetKey) return true;
      const matchProduct = String(item.productId) === String(productId);
      const matchVariant =
        (variant.sku && item.variantSku === variant.sku) ||
        (variant._id && item.variantId && String(item.variantId) === String(variant._id)) ||
        (variant.label && item.variantLabel === variant.label);
      return matchProduct && matchVariant;
    }) || null
  );
}

export function CartProvider({ children }) {
  const { settings } = useStoreSettings();
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  const FREE_DELIVERY_THRESHOLD_PAISE = settings?.effectiveFreeDeliveryThresholdPaise ?? settings?.freeDeliveryThresholdPaise ?? 49900;
  const STANDARD_DELIVERY_FEE_PAISE = settings?.deliveryFeeBasePaise || 2500;
  const MIN_ORDER_AMOUNT_PAISE = settings?.effectiveMinOrderAmountPaise ?? settings?.minOrderAmountPaise ?? 1000;

  // Active cart items array
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cartToast, setCartToast] = useState(null);
  const toastTimeoutRef = useRef(null);

  // Polite Guest Authentication Prompt state
  const [isGuestPromptOpen, setIsGuestPromptOpen] = useState(false);

  // Pending action preservation store (in-memory + sessionStorage with expiration)
  const [pendingCartAction, setPendingCartAction] = useState(() => {
    try {
      const saved = sessionStorage.getItem('khushboo_pending_cart_action');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Number(parsed.expiresAt) > Date.now()) {
          return parsed;
        }
      }
      return null;
    } catch {
      return null;
    }
  });

  // Flying thumbnail animation state
  const [flyingItems, setFlyingItems] = useState([]);
  const [cartBounceKey, setCartBounceKey] = useState(0);

  const showToast = useCallback((message, type = 'success', options = {}) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    const showViewCart =
      options.showViewCart ??
      (type === 'success' && (message.includes('to bag') || message.includes('to cart') || message.includes('Added')));

    setCartToast({
      message,
      type,
      showViewCart,
    });

    const duration = options.duration || (showViewCart ? 4500 : 3000);
    toastTimeoutRef.current = setTimeout(() => {
      setCartToast(null);
    }, duration);
  }, []);

  const handleToastMouseEnter = useCallback(() => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
  }, []);

  const handleToastMouseLeave = useCallback(() => {
    if (cartToast) {
      toastTimeoutRef.current = setTimeout(() => {
        setCartToast(null);
      }, 2200);
    }
  }, [cartToast]);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  // ── Centralized Product Variant Selection State ─────────────────────────────
  const [selectedVariants, setSelectedVariants] = useState(() => {
    try {
      const saved = sessionStorage.getItem('khushboo_selected_variants');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem('khushboo_selected_variants', JSON.stringify(selectedVariants));
    } catch {
      // Ignore storage errors
    }
  }, [selectedVariants]);

  const setSelectedVariant = useCallback((productId, variantIdentifier) => {
    if (!productId || !variantIdentifier) return;
    const pId = String(productId);
    const vId = String(variantIdentifier);

    setSelectedVariants((prev) => {
      if (prev[pId] === vId) return prev;
      return { ...prev, [pId]: vId };
    });
  }, []);

  const getSelectedVariant = useCallback(
    (product) => {
      if (!product) return null;
      const variants = product.variants || [];
      if (variants.length === 0) return null;

      const pId = String(product._id);
      const savedId = selectedVariants[pId];

      if (savedId) {
        const matched = variants.find(
          (v) =>
            (v._id && String(v._id) === savedId) ||
            (v.sku && v.sku === savedId) ||
            (v.label && v.label === savedId)
        );
        if (matched) return matched;
      }

      const cartItemsForProduct = cart.filter((item) => String(item.productId) === pId);
      if (cartItemsForProduct.length > 0) {
        const latestCartItem = cartItemsForProduct[cartItemsForProduct.length - 1];
        const matched = variants.find(
          (v) =>
            (latestCartItem.variantId && v._id && String(v._id) === String(latestCartItem.variantId)) ||
            (latestCartItem.variantSku && v.sku && v.sku === latestCartItem.variantSku) ||
            (latestCartItem.variantLabel && v.label && v.label === latestCartItem.variantLabel)
        );
        if (matched) return matched;
      }

      const firstInStock = variants.find((v) => (v.stock || 0) > 0);
      return firstInStock || variants[0];
    },
    [selectedVariants, cart]
  );

  // ── Authoritative Backend Sync & Pending Action Resumption ───────────────────
  const isResumingRef = useRef(false);

  useEffect(() => {
    // If not authenticated, ensure cart is empty and clear any guest storage
    if (!isAuthenticated) {
      setCart([]);
      try {
        localStorage.removeItem('khushboo_cart');
      } catch {}
      return;
    }

    let isMounted = true;

    async function syncAuthenticatedCart() {
      try {
        // 1. Check for valid, unexpired pending action from before sign-in
        let pending = null;
        try {
          const raw = sessionStorage.getItem('khushboo_pending_cart_action');
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && Number(parsed.expiresAt) > Date.now()) {
              pending = parsed;
            }
          }
        } catch {}

        if (pending && !isResumingRef.current) {
          isResumingRef.current = true;
          // Clear pending action immediately to prevent duplicate replay
          sessionStorage.removeItem('khushboo_pending_cart_action');
          setPendingCartAction(null);

          try {
            const resumeRes = await apiClient.post('/cart/items', {
              productId: pending.product._id,
              variantId: pending.variant._id,
              sku: pending.variant.sku,
              quantity: pending.quantityToAdd || 1,
            });

            if (isMounted && resumeRes.data?.success) {
              setCart(resumeRes.data.cart || []);
              showToast(
                `Added ${pending.product.name} (${pending.variant.label || 'Standard Pack'}) to bag!`,
                'success',
                { showViewCart: true }
              );
              setSelectedVariant(
                pending.product._id,
                pending.variant._id || pending.variant.sku || pending.variant.label
              );
              return;
            }
          } catch (resumeErr) {
            const msg =
              resumeErr.response?.data?.message ||
              'Item could not be added due to live stock or pricing changes.';
            showToast(msg, 'warning');
          }
        }

        // 2. Fetch authoritative persistent cart from MongoDB
        const res = await apiClient.get('/cart');
        if (isMounted && res.data?.success && Array.isArray(res.data.cart)) {
          setCart(res.data.cart);
          if (res.data.warnings && res.data.warnings.length > 0) {
            showToast(res.data.warnings[0], 'info');
          }
        }
      } catch (err) {
        console.error('[cart] Failed to sync authoritative cart with server:', err.message);
      }
    }

    syncAuthenticatedCart();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, showToast, setSelectedVariant]);

  /**
   * Retrieves quantity of a product variant currently in the cart.
   */
  const getItemQty = useCallback(
    (productId, variant) => {
      if (!productId || !variant || !isAuthenticated) return 0;
      const found = findCartItemInList(cart, productId, variant);
      return found ? found.qty : 0;
    },
    [cart, isAuthenticated]
  );

  /**
   * Adds an item to the cart.
   * Gated: Guests cannot add items to cart. Triggers polite guest prompt and saves pending action.
   */
  const addToCart = useCallback(
    async (product, variant, quantityToAdd = 1) => {
      if (!product || !variant) return { success: false, newQty: 0 };

      // ── GUEST ACCESS GATE ──────────────────────────────────────────────────
      if (!isAuthenticated) {
        const action = {
          product: {
            _id: String(product._id),
            name: product.name,
            images: product.images,
            brand: product.brand,
          },
          variant: {
            _id: variant._id ? String(variant._id) : '',
            sku: variant.sku || '',
            label: variant.label || 'Standard Pack',
            pricePaise: variant.pricePaise,
            mrpPaise: variant.mrpPaise,
          },
          quantityToAdd: quantityToAdd || 1,
          createdAt: Date.now(),
          expiresAt: Date.now() + 15 * 60 * 1000, // 15 minutes TTL
        };

        setPendingCartAction(action);
        try {
          sessionStorage.setItem('khushboo_pending_cart_action', JSON.stringify(action));
        } catch {}

        setIsGuestPromptOpen(true);
        return { success: false, reason: 'AUTH_REQUIRED', newQty: 0 };
      }

      // ── AUTHENTICATED CART OPERATION ──────────────────────────────────────
      try {
        const res = await apiClient.post('/cart/items', {
          productId: product._id,
          variantId: variant._id,
          sku: variant.sku,
          quantity: quantityToAdd,
        });

        if (res.data?.success) {
          setCart(res.data.cart || []);
          showToast(
            res.data.hitMax
              ? `Maximum available stock reached for ${product.name}.`
              : `Added ${product.name} (${variant.label}) to bag!`,
            res.data.hitMax ? 'warning' : 'success',
            { showViewCart: !res.data.hitMax }
          );
          setSelectedVariant(product._id, variant._id || variant.sku || variant.label);
          return { success: true, newQty: res.data.newQty };
        }
        return { success: false, reason: 'FAILED', newQty: 0 };
      } catch (err) {
        const msg = err.response?.data?.message || err.message || 'Failed to add item to bag.';
        showToast(msg, 'warning');
        return { success: false, reason: 'ERROR', message: msg, newQty: 0 };
      }
    },
    [isAuthenticated, showToast, setSelectedVariant]
  );

  /**
   * Updates quantity (+/- delta) or removes when dropped to 0.
   * Gated: Guests cannot modify cart quantities.
   */
  const updateQty = useCallback(
    async (identifier, delta) => {
      if (!identifier) return;

      if (!isAuthenticated) {
        setIsGuestPromptOpen(true);
        return { success: false, reason: 'AUTH_REQUIRED' };
      }

      try {
        const res = await apiClient.put(`/cart/items/${encodeURIComponent(identifier)}`, { delta });
        if (res.data?.success) {
          setCart(res.data.cart || []);
          if (res.data.hitMax) {
            showToast('Maximum available stock reached.', 'warning');
          }
        }
      } catch (err) {
        showToast(err.response?.data?.message || 'Failed to update quantity.', 'warning');
      }
    },
    [isAuthenticated, showToast]
  );

  /**
   * Removes an item completely from cart.
   */
  const removeFromCart = useCallback(
    async (identifier) => {
      if (!identifier || !isAuthenticated) return;

      try {
        const res = await apiClient.delete(`/cart/items/${encodeURIComponent(identifier)}`);
        if (res.data?.success) {
          setCart(res.data.cart || []);
          showToast('Item removed from cart.', 'info');
        }
      } catch (err) {
        showToast(err.response?.data?.message || 'Failed to remove item.', 'warning');
      }
    },
    [isAuthenticated, showToast]
  );

  /**
   * Empties the entire cart.
   */
  const clearCart = useCallback(async () => {
    if (!isAuthenticated) {
      setCart([]);
      return;
    }

    try {
      await apiClient.delete('/cart');
      setCart([]);
    } catch {
      setCart([]);
    }
  }, [isAuthenticated]);

  /**
   * Revalidates cart items against live database stock & prices.
   */
  const revalidateWithServer = useCallback(async () => {
    if (!isAuthenticated) return { success: true, valid: false };

    try {
      const res = await apiClient.get('/cart');
      if (res.data?.success && Array.isArray(res.data.cart)) {
        setCart(res.data.cart);
        return res.data;
      }
    } catch (err) {
      console.warn('[cart] Cart revalidation error:', err.message);
    }
    return { success: false };
  }, [isAuthenticated]);

  /**
   * Triggers a smooth product-to-cart flight animation from startElement to header cart icon.
   */
  const triggerFlyToCart = useCallback(({ startElement, imageUrl }) => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      setCartBounceKey((k) => k + 1);
      return;
    }

    if (!startElement || typeof startElement.getBoundingClientRect !== 'function') {
      setCartBounceKey((k) => k + 1);
      return;
    }

    const startRect = startElement.getBoundingClientRect();
    const cartTarget =
      document.getElementById('header-cart-icon') ||
      document.querySelector('[aria-label="View Shopping Cart"]');

    if (!cartTarget) {
      setCartBounceKey((k) => k + 1);
      return;
    }

    const targetRect = cartTarget.getBoundingClientRect();
    if (targetRect.width === 0 && targetRect.height === 0) {
      setCartBounceKey((k) => k + 1);
      return;
    }

    const id = 'fly_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const initialSize = Math.min(Math.max(startRect.width, startRect.height, 60), 90);
    const targetSize = 24;

    const startX = startRect.left + startRect.width / 2 - initialSize / 2;
    const startY = startRect.top + startRect.height / 2 - initialSize / 2;
    const targetX = targetRect.left + targetRect.width / 2 - initialSize / 2;
    const targetY = targetRect.top + targetRect.height / 2 - initialSize / 2;

    const newItem = {
      id,
      imageUrl: imageUrl || '',
      startX,
      startY,
      initialSize,
      targetX,
      targetY,
      targetSize,
    };

    setFlyingItems((prev) => [...prev, newItem]);

    setTimeout(() => {
      setFlyingItems((prev) => prev.filter((item) => item.id !== id));
    }, 1200);
  }, []);

  const handleFlyComplete = useCallback((id) => {
    setFlyingItems((prev) => prev.filter((item) => item.id !== id));
    setCartBounceKey((k) => k + 1);
  }, []);

  // Integer paise financial computations
  const cartSubtotalPaise = cart.reduce(
    (sum, item) => sum + (Number(item.pricePaise) || 0) * (Number(item.qty) || 0),
    0
  );

  const cartMrpTotalPaise = cart.reduce(
    (sum, item) =>
      sum + (Number(item.mrpPaise) || Number(item.pricePaise) || 0) * (Number(item.qty) || 0),
    0
  );

  const cartSavingsPaise = Math.max(0, cartMrpTotalPaise - cartSubtotalPaise);
  const cartItemCount = cart.reduce((count, item) => count + (Number(item.qty) || 0), 0);

  const isFreeDelivery = cartSubtotalPaise >= FREE_DELIVERY_THRESHOLD_PAISE;
  const deliveryFeePaise =
    cartSubtotalPaise > 0 ? (isFreeDelivery ? 0 : STANDARD_DELIVERY_FEE_PAISE) : 0;
  const grandTotalPaise = cartSubtotalPaise + deliveryFeePaise;
  const amountNeededForFreeDeliveryPaise = Math.max(
    0,
    FREE_DELIVERY_THRESHOLD_PAISE - cartSubtotalPaise
  );

  return (
    <CartContext.Provider
      value={{
        cart,
        isCartOpen,
        setIsCartOpen,
        getItemQty,
        addToCart,
        updateQty,
        removeFromCart,
        clearCart,
        revalidateWithServer,
        triggerFlyToCart,
        cartBounceKey,
        cartItemCount,
        cartSubtotalPaise,
        cartSavingsPaise,
        deliveryFeePaise,
        grandTotalPaise,
        isFreeDelivery,
        amountNeededForFreeDeliveryPaise,
        FREE_DELIVERY_THRESHOLD_PAISE,
        MIN_ORDER_AMOUNT_PAISE,
        selectedVariants,
        setSelectedVariant,
        getSelectedVariant,
        getVariantId,
        isGuestPromptOpen,
        setIsGuestPromptOpen,
        pendingCartAction,
      }}
    >
      {children}
      <CartFlyingOverlay flyingItems={flyingItems} onComplete={handleFlyComplete} />

      {/* Polite Guest Authentication Prompt Dialog */}
      <GuestAuthPromptModal
        isOpen={isGuestPromptOpen}
        onClose={() => setIsGuestPromptOpen(false)}
        onSignIn={() => {
          setIsGuestPromptOpen(false);
          window.dispatchEvent(new CustomEvent('khushboo:open_auth'));
        }}
        pendingAction={pendingCartAction}
      />

      {/* Floating feedback notification toast */}
      {cartToast && (
        <div
          role="status"
          aria-live="polite"
          onMouseEnter={handleToastMouseEnter}
          onMouseLeave={handleToastMouseLeave}
          className="fixed bottom-20 sm:bottom-5 right-3 sm:right-5 left-3 sm:left-auto sm:max-w-md z-50 px-4 py-3 rounded-2xl shadow-2xl border animate-slideUp flex items-center justify-between gap-3 backdrop-blur-md bg-surface/95 text-xs font-semibold text-text-main"
          style={{
            borderColor:
              cartToast.type === 'warning'
                ? 'rgba(234, 88, 12, 0.4)'
                : cartToast.type === 'info'
                ? 'rgba(100, 116, 139, 0.4)'
                : 'rgba(22, 101, 52, 0.4)',
          }}
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <span className="text-base shrink-0">
              {cartToast.type === 'warning' ? '⚠️' : cartToast.type === 'info' ? 'ℹ️' : '🛒'}
            </span>
            <span className="leading-snug text-text-main line-clamp-2">{cartToast.message}</span>
          </div>

          {cartToast.showViewCart && location?.pathname !== '/cart' && (
            <Link
              to="/cart"
              onClick={() => setCartToast(null)}
              className="shrink-0 hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-bold transition shadow-xs active:scale-95 focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer"
            >
              <span>View Cart</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}

          <button
            type="button"
            onClick={() => setCartToast(null)}
            className="text-text-muted hover:text-text-main p-1 rounded-lg transition shrink-0 cursor-pointer focus:outline-none"
            aria-label="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
