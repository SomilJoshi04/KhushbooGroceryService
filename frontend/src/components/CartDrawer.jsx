/**
 * Shopping Cart Drawer Component — Full-Height Responsive Panel.
 *
 * Implements a fixed right-side overlay adhering to professional e-commerce UX:
 * - Fixed full viewport height (h-screen / h-dvh) with independent scrollable item list.
 * - Clean white card surfaces, soft neutral borders, and forest green accents.
 * - Refined, compact empty state with direct category shortcuts.
 * - Item cards with pack size badges, real-time quantity stepper, and quick remove action.
 * - Indore delivery threshold calculation, saved address selector, coupon vouchers, and transparent bill summary.
 *
 * @module components/CartDrawer
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Plus,
  Minus,
  ShoppingBag,
  Truck,
  CheckCircle2,
  MapPin,
  CreditCard,
  Banknote,
  ArrowRight,
  Tag,
  AlertCircle,
  Trash2,
  ChevronRight,
} from 'lucide-react';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useStoreSettings } from '../context/StoreSettingsContext.jsx';
import { apiClient } from '../config/api.js';

export function CartDrawer({ onOpenAuth }) {
  const {
    cart,
    isCartOpen,
    setIsCartOpen,
    updateQty,
    removeFromCart,
    clearCart,
    cartItemCount,
    cartSubtotalPaise,
    cartSavingsPaise,
    deliveryFeePaise,
    grandTotalPaise,
    isFreeDelivery,
    amountNeededForFreeDeliveryPaise,
    FREE_DELIVERY_THRESHOLD_PAISE,
    MIN_ORDER_AMOUNT_PAISE,
  } = useCart();

  const { isAuthenticated, user } = useAuth();
  const { settings } = useStoreSettings();
  const navigate = useNavigate();

  const codEnabled = settings?.paymentSettings?.codEnabled ?? true;
  const onlineEnabled = settings?.paymentSettings?.onlinePaymentEnabled ?? true;
  const isAnyPaymentEnabled = codEnabled || onlineEnabled;

  const [paymentMode, setPaymentMode] = useState(codEnabled ? 'COD' : 'ONLINE'); // 'COD' | 'ONLINE'
  const [streetAddress, setStreetAddress] = useState('123 MG Road, Geeta Bhawan, Indore');
  const [pincode, setPincode] = useState('452001');
  const [recipientName, setRecipientName] = useState('Valued Customer');
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [matchedZone, setMatchedZone] = useState(null);

  // Coupon State
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState('');

  // Order Confirmation State
  const [orderConfirmed, setOrderConfirmed] = useState(false);
  const [confirmedOrderNumber, setConfirmedOrderNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [isPincodeServiceable, setIsPincodeServiceable] = useState(true);
  const [pincodeReason, setPincodeReason] = useState('');

  // Available Promo Offers to recommend
  const availableOffers = [
    { code: 'KHUSHBOO50', label: '₹50 OFF on ₹399+' },
    { code: 'FRESH10', label: '10% OFF' },
  ];

  // Lock background body scroll and listen for Escape key when drawer is open
  useEffect(() => {
    if (!isCartOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsCartOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isCartOpen, setIsCartOpen]);

  // Auto-fill address from user profile / default address if available
  useEffect(() => {
    if (user) {
      if (user.name && user.name !== 'Grocery Customer') {
        setRecipientName(user.name);
      }
      if (Array.isArray(user.addresses) && user.addresses.length > 0) {
        const def = user.addresses.find((a) => a.isDefault) || user.addresses[0];
        setSelectedAddressId(def._id);
        setStreetAddress(def.street || '');
        setPincode(def.pincode || '452001');
        if (def.recipientName) setRecipientName(def.recipientName);
      }
    }
  }, [user]);

  if (!isCartOpen) return null;

  const effectiveMinOrderPaise =
    matchedZone?.minOrderAmountPaise ??
    settings?.effectiveMinOrderAmountPaise ??
    settings?.minOrderAmountPaise ??
    MIN_ORDER_AMOUNT_PAISE;
  const isBelowMinOrder = cartSubtotalPaise > 0 && cartSubtotalPaise < effectiveMinOrderPaise;

  // Auto-switch payment mode if the currently selected mode is disabled by store settings
  useEffect(() => {
    if (codEnabled && !onlineEnabled && paymentMode !== 'COD') {
      setPaymentMode('COD');
    } else if (!codEnabled && onlineEnabled && paymentMode !== 'ONLINE') {
      setPaymentMode('ONLINE');
    }
  }, [codEnabled, onlineEnabled, paymentMode]);

  const freeDeliveryProgress = Math.min(
    100,
    Math.round((cartSubtotalPaise / FREE_DELIVERY_THRESHOLD_PAISE) * 100)
  );

  const couponDiscountPaise = appliedCoupon?.discountPaise || 0;
  const finalPayablePaise = Math.max(0, grandTotalPaise - couponDiscountPaise);

  const handlePincodeChange = async (newPincode) => {
    setPincode(newPincode);
    if (newPincode.length === 6) {
      try {
        const res = await apiClient.post('/v1/delivery/check', {
          pincode: newPincode,
          city: 'Indore',
          subtotalPaise: cartSubtotalPaise,
        });
        setIsPincodeServiceable(res.data.isServiceable);
        setPincodeReason(res.data.reason || '');
        const zoneData = res.data.zone
          ? {
              ...res.data.zone,
              minOrderAmountPaise: res.data.zone.minOrderAmountPaise ?? res.data.minOrderAmountPaise,
            }
          : (res.data.minOrderAmountPaise !== undefined ? { minOrderAmountPaise: res.data.minOrderAmountPaise } : null);
        setMatchedZone(zoneData);
      } catch {
        setIsPincodeServiceable(false);
        setPincodeReason('Unable to verify delivery for this PIN code');
      }
    }
  };

  const handleSelectSavedAddress = (addrId) => {
    setSelectedAddressId(addrId);
    const addr = user?.addresses?.find((a) => a._id === addrId);
    if (addr) {
      setStreetAddress(addr.street || '');
      setPincode(addr.pincode || '452001');
      if (addr.recipientName) setRecipientName(addr.recipientName);
      handlePincodeChange(addr.pincode || '452001');
    }
  };

  const handleApplyCoupon = async (codeToApply) => {
    const code = (codeToApply || couponInput).trim().toUpperCase();
    if (!code) return;

    setCouponLoading(true);
    setCouponError('');

    try {
      const res = await apiClient.post('/v1/store/coupons/validate', {
        code,
        subtotalPaise: cartSubtotalPaise,
      });

      if (res.data?.success && res.data?.valid) {
        setAppliedCoupon(res.data);
        setCouponInput(code);
        setCouponError('');
      }
    } catch (err) {
      setAppliedCoupon(null);
      setCouponError(err.response?.data?.message || err.message || 'Invalid coupon voucher');
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput('');
    setCouponError('');
  };

  const handleRemoveItem = (variantSku, currentQty) => {
    updateQty(variantSku, -currentQty);
  };

  const handlePlaceOrder = async () => {
    if (!isAuthenticated) {
      setIsCartOpen(false);
      onOpenAuth();
      return;
    }

    if (isBelowMinOrder) {
      setCheckoutError(
        `Minimum order amount is ₹${(effectiveMinOrderPaise / 100).toFixed(0)}. Please add ₹${(
          (effectiveMinOrderPaise - cartSubtotalPaise) /
          100
        ).toFixed(0)} more.`
      );
      return;
    }

    if (!isPincodeServiceable) {
      setCheckoutError(pincodeReason || 'This PIN code is currently outside our Indore service zone.');
      return;
    }

    if (!isAnyPaymentEnabled) {
      setCheckoutError('Checkout is temporarily unavailable as all payment options are paused by the store.');
      return;
    }

    if (paymentMode === 'COD' && !codEnabled) {
      setCheckoutError('Cash on Delivery is currently unavailable. Please select Online Payment.');
      return;
    }

    if (paymentMode === 'ONLINE' && !onlineEnabled) {
      setCheckoutError('Online payment is currently unavailable. Please select Cash on Delivery.');
      return;
    }

    setCheckoutError('');
    setSubmitting(true);

    try {
      const orderPayload = {
        items: cart.map((i) => ({
          productId: i.productId,
          sku: i.variantSku,
          quantity: i.qty,
        })),
        deliveryAddress: {
          recipientName: recipientName.trim() || user?.name || 'Valued Customer',
          phone: user?.phone || '9826012345',
          street: streetAddress,
          city: 'Indore',
          state: 'Madhya Pradesh',
          pincode: pincode,
        },
        paymentMethod: paymentMode,
        couponCode: appliedCoupon?.code || undefined,
        idempotencyKey: `IDEM-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      };

      const res = await apiClient.post('/v1/orders', orderPayload);

      if (res.data?.success && res.data?.order) {
        setConfirmedOrderNumber(res.data.order.orderNumber);
        setOrderConfirmed(true);
        clearCart();
        setAppliedCoupon(null);
      }
    } catch (err) {
      setCheckoutError(err.message || 'Unable to place order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExploreCategory = (slug) => {
    setIsCartOpen(false);
    if (slug) {
      navigate(`/categories/${slug}`);
    } else {
      navigate('/categories');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden animate-fadeIn">
      {/* Subtle Backdrop with click to close */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-300"
        onClick={() => setIsCartOpen(false)}
        aria-hidden="true"
      />

      {/* Fixed Full-Height Right-Attached Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Shopping Cart"
        onClick={(e) => e.stopPropagation()}
        className="fixed top-0 right-0 bottom-0 z-50 w-full sm:w-[440px] md:w-[460px] max-w-full h-full h-dvh bg-surface border-l border-border-neutral flex flex-col shadow-2xl text-text-main"
      >
        {/* Header (Sticky Top) */}
        <div className="px-5 py-4 border-b border-border-neutral bg-surface-subtle flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-brand-light border border-brand/20 flex items-center justify-center text-brand shrink-0">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold font-heading text-text-main tracking-tight truncate">
                  Your Cart
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-light text-brand border border-brand/20 shrink-0">
                  {cartItemCount} {cartItemCount === 1 ? 'item' : 'items'}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-text-muted mt-0.5 truncate">
                <MapPin className="w-3 h-3 text-brand shrink-0" />
                <span>Central Indore (90-120 mins)</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsCartOpen(false)}
            className="w-8 h-8 rounded-lg bg-surface hover:bg-border-neutral border border-border-neutral text-text-muted hover:text-text-main flex items-center justify-center transition shrink-0 active:scale-95 shadow-xs"
            aria-label="Close cart drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body (Flex-1) */}
        {orderConfirmed ? (
          /* Order Confirmation View */
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center overflow-y-auto">
            <div className="w-16 h-16 rounded-2xl bg-status-success/10 border border-status-success/20 text-status-success flex items-center justify-center mb-4 shadow-sm">
              <CheckCircle2 className="w-8 h-8 animate-bounce" />
            </div>

            <span className="text-[10px] font-bold uppercase tracking-widest text-brand bg-brand-light px-3 py-1 rounded-full border border-brand/20 mb-2">
              Order Placed Successfully
            </span>
            <h3 className="text-xl font-bold font-heading text-text-main mb-1">Thank you!</h3>
            <p className="text-xs text-text-muted max-w-xs mb-5">
              Your grocery order <span className="text-brand font-mono font-bold">#{confirmedOrderNumber}</span> is confirmed for delivery in Indore.
            </p>

            <div className="bg-surface-subtle p-4 rounded-xl border border-border-neutral text-left w-full mb-5 text-xs space-y-2">
              <div className="flex justify-between text-text-main">
                <span className="text-text-muted">Payment:</span>
                <span className="font-semibold text-text-main">
                  {paymentMode === 'COD' ? 'Cash on Delivery' : 'Online Paid'}
                </span>
              </div>
              <div className="flex justify-between text-text-main">
                <span className="text-text-muted">Address:</span>
                <span className="font-semibold text-text-main truncate max-w-[190px]">{streetAddress}</span>
              </div>
              <div className="flex justify-between text-text-main">
                <span className="text-text-muted">Delivery Window:</span>
                <span className="font-semibold text-brand">90-120 mins</span>
              </div>
            </div>

            <div className="space-y-2 w-full">
              <button
                onClick={() => {
                  setOrderConfirmed(false);
                  setIsCartOpen(false);
                  navigate('/account/orders');
                }}
                className="w-full py-2.5 bg-brand hover:bg-brand-hover text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5"
              >
                <span>Track Order</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  setOrderConfirmed(false);
                  setIsCartOpen(false);
                }}
                className="w-full py-2 bg-surface hover:bg-surface-subtle border border-border-neutral text-text-main font-semibold text-xs rounded-xl transition"
              >
                Continue Shopping
              </button>
            </div>
          </div>
        ) : cart.length === 0 ? (
          /* Clean & Compact Empty State */
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-surface-subtle border border-border-neutral flex items-center justify-center text-text-muted mb-4 shadow-xs">
              <ShoppingBag className="w-8 h-8 text-brand" />
            </div>

            <h3 className="text-base font-bold font-heading text-text-main mb-1">
              Your cart is empty
            </h3>
            <p className="text-xs text-text-muted max-w-xs mb-6">
              Add fresh groceries, stone-ground flours, and daily essentials to get started.
            </p>

            {/* Compact Category Shortcuts */}
            <div className="w-full max-w-xs mb-6">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block mb-2">
                Popular Departments
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { name: 'Wheat Flour & Grains', slug: 'atta-flour' },
                  { name: 'Spices & Seasonings', slug: 'masale-spices' },
                  { name: 'Pulses & Lentils', slug: 'daal-pulses' },
                  { name: 'Cooking Oils', slug: 'oil-ghee' },
                ].map((cat) => (
                  <button
                    key={cat.slug}
                    type="button"
                    onClick={() => handleExploreCategory(cat.slug)}
                    className="px-2.5 py-1.5 rounded-lg bg-surface hover:bg-surface-subtle border border-border-neutral text-text-main hover:text-brand text-xs font-medium transition flex items-center justify-between shadow-xs"
                  >
                    <span>{cat.name}</span>
                    <ChevronRight className="w-3 h-3 text-text-muted" />
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setIsCartOpen(false)}
              className="px-6 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-white font-bold text-xs shadow-xs transition active:scale-95"
            >
              Continue Shopping
            </button>
          </div>
        ) : (
          /* Cart with Items View */
          <>
            {/* Free Delivery Bar */}
            <div className="px-4 py-2 bg-surface-subtle border-b border-border-neutral shrink-0">
              <div className="flex items-center justify-between text-xs font-medium mb-1">
                <div className="flex items-center gap-1.5 text-brand">
                  <Truck className="w-3.5 h-3.5 text-brand shrink-0" />
                  <span className="text-[11px] font-semibold truncate">
                    {isFreeDelivery
                      ? '🎉 Unlocked FREE Delivery in Indore!'
                      : `Add ₹${(amountNeededForFreeDeliveryPaise / 100).toFixed(0)} more for FREE Delivery!`}
                  </span>
                </div>
                <span className="text-brand font-bold text-[11px] font-mono shrink-0 ml-2">
                  {freeDeliveryProgress}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-border-neutral rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand transition-all duration-300 rounded-full"
                  style={{ width: `${freeDeliveryProgress}%` }}
                />
              </div>
            </div>

            {/* Scrollable Items List */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
              <AnimatePresence initial={false}>
                {cart.map((item) => {
                  const itemTotalRupees = (item.pricePaise * item.qty) / 100;
                  const itemMrpRupees = (item.mrpPaise * item.qty) / 100;
                  const itemKey = item.cartKey || item.variantSku || item.variantId;
                  const isMaxStock = item.stock > 0 && item.qty >= item.stock;

                  return (
                    <motion.div
                      key={itemKey}
                      layout
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, height: 0, overflow: 'hidden', margin: 0, padding: 0 }}
                      transition={{ duration: 0.2 }}
                      className="p-3 bg-surface border border-border-neutral rounded-xl flex gap-3 items-center hover:border-brand/40 transition shadow-xs"
                    >
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-14 h-14 rounded-lg object-cover shrink-0 bg-surface-subtle border border-border-neutral"
                        onError={(e) => {
                          e.currentTarget.src =
                            'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80';
                        }}
                      />

                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-semibold text-text-main line-clamp-1" title={item.name}>
                          {item.name}
                        </h4>
                        <div className="flex items-center gap-1.5 text-[11px] text-text-muted mt-0.5">
                          <span className="px-1.5 py-0.2 rounded bg-brand-light text-brand font-semibold text-[10px]">
                            {item.variantLabel}
                          </span>
                          <span>₹{(item.pricePaise / 100).toFixed(0)} / pack</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs font-extrabold text-brand font-mono">
                            ₹{itemTotalRupees.toFixed(0)}
                          </span>
                          {item.mrpPaise > item.pricePaise && (
                            <span className="text-[10px] text-text-muted line-through font-mono">
                              ₹{itemMrpRupees.toFixed(0)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Stepper + Delete Action */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center bg-surface border border-border-neutral rounded-lg p-0.5 shadow-xs">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              updateQty(itemKey, -1);
                            }}
                            className="w-5 h-5 rounded bg-surface-subtle hover:bg-border-neutral flex items-center justify-center text-text-main transition cursor-pointer"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="w-3 h-3 text-brand" />
                          </button>
                          <span className="w-6 text-center text-xs font-bold text-brand font-mono">
                            {item.qty}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              updateQty(itemKey, 1);
                            }}
                            disabled={isMaxStock}
                            className={`w-5 h-5 rounded flex items-center justify-center text-white font-bold transition ${
                              isMaxStock
                                ? 'bg-border-neutral text-text-muted cursor-not-allowed opacity-50'
                                : 'bg-brand hover:bg-brand-hover cursor-pointer'
                            }`}
                            aria-label="Increase quantity"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            removeFromCart(itemKey);
                          }}
                          className="p-1 text-text-muted hover:text-status-error transition cursor-pointer"
                          title="Remove item"
                          aria-label="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {/* Bottom Checkout & Bill Summary (Sticky Bottom) */}
            <div className="border-t border-border-neutral bg-surface p-4 space-y-3 shrink-0 shadow-lg">
              {/* Promo Coupon Bar */}
              <div className="bg-surface-subtle p-2 rounded-xl border border-border-neutral text-xs">
                {appliedCoupon ? (
                  <div className="flex items-center justify-between text-brand text-[11px] font-semibold">
                    <span className="flex items-center gap-1 font-mono">
                      <Tag className="w-3 h-3" /> {appliedCoupon.code} applied (-₹{(appliedCoupon.discountPaise / 100).toFixed(0)})
                    </span>
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      className="text-text-muted hover:text-status-error font-bold ml-2"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      placeholder="Coupon Code"
                      className="flex-1 bg-surface border border-border-neutral rounded-lg px-2.5 py-1 text-[11px] text-text-main uppercase font-mono placeholder:text-text-muted focus:outline-none focus:border-brand"
                    />
                    <button
                      type="button"
                      disabled={couponLoading || !couponInput.trim()}
                      onClick={() => handleApplyCoupon()}
                      className="px-3 py-1 bg-brand hover:bg-brand-hover text-white font-bold text-[11px] rounded-lg transition disabled:opacity-50"
                    >
                      {couponLoading ? '...' : 'Apply'}
                    </button>
                    {availableOffers.map((o) => (
                      <button
                        key={o.code}
                        type="button"
                        onClick={() => handleApplyCoupon(o.code)}
                        className="hidden sm:inline-block px-1.5 py-1 bg-surface-subtle hover:bg-border-neutral text-brand font-mono text-[10px] rounded border border-border-neutral"
                      >
                        {o.code}
                      </button>
                    ))}
                  </div>
                )}
                {couponError && (
                  <p className="text-[10px] text-status-error mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {couponError}
                  </p>
                )}
              </div>

              {/* Delivery Address & Pincode Selector */}
              <div className="bg-surface-subtle p-2.5 rounded-xl border border-border-neutral text-xs space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-text-muted flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-brand" /> Deliver to:
                  </span>
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                      isPincodeServiceable
                        ? 'text-status-success bg-status-success/10'
                        : 'text-status-error bg-status-error/10'
                    }`}
                  >
                    {isPincodeServiceable ? 'Indore Serviceable' : 'Outside Service Zone'}
                  </span>
                </div>

                {user?.addresses && user.addresses.length > 0 ? (
                  <select
                    value={selectedAddressId}
                    onChange={(e) => handleSelectSavedAddress(e.target.value)}
                    className="w-full bg-surface border border-border-neutral rounded-lg px-2 py-1 text-[11px] text-text-main focus:outline-none focus:border-brand shadow-xs"
                  >
                    {user.addresses.map((a) => (
                      <option key={a._id} value={a._id}>
                        {a.tag || 'Saved'} — {a.street}, {a.pincode}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={streetAddress}
                    onChange={(e) => setStreetAddress(e.target.value)}
                    placeholder="Street / house address in Indore"
                    className="w-full bg-surface border border-border-neutral rounded-lg px-2 py-1 text-[11px] text-text-main placeholder:text-text-muted focus:outline-none focus:border-brand shadow-xs"
                  />
                )}
              </div>

              {/* Payment Mode Selector */}
              {!isAnyPaymentEnabled ? (
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 text-[11px] flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                  <span>Checkout paused: All payment modes are currently disabled.</span>
                </div>
              ) : codEnabled && onlineEnabled ? (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setPaymentMode('COD')}
                    className={`py-1.5 px-2 rounded-lg border flex items-center justify-center gap-1.5 text-[11px] transition ${
                      paymentMode === 'COD'
                        ? 'border-brand bg-brand-light text-brand font-bold ring-1 ring-brand/30 shadow-xs'
                        : 'border-border-neutral bg-surface text-text-muted hover:text-text-main'
                    }`}
                  >
                    <Banknote className="w-3.5 h-3.5 text-brand" />
                    <span>Cash on Delivery</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMode('ONLINE')}
                    className={`py-1.5 px-2 rounded-lg border flex items-center justify-center gap-1.5 text-[11px] transition ${
                      paymentMode === 'ONLINE'
                        ? 'border-brand bg-brand-light text-brand font-bold ring-1 ring-brand/30 shadow-xs'
                        : 'border-border-neutral bg-surface text-text-muted hover:text-text-main'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5 text-brand" />
                    <span>UPI / Online</span>
                  </button>
                </div>
              ) : codEnabled ? (
                <div className="py-1.5 px-2.5 rounded-lg border border-brand bg-brand-light text-brand font-bold ring-1 ring-brand/30 shadow-xs flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <Banknote className="w-3.5 h-3.5 text-brand" />
                    <span>Cash on Delivery</span>
                  </div>
                  <span className="text-[9px] uppercase tracking-wider bg-brand/10 text-brand px-1.5 py-0.5 rounded font-semibold">Active</span>
                </div>
              ) : (
                <div className="py-1.5 px-2.5 rounded-lg border border-brand bg-brand-light text-brand font-bold ring-1 ring-brand/30 shadow-xs flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-brand" />
                    <span>UPI / Online</span>
                  </div>
                  <span className="text-[9px] uppercase tracking-wider bg-brand/10 text-brand px-1.5 py-0.5 rounded font-semibold">Active</span>
                </div>
              )}

              {/* Price Breakdown */}
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-text-muted text-[11px]">
                  <span>Item Subtotal:</span>
                  <span className="text-text-main font-medium">₹{(cartSubtotalPaise / 100).toFixed(0)}</span>
                </div>
                {couponDiscountPaise > 0 && (
                  <div className="flex justify-between text-brand text-[11px] font-medium">
                    <span>Coupon Discount:</span>
                    <span>-₹{(couponDiscountPaise / 100).toFixed(0)}</span>
                  </div>
                )}
                <div className="flex justify-between text-text-muted text-[11px]">
                  <span>Delivery Fee:</span>
                  <span className={isFreeDelivery ? 'text-status-success font-bold' : 'text-text-main'}>
                    {isFreeDelivery ? 'FREE' : `₹${(deliveryFeePaise / 100).toFixed(0)}`}
                  </span>
                </div>
                <div className="pt-1.5 border-t border-border-neutral flex justify-between text-sm font-bold text-text-main">
                  <span>To Pay:</span>
                  <span className="text-brand font-extrabold font-mono text-base">
                    ₹{(finalPayablePaise / 100).toFixed(0)}
                  </span>
                </div>
              </div>

              {/* Errors & Alerts */}
              {isBelowMinOrder && (
                <div className="p-2 bg-status-warning/10 border border-status-warning/20 rounded-lg text-status-warning text-[11px] flex items-center justify-between">
                  <span>Min order ₹{(effectiveMinOrderPaise / 100).toFixed(0)}</span>
                  <span className="font-bold">Add ₹{((effectiveMinOrderPaise - cartSubtotalPaise) / 100).toFixed(0)} more</span>
                </div>
              )}

              {checkoutError && (
                <div className="p-2 bg-status-error/10 border border-status-error/20 rounded-lg text-status-error text-[11px]">
                  {checkoutError}
                </div>
              )}

              {/* Checkout Button */}
              <button
                type="button"
                onClick={handlePlaceOrder}
                disabled={submitting || isBelowMinOrder || !isPincodeServiceable || !isAnyPaymentEnabled}
                className={`w-full py-2.5 font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 ${
                  submitting || isBelowMinOrder || !isPincodeServiceable || !isAnyPaymentEnabled
                    ? 'bg-border-neutral text-text-muted cursor-not-allowed shadow-none'
                    : 'bg-brand hover:bg-brand-hover text-white active:scale-98'
                }`}
              >
                {submitting ? (
                  <div className="flex items-center gap-1.5">
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Processing...</span>
                  </div>
                ) : isAuthenticated ? (
                  <>
                    <span>Place Grocery Order • ₹{(finalPayablePaise / 100).toFixed(0)}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                ) : (
                  <>
                    <span>Log In with OTP to Checkout</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
