/**
 * Dedicated Full-Screen Cart & Checkout Page.
 *
 * Route: /cart
 * Comprehensive 2-column grocery cart and order view:
 * - Left Column: Cart items with images, variant pills, unit prices, steppers, remove actions,
 *   line subtotals, and Indore delivery address validation.
 * - Right Column: Free delivery tracker, order summary, promotional coupon vouchers,
 *   payment method selector, and Proceed to Checkout button.
 * Styled with warm ivory background, white surfaces, soft neutral borders, and deep forest green buttons.
 *
 * @module pages/CartPage
 */

import React, { useState, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag,
  Truck,
  Plus,
  Minus,
  CheckCircle2,
  MapPin,
  Map,
  Compass,
  Navigation,
  CreditCard,
  Banknote,
  ArrowRight,
  Tag,
  AlertCircle,
  Sparkles,
  ShieldCheck,
  Clock,
  ArrowLeft,
  Trash2,
  Store,
  Volume2,
} from 'lucide-react';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useStoreSettings } from '../context/StoreSettingsContext.jsx';
import { apiClient, resolveImageUrl, getApiUploadUrl, NEUTRAL_PRODUCT_PLACEHOLDER } from '../config/api.js';
import { LocationPickerModal } from '../components/map/LocationPickerModal.jsx';
import { ImageWithSkeleton } from '../components/skeleton/index.js';
import { useOrderSuccessSound } from '../hooks/useOrderSuccessSound.js';

export function CartPage({ onOpenAuth }) {
  const {
    cart,
    updateQty,
    removeFromCart,
    clearCart,
    revalidateWithServer,
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

  const { settings } = useStoreSettings();
  const { isAuthenticated, user, isAdmin } = useAuth();

  const codEnabled = settings?.paymentSettings?.codEnabled ?? true;
  const onlineEnabled = settings?.paymentSettings?.onlinePaymentEnabled ?? true;
  const isAnyPaymentEnabled = codEnabled || onlineEnabled;

  const [showClearCartModal, setShowClearCartModal] = useState(false);
  const [paymentMode, setPaymentMode] = useState(codEnabled ? 'COD' : 'ONLINE');
  const [streetAddress, setStreetAddress] = useState('123 MG Road, Geeta Bhawan, Indore');
  const [city, setCity] = useState('Indore');
  const [state, setState] = useState('Madhya Pradesh');
  const [pincode, setPincode] = useState('452001');
  const [deliveryCoordinates, setDeliveryCoordinates] = useState(null);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [recipientName, setRecipientName] = useState('Valued Customer');
  const [selectedAddressId, setSelectedAddressId] = useState('');

  // Coupon State
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState('');

  // Order State
  const { orderId: paramOrderId } = useParams();
  const [orderConfirmed, setOrderConfirmed] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState(null);
  const [confirmedOrderNumber, setConfirmedOrderNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [isPincodeServiceable, setIsPincodeServiceable] = useState(true);
  const [pincodeReason, setPincodeReason] = useState('');
  const [matchedZone, setMatchedZone] = useState(null);
  const [quickCategories, setQuickCategories] = useState([]);

  // Integrate order success sound hook
  const { autoplayBlocked, playManual } = useOrderSuccessSound(
    orderConfirmed ? confirmedOrder || confirmedOrderNumber : null,
    { enabled: orderConfirmed }
  );

  // Restore order from route param /order-success/:orderId if accessed directly
  useEffect(() => {
    if (paramOrderId) {
      let isMounted = true;
      apiClient
        .get(`/v1/orders/${paramOrderId}`)
        .then((res) => {
          if (isMounted && res.data?.success && res.data?.data) {
            const ord = res.data.data;
            setConfirmedOrder(ord);
            setConfirmedOrderNumber(ord.orderNumber);
            if (ord.deliveryAddress?.street) setStreetAddress(ord.deliveryAddress.street);
            if (ord.payment?.method) setPaymentMode(ord.payment.method);
            setOrderConfirmed(true);
          }
        })
        .catch((err) => {
          if (import.meta.env?.DEV) console.warn('[CartPage] Failed to fetch route order:', err.message);
        });
      return () => {
        isMounted = false;
      };
    }
  }, [paramOrderId]);

  // Restore order from session storage on refresh
  useEffect(() => {
    if (!paramOrderId && !orderConfirmed) {
      try {
        const saved = sessionStorage.getItem('kgs_active_order_success');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.orderNumber) {
            setConfirmedOrder(parsed);
            setConfirmedOrderNumber(parsed.orderNumber);
            if (parsed.streetAddress) setStreetAddress(parsed.streetAddress);
            if (parsed.paymentMode) setPaymentMode(parsed.paymentMode);
            setOrderConfirmed(true);
          }
        }
      } catch {}
    }
  }, [paramOrderId, orderConfirmed]);

  useEffect(() => {
    if (cart.length === 0) {
      let isMounted = true;
      apiClient
        .get('/v1/categories')
        .then((res) => {
          if (isMounted && Array.isArray(res.data?.data)) {
            setQuickCategories(res.data.data.slice(0, 4));
          }
        })
        .catch(() => {});
      return () => {
        isMounted = false;
      };
    }
  }, [cart.length]);
  const [isZonePaused, setIsZonePaused] = useState(false);

  const availableOffers = [
    { code: 'KHUSHBOO50', label: '₹50 OFF on ₹399+', min: 399 },
    { code: 'FRESH10', label: '10% OFF up to ₹100', min: 249 },
  ];

  useEffect(() => {
    if (user) {
      if (user.name && user.name !== 'Grocery Customer') {
        setRecipientName(user.name);
      }
      if (Array.isArray(user.addresses) && user.addresses.length > 0) {
        const def = user.addresses.find((a) => a.isDefault) || user.addresses[0];
        setSelectedAddressId(def._id);
        setStreetAddress(def.street || '');
        if (def.city) setCity(def.city);
        if (def.state) setState(def.state);
        setPincode(def.pincode || '452001');
        if (def.coordinates) setDeliveryCoordinates(def.coordinates);
        if (def.recipientName) setRecipientName(def.recipientName);
        if (def.pincode) handlePincodeChange(def.pincode, def.coordinates);
      }
    } else {
      // Check if customer selected a location from the header
      try {
        const stored = localStorage.getItem('khushboo_customer_location');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.formattedAddress) setStreetAddress(parsed.formattedAddress);
          if (parsed.city) setCity(parsed.city);
          if (parsed.state) setState(parsed.state);
          if (parsed.coordinates) setDeliveryCoordinates(parsed.coordinates);
          if (parsed.pincode) {
            setPincode(parsed.pincode);
            handlePincodeChange(parsed.pincode, parsed.coordinates);
          }
        }
      } catch (e) {}
    }
  }, [user]);

  // Sync when delivery location is changed in the header
  useEffect(() => {
    const handleLocationChange = (e) => {
      const loc = e.detail;
      if (loc) {
        if (loc.formattedAddress) setStreetAddress(loc.formattedAddress);
        if (loc.city) setCity(loc.city);
        if (loc.state) setState(loc.state);
        if (loc.coordinates) setDeliveryCoordinates(loc.coordinates);
        if (loc.pincode) {
          setPincode(loc.pincode);
          handlePincodeChange(loc.pincode, loc.coordinates);
        }
      }
    };
    window.addEventListener('khushboo:location_changed', handleLocationChange);
    return () => {
      window.removeEventListener('khushboo:location_changed', handleLocationChange);
    };
  }, []);

  // Auto-switch payment mode if the currently selected mode is disabled by store settings
  useEffect(() => {
    if (codEnabled && !onlineEnabled && paymentMode !== 'COD') {
      setPaymentMode('COD');
    } else if (!codEnabled && onlineEnabled && paymentMode !== 'ONLINE') {
      setPaymentMode('ONLINE');
    }
  }, [codEnabled, onlineEnabled, paymentMode]);

  // Revalidate cart items with live database inventory and pricing once on page load
  const hasValidatedRef = useRef(false);
  useEffect(() => {
    if (!hasValidatedRef.current) {
      hasValidatedRef.current = true;
      revalidateWithServer();
    }
  }, [revalidateWithServer]);

  // Scroll to the top of the page whenever the order success screen is shown.
  // The success view is rendered in-place on the /cart route (no route change
  // occurs), so ScrollRestoration never fires — we must scroll manually.
  useEffect(() => {
    if (orderConfirmed) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      // Fallback for browsers / nested-scroll containers
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  }, [orderConfirmed]);

  const effectiveMinOrderPaise =
    matchedZone?.minOrderAmountPaise ??
    settings?.effectiveMinOrderAmountPaise ??
    settings?.minOrderAmountPaise ??
    MIN_ORDER_AMOUNT_PAISE;
  const isBelowMinOrder = cartSubtotalPaise > 0 && cartSubtotalPaise < effectiveMinOrderPaise;

  const freeDeliveryProgress = Math.min(
    100,
    Math.round((cartSubtotalPaise / FREE_DELIVERY_THRESHOLD_PAISE) * 100)
  );

  const couponDiscountPaise = appliedCoupon?.discountPaise || 0;
  const finalPayablePaise = Math.max(0, grandTotalPaise - couponDiscountPaise);

  const handlePincodeChange = async (newPincode, coords = null) => {
    setPincode(newPincode);
    if (newPincode.length === 6) {
      try {
        const payload = {
          pincode: newPincode,
          city: 'Indore',
          subtotalPaise: cartSubtotalPaise,
        };
        if (coords) payload.coordinates = coords;

        const res = await apiClient.post('/v1/delivery/check', payload);
        setIsPincodeServiceable(res.data.isServiceable);
        setIsZonePaused(Boolean(res.data.isPaused));
        setPincodeReason(res.data.reason || res.data.pauseReason || '');
        const zoneData = res.data.zone
          ? {
              ...res.data.zone,
              minOrderAmountPaise: res.data.zone.minOrderAmountPaise ?? res.data.minOrderAmountPaise,
            }
          : (res.data.minOrderAmountPaise !== undefined ? { minOrderAmountPaise: res.data.minOrderAmountPaise } : null);
        setMatchedZone(zoneData);
      } catch {
        setIsPincodeServiceable(false);
        setIsZonePaused(false);
        setPincodeReason('Unable to verify delivery for this PIN code');
      }
    }
  };

  const handleSelectSavedAddress = (addrId) => {
    setSelectedAddressId(addrId);
    const addr = user?.addresses?.find((a) => a._id === addrId);
    if (addr) {
      setStreetAddress(addr.street || '');
      if (addr.city) setCity(addr.city);
      if (addr.state) setState(addr.state);
      setPincode(addr.pincode || '452001');
      if (addr.coordinates) setDeliveryCoordinates(addr.coordinates);
      if (addr.recipientName) setRecipientName(addr.recipientName);
      handlePincodeChange(addr.pincode || '452001', addr.coordinates);
    }
  };

  const handleLocationPickedFromMap = (locationData) => {
    if (!locationData) return;
    if (locationData.formattedAddress) {
      setStreetAddress(locationData.formattedAddress);
    }
    if (locationData.city) {
      setCity(locationData.city);
    }
    if (locationData.state) {
      setState(locationData.state);
    }
    if (locationData.coordinates) {
      setDeliveryCoordinates(locationData.coordinates);
    }
    const targetPincode = locationData.pincode || pincode;
    if (locationData.pincode) {
      setPincode(locationData.pincode);
    }
    handlePincodeChange(targetPincode, locationData.coordinates);

    try {
      localStorage.setItem('khushboo_customer_location', JSON.stringify(locationData));
      window.dispatchEvent(new CustomEvent('khushboo:location_changed', { detail: locationData }));
    } catch (e) {}

    setIsMapModalOpen(false);
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

  const handlePlaceOrder = async () => {
    if (!isAuthenticated) {
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

    if (isAdmin) {
      setCheckoutError('Preview Mode: Order placement is disabled for administrative accounts. Please use a customer account to place orders.');
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
          city: city || 'Indore',
          state: state || 'Madhya Pradesh',
          pincode: pincode,
          coordinates: deliveryCoordinates || undefined,
        },
        paymentMethod: paymentMode,
        couponCode: appliedCoupon?.code || undefined,
        idempotencyKey: `IDEM-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      };

      const res = await apiClient.post('/v1/orders', orderPayload);

      if (res.data?.success && res.data?.order) {
        const orderData = res.data.order;
        setConfirmedOrder(orderData);
        setConfirmedOrderNumber(orderData.orderNumber);
        setOrderConfirmed(true);
        clearCart();
        setAppliedCoupon(null);
        try {
          sessionStorage.setItem(
            'kgs_active_order_success',
            JSON.stringify({
              _id: orderData._id,
              orderNumber: orderData.orderNumber,
              orderStatus: orderData.orderStatus || 'PLACED',
              paymentMode,
              streetAddress,
            })
          );
        } catch {}
      }
    } catch (err) {
      setCheckoutError(err.response?.data?.message || err.message || 'Unable to place order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // 1. Order Confirmed Screen
  if (orderConfirmed) {
    return (
      <div className="w-full max-w-2xl mx-auto px-4 py-16 text-center animate-fadeIn text-text-main">
        <div className="w-20 h-20 rounded-2xl bg-status-success/10 border border-status-success/20 text-status-success flex items-center justify-center mx-auto mb-6 shadow-sm">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <span className="text-xs font-bold uppercase tracking-widest text-brand bg-brand-light px-3.5 py-1 rounded-full border border-brand/20 mb-3 inline-block">
          Order Placed
        </span>
        <h1 className="text-3xl font-extrabold font-heading text-text-main mb-2">Thank you!</h1>
        <p className="text-sm text-text-muted max-w-md mx-auto mb-6">
          Your grocery order <span className="text-brand font-mono font-bold">#{confirmedOrderNumber}</span> has been placed successfully and is awaiting store confirmation.
        </p>

        {/* Subtle Accessible Confirmation Sound Fallback (if browser autoplay policy blocked audio) */}
        {autoplayBlocked && (
          <div className="mb-6 animate-fadeIn">
            <button
              type="button"
              onClick={playManual}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface hover:bg-surface-subtle border border-border-neutral text-xs font-bold text-brand shadow-xs transition cursor-pointer active:scale-98 focus:outline-none focus:ring-2 focus:ring-brand"
              aria-label="Play order confirmation sound"
            >
              <Volume2 className="w-4 h-4 text-brand animate-pulse" />
              <span>🔊 Play confirmation sound</span>
            </button>
          </div>
        )}

        <div className="bg-surface p-5 rounded-2xl border border-border-neutral text-left max-w-md mx-auto mb-6 text-xs space-y-2.5 shadow-xs">
          <div className="flex justify-between text-text-main">
            <span className="text-text-muted">Payment Mode:</span>
            <span className="font-semibold text-text-main">
              {paymentMode === 'COD' ? 'Cash on Delivery (Doorstep)' : 'Online / UPI'}
            </span>
          </div>
          <div className="flex justify-between text-text-main">
            <span className="text-text-muted">Delivery Address:</span>
            <span className="font-semibold text-text-main truncate max-w-[210px]">{streetAddress}</span>
          </div>
          <div className="flex justify-between text-text-main">
            <span className="text-text-muted">Estimated Delivery:</span>
            <span className="font-semibold text-brand">Today within 90-120 mins</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
          <Link
            to="/account"
            onClick={() => {
              sessionStorage.removeItem('kgs_active_order_success');
            }}
            className="px-6 py-3 bg-brand hover:bg-brand-hover text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-brand"
          >
            <span>Track Order in Account</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/"
            onClick={() => {
              sessionStorage.removeItem('kgs_active_order_success');
            }}
            className="px-6 py-3 bg-surface hover:bg-surface-subtle border border-border-neutral text-text-main font-semibold text-xs rounded-xl transition text-center focus:outline-none focus:ring-2 focus:ring-border-neutral shadow-xs"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  // 2. Guest Customer State (Only Logged-in Customers Can Shop)
  if (!isAuthenticated) {
    return (
      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center animate-fadeIn text-text-main">
        <div className="w-20 h-20 rounded-2xl bg-surface border border-border-neutral flex items-center justify-center mx-auto mb-5 text-brand shadow-xs">
          <ShoppingBag className="w-10 h-10 stroke-[1.5]" />
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-text-main mb-2">
          Sign in to start shopping
        </h1>

        <p className="text-xs sm:text-sm text-text-muted max-w-md mx-auto mb-8 leading-relaxed">
          Create your account or sign in to add products to your cart, save your selections, and place orders with Khushboo Grocery Service.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto mb-10">
          <button
            type="button"
            onClick={() => {
              if (onOpenAuth) onOpenAuth();
              else window.dispatchEvent(new CustomEvent('khushboo:open_auth'));
            }}
            className="px-6 py-3 bg-brand hover:bg-brand-hover text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-brand"
          >
            <span>Sign In / Create Account</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <Link
            to="/"
            className="px-6 py-3 bg-surface hover:bg-surface-subtle border border-border-neutral text-text-main font-semibold text-xs rounded-xl transition text-center focus:outline-none focus:ring-2 focus:ring-border-neutral shadow-xs"
          >
            Continue Shopping
          </Link>
        </div>

        {/* Popular Category Shortcuts */}
        {quickCategories.length > 0 && (
          <div className="pt-8 border-t border-border-neutral max-w-2xl mx-auto">
            <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-4">
              Popular Grocery Categories
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
              {quickCategories.map((cat) => (
                <Link
                  key={cat._id || cat.slug}
                  to={`/categories/${cat.slug}`}
                  className="p-3.5 rounded-xl bg-surface hover:bg-surface-subtle border border-border-neutral hover:border-brand/40 transition group flex flex-col justify-between shadow-xs focus:outline-none focus:ring-1 focus:ring-brand"
                >
                  <span className="text-xl mb-1.5 block">🏷️</span>
                  <span className="text-xs font-bold text-text-main group-hover:text-brand transition truncate">
                    {cat.name}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // 3. Empty Cart State
  if (cart.length === 0) {
    return (
      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center animate-fadeIn text-text-main">
        <div className="w-20 h-20 rounded-2xl bg-surface border border-border-neutral flex items-center justify-center mx-auto mb-5 text-brand shadow-xs">
          <ShoppingBag className="w-10 h-10 stroke-[1.5]" />
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-text-main mb-2">
          Your cart is empty
        </h1>

        <p className="text-xs sm:text-sm text-text-muted max-w-md mx-auto mb-8 leading-relaxed">
          Looks like you haven't added anything to your cart yet. Explore freshly milled wheat flour, pure spices, pulses, and daily grocery essentials!
        </p>

        <div className="mb-10">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand hover:bg-brand-hover text-white font-bold text-xs shadow-xs transition active:scale-95 focus:outline-none focus:ring-2 focus:ring-brand"
          >
            <Sparkles className="w-4 h-4" />
            <span>Continue Shopping</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Popular Category Shortcuts */}
        {quickCategories.length > 0 && (
          <div className="pt-8 border-t border-border-neutral max-w-2xl mx-auto">
            <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-4">
              Popular Grocery Categories
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
              {quickCategories.map((cat) => (
                <Link
                  key={cat._id || cat.slug}
                  to={`/categories/${cat.slug}`}
                  className="p-3.5 rounded-xl bg-surface hover:bg-surface-subtle border border-border-neutral hover:border-brand/40 transition group flex flex-col justify-between shadow-xs focus:outline-none focus:ring-1 focus:ring-brand"
                >
                  <span className="text-xl mb-1.5 block">🏷️</span>
                  <span className="text-xs font-bold text-text-main group-hover:text-brand transition truncate">
                    {cat.name}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // 3. Full-Screen Cart Page
  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-text-main">
      {/* Page Header */}
      <div className="mb-6 pb-4 border-b border-border-neutral flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          {/* Breadcrumb / Continue Shopping Link */}
          <div className="flex items-center gap-2 text-xs text-text-muted mb-2">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-text-muted hover:text-brand transition focus:outline-none focus:underline"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Continue Shopping</span>
            </Link>
            <span className="text-border-neutral">/</span>
            <span className="text-text-main font-medium">Khushboo Grocery Service</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-text-main flex items-center gap-3">
            <ShoppingBag className="w-7 h-7 text-brand" />
            <span>Your Shopping Cart</span>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-brand-light border border-brand/20 text-brand font-mono">
              {cartItemCount} {cartItemCount === 1 ? 'item' : 'items'}
            </span>
          </h1>
        </div>

        <Link
          to="/"
          className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface hover:bg-surface-subtle border border-border-neutral text-xs font-semibold text-text-muted hover:text-text-main transition focus:outline-none focus:ring-1 focus:ring-brand shadow-xs"
        >
          <Store className="w-3.5 h-3.5 text-brand" />
          <span>Browse Storefront</span>
        </Link>
      </div>

      {/* Free Delivery Tracker Bar */}
      <div className="mb-6 p-4 rounded-xl bg-surface border border-border-neutral shadow-xs">
        <div className="flex items-center justify-between text-xs font-medium mb-2">
          <div className="flex items-center gap-2 text-brand">
            <Truck className="w-4 h-4 text-brand" />
            <span className="font-semibold">
              {isFreeDelivery
                ? '🎉 You unlocked FREE Delivery in Indore!'
                : `Add ₹${(amountNeededForFreeDeliveryPaise / 100).toFixed(0)} more for FREE Delivery!`}
            </span>
          </div>
          <span className="text-brand font-bold font-mono">{freeDeliveryProgress}%</span>
        </div>
        <div className="w-full h-2 bg-surface-subtle rounded-full overflow-hidden border border-border-neutral">
          <div
            className="h-full bg-brand transition-all duration-300 rounded-full"
            style={{ width: `${freeDeliveryProgress}%` }}
          />
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Cart Items & Delivery Details */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-6 min-w-0">
          {/* Cart Items List */}
          <div className="bg-surface border border-border-neutral rounded-2xl p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-border-neutral pb-3 mb-4">
              <h2 className="text-sm font-bold font-heading text-text-main flex items-center gap-2">
                <span>Items in your cart</span>
                <span className="text-xs text-text-muted font-normal">
                  ({cart.length} {cart.length === 1 ? 'product' : 'products'})
                </span>
              </h2>
              <button
                type="button"
                onClick={() => setShowClearCartModal(true)}
                className="text-xs text-text-muted hover:text-status-error transition flex items-center gap-1 focus:outline-none focus:underline"
                aria-label="Clear all items in cart"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Cart</span>
              </button>
            </div>

            <div className="space-y-3">
              <AnimatePresence initial={false}>
                {cart.map((item) => {
                  const itemTotalRupees = ((item.pricePaise || 0) * (item.qty || 0)) / 100;
                  const itemUnitRupees = (item.pricePaise || 0) / 100;
                  const itemMrpRupees = ((item.mrpPaise || item.pricePaise || 0) * (item.qty || 0)) / 100;
                  const itemSavingsRupees = Math.max(0, itemMrpRupees - itemTotalRupees);
                  const itemKey = item.cartKey || item.variantSku || item.variantId;
                  const isMaxStockReached = item.stock > 0 && item.qty >= item.stock;

                  return (
                    <motion.div
                      key={itemKey}
                      layout
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, height: 0, overflow: 'hidden', margin: 0, padding: 0 }}
                      transition={{ duration: 0.2 }}
                      className="p-3.5 sm:p-4 bg-surface border border-border-neutral rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-brand/40 transition shadow-xs"
                    >
                      {/* Product Info with Image */}
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        <ImageWithSkeleton
                          src={item.image}
                          alt={item.name}
                          aspectRatio="aspect-square"
                          containerClassName="w-16 h-16 sm:w-18 sm:h-18 rounded-lg shrink-0 bg-surface-subtle border border-border-neutral"
                          className="w-full h-full object-cover rounded-lg"
                        />
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] font-bold text-brand uppercase tracking-wider block">
                            {item.brand || 'Khushboo Pure'}
                          </span>
                          <h3 className="text-xs sm:text-sm font-bold text-text-main line-clamp-2 leading-snug">
                            {item.name}
                          </h3>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="px-2 py-0.5 rounded-md bg-brand-light border border-brand/20 text-brand font-semibold text-[11px]">
                              {item.variantLabel}
                            </span>
                            <span className="text-[11px] text-text-muted">
                              ₹{itemUnitRupees.toFixed(0)} each
                            </span>
                            {itemSavingsRupees > 0 && (
                              <span className="text-[10px] font-bold text-status-success">
                                Save ₹{itemSavingsRupees.toFixed(0)}
                              </span>
                            )}
                            {item.stock > 0 && item.stock <= 5 && (
                              <span className="text-[10px] text-status-warning font-semibold">
                                (Only {item.stock} left)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Stepper, Subtotal, and Remove Button */}
                      <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border-neutral">
                        {/* Quantity Stepper */}
                        <div className="flex items-center bg-surface border border-border-neutral rounded-xl p-1 shadow-xs">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              updateQty(itemKey, -1);
                            }}
                            className="w-7 h-7 rounded-lg bg-surface-subtle hover:bg-border-neutral flex items-center justify-center text-text-main transition active:scale-90 focus:outline-none focus:ring-1 focus:ring-brand cursor-pointer"
                            aria-label={`Decrease quantity of ${item.name}`}
                          >
                            <Minus className="w-3 h-3 text-brand" />
                          </button>
                          <span className="w-8 text-center text-xs font-bold text-brand font-mono">
                            {item.qty}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              updateQty(itemKey, 1);
                            }}
                            disabled={isMaxStockReached}
                            className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold transition active:scale-90 shadow-xs focus:outline-none focus:ring-1 focus:ring-brand ${
                              isMaxStockReached
                                ? 'bg-border-neutral text-text-muted cursor-not-allowed opacity-50'
                                : 'bg-brand hover:bg-brand-hover text-white cursor-pointer'
                            }`}
                            aria-label={`Increase quantity of ${item.name}`}
                            title={isMaxStockReached ? `Maximum available stock (${item.stock})` : 'Add one more'}
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Line Subtotal */}
                        <div className="text-right min-w-[70px]">
                          <span className="text-sm font-extrabold text-brand block font-mono">
                            ₹{itemTotalRupees.toFixed(0)}
                          </span>
                          {item.mrpPaise > item.pricePaise && (
                            <span className="text-[11px] text-text-muted line-through block font-mono">
                              ₹{itemMrpRupees.toFixed(0)}
                            </span>
                          )}
                        </div>

                        {/* Direct Remove Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            removeFromCart(itemKey);
                          }}
                          className="p-2 rounded-lg text-text-muted hover:text-status-error hover:bg-status-error/10 transition focus:outline-none focus:ring-1 focus:ring-status-error cursor-pointer"
                          title="Remove item from bag"
                          aria-label={`Remove ${item.name} from cart`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>

          {/* Clear Cart Confirmation Dialog */}
          {showClearCartModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="clear-cart-title"
                className="bg-surface rounded-2xl border border-border-neutral shadow-2xl p-6 max-w-sm w-full text-center space-y-4 animate-scaleUp text-text-main"
              >
                <div className="w-12 h-12 rounded-2xl bg-status-error/10 text-status-error flex items-center justify-center mx-auto border border-status-error/20">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 id="clear-cart-title" className="text-base font-bold font-heading text-text-main">
                    Clear Shopping Cart?
                  </h3>
                  <p className="text-xs text-text-muted mt-1.5 leading-relaxed">
                    Are you sure you want to remove all {cartItemCount} items from your shopping bag? This action cannot be undone.
                  </p>
                </div>
                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowClearCartModal(false)}
                    className="flex-1 py-2.5 px-4 rounded-xl border border-border-neutral text-xs font-semibold text-text-muted hover:text-text-main bg-surface hover:bg-surface-subtle transition shadow-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      clearCart();
                      setShowClearCartModal(false);
                    }}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-status-error hover:bg-status-error/90 text-white text-xs font-bold transition shadow-xs active:scale-95"
                  >
                    Yes, Clear Cart
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Indore Delivery Address Section */}
          <div className="bg-surface border border-border-neutral rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-neutral pb-3">
              <h2 className="text-sm font-bold font-heading text-text-main flex items-center gap-2">
                <MapPin className="w-4 h-4 text-brand" />
                <span>Delivery Address (Indore)</span>
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsMapModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand text-white hover:bg-brand-hover text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer"
                  title="Choose exact location on interactive map"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>Choose on Map</span>
                </button>
                <span
                  className={`text-[10px] px-2.5 py-1 rounded-full border font-semibold ${
                    isPincodeServiceable
                      ? 'text-status-success bg-status-success/10 border-status-success/20'
                      : 'text-status-error bg-status-error/10 border-status-error/20'
                  }`}
                >
                  {isPincodeServiceable ? 'Serviceable Zone' : 'Outside Indore'}
                </span>
              </div>
            </div>

            {/* Quick Set on Map Helper Card (Like Blinkit / Swiggy Instamart) */}
            <div
              onClick={() => setIsMapModalOpen(true)}
              className="p-3.5 rounded-xl bg-brand-light/40 border border-brand/20 hover:border-brand/50 transition cursor-pointer flex items-center justify-between gap-3 group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-brand text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition">
                  <Map className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-text-main flex items-center gap-2">
                    <span>Set Delivery Location on Map</span>
                    {deliveryCoordinates && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand text-white font-mono font-semibold">
                        📍 GPS Pinned
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-text-muted truncate">
                    {deliveryCoordinates
                      ? `Pinned: ${streetAddress || 'Exact location pinned on map'}`
                      : 'Search Indore colony/landmark, use live GPS, or drag pin'}
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-brand group-hover:underline shrink-0 flex items-center gap-1">
                <span>{deliveryCoordinates ? 'Change Pin' : 'Open Map'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>

            {user?.addresses && user.addresses.length > 0 && (
              <div>
                <label className="block text-xs text-text-muted font-medium mb-1">
                  Select from Saved Addresses
                </label>
                <select
                  value={selectedAddressId}
                  onChange={(e) => handleSelectSavedAddress(e.target.value)}
                  className="w-full bg-surface border border-border-neutral rounded-xl px-3 py-2 text-xs text-text-main focus:outline-none focus:border-brand shadow-xs"
                >
                  {user.addresses.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.tag || 'Saved'} — {a.street}, {a.pincode}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-text-muted font-medium mb-1">Street Address</label>
                <input
                  type="text"
                  value={streetAddress}
                  onChange={(e) => setStreetAddress(e.target.value)}
                  placeholder="Enter house / flat number, street, landmark"
                  className="w-full bg-surface border border-border-neutral rounded-xl px-3 py-2.5 text-text-main placeholder:text-text-muted focus:outline-none focus:border-brand shadow-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-text-muted font-medium mb-1">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Indore"
                    className="w-full bg-surface border border-border-neutral rounded-xl px-3 py-2.5 text-text-main focus:outline-none focus:border-brand shadow-xs"
                  />
                </div>
                <div>
                  <label className="block text-text-muted font-medium mb-1">PIN Code</label>
                  <input
                    type="text"
                    maxLength={6}
                    value={pincode}
                    onChange={(e) => handlePincodeChange(e.target.value)}
                    placeholder="452001"
                    className="w-full bg-surface border border-border-neutral rounded-xl px-3 py-2.5 text-text-main font-mono focus:outline-none focus:border-brand shadow-xs"
                  />
                </div>
              </div>

              {isZonePaused && (
                <div className="p-3 bg-status-warning/10 border border-status-warning/30 rounded-xl text-xs text-status-warning flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Delivery Temporarily Suspended in {matchedZone?.name || 'this zone'}</span>
                    <span className="text-[11px] block">{pincodeReason}</span>
                  </div>
                </div>
              )}

              {matchedZone && !isZonePaused && isPincodeServiceable && (
                <div className="p-2.5 bg-brand-light/50 border border-brand/20 rounded-xl text-xs text-brand flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Serving Zone: <strong>{matchedZone.name}</strong></span>
                  </div>
                  <span className="text-[10px] uppercase font-bold tracking-wider font-mono bg-brand text-white px-2 py-0.5 rounded-md">
                    {matchedZone.code}
                  </span>
                </div>
              )}

              {pincodeReason && !isPincodeServiceable && !isZonePaused && (
                <p className="text-xs text-status-error flex items-center gap-1 font-medium">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{pincodeReason}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Coupons, Payment Mode, Order Summary & Checkout */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-6 lg:sticky lg:top-24">
          {/* 1. Promo Coupon Card */}
          <div className="bg-surface border border-border-neutral rounded-2xl p-4 shadow-xs space-y-3">
            <h3 className="text-xs font-bold font-heading text-text-main flex items-center gap-1.5">
              <Tag className="w-4 h-4 text-brand" />
              <span>Apply Promo Voucher</span>
            </h3>

            {appliedCoupon ? (
              <div className="flex items-center justify-between bg-brand-light/50 border border-brand/20 px-3 py-2 rounded-xl text-xs">
                <div className="flex items-center gap-2 text-brand">
                  <Tag className="w-3.5 h-3.5" />
                  <span className="font-mono font-bold">{appliedCoupon.code}</span>
                  <span className="text-[11px] text-text-muted">
                    (-₹{(appliedCoupon.discountPaise / 100).toFixed(0)})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAppliedCoupon(null);
                    setCouponInput('');
                  }}
                  className="text-text-muted hover:text-status-error text-xs font-bold focus:outline-none cursor-pointer"
                >
                  Remove
                </button>
              </div>
            ) : (
              <>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleApplyCoupon();
                  }}
                  className="flex gap-2 text-xs"
                >
                  <input
                    type="text"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    placeholder="Enter code (e.g. KHUSHBOO50)"
                    className="flex-1 bg-surface border border-border-neutral rounded-xl px-3 py-2 text-text-main uppercase font-mono placeholder:text-text-muted focus:outline-none focus:border-brand shadow-xs"
                  />
                  <button
                    type="submit"
                    disabled={couponLoading || !couponInput.trim()}
                    className="px-4 py-2 bg-brand hover:bg-brand-hover text-white font-bold rounded-xl transition disabled:opacity-50 shadow-xs cursor-pointer"
                  >
                    {couponLoading ? '...' : 'Apply'}
                  </button>
                </form>

                <div className="flex items-center gap-2 pt-1 overflow-x-auto">
                  {availableOffers.map((offer) => (
                    <button
                      key={offer.code}
                      type="button"
                      onClick={() => handleApplyCoupon(offer.code)}
                      className="text-[10px] px-2 py-1 rounded-lg bg-surface-subtle hover:bg-border-neutral border border-border-neutral text-brand font-mono font-bold flex items-center gap-1 transition shadow-xs cursor-pointer"
                    >
                      <Tag className="w-2.5 h-2.5" />
                      <span>{offer.code}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {couponError && (
              <p className="text-xs text-status-error flex items-center gap-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{couponError}</span>
              </p>
            )}
          </div>

          {/* 2. Payment Method Selector */}
          <div className="bg-surface border border-border-neutral rounded-2xl p-4 shadow-xs space-y-2.5">
            <h3 className="text-xs font-bold font-heading text-text-main">Select Payment Mode</h3>
            {!isAnyPaymentEnabled ? (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                <span>Checkout is temporarily unavailable. Both Cash on Delivery and Online Payment are currently paused by the store.</span>
              </div>
            ) : codEnabled && onlineEnabled ? (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setPaymentMode('COD')}
                  className={`py-2.5 px-3 rounded-xl border flex items-center justify-center gap-2 transition focus:outline-none cursor-pointer ${
                    paymentMode === 'COD'
                      ? 'border-brand bg-brand-light text-brand font-bold ring-1 ring-brand/30 shadow-xs'
                      : 'border-border-neutral bg-surface text-text-muted hover:text-text-main'
                  }`}
                >
                  <Banknote className="w-4 h-4 text-brand" />
                  <span>Cash on Delivery</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMode('ONLINE')}
                  className={`py-2.5 px-3 rounded-xl border flex items-center justify-center gap-2 transition focus:outline-none cursor-pointer ${
                    paymentMode === 'ONLINE'
                      ? 'border-brand bg-brand-light text-brand font-bold ring-1 ring-brand/30 shadow-xs'
                      : 'border-border-neutral bg-surface text-text-muted hover:text-text-main'
                  }`}
                >
                  <CreditCard className="w-4 h-4 text-brand" />
                  <span>UPI / Online</span>
                </button>
              </div>
            ) : codEnabled ? (
              <div className="space-y-1.5">
                <div className="py-2.5 px-3 rounded-xl border border-brand bg-brand-light text-brand font-bold ring-1 ring-brand/30 shadow-xs flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Banknote className="w-4 h-4 text-brand" />
                    <span>Cash on Delivery</span>
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider bg-brand/10 text-brand px-2 py-0.5 rounded-md">Active</span>
                </div>
                <p className="text-[11px] text-text-muted flex items-center gap-1">
                  <span>Note: Online payment is currently unavailable.</span>
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="py-2.5 px-3 rounded-xl border border-brand bg-brand-light text-brand font-bold ring-1 ring-brand/30 shadow-xs flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-brand" />
                    <span>UPI / Online Payment</span>
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider bg-brand/10 text-brand px-2 py-0.5 rounded-md">Active</span>
                </div>
                <p className="text-[11px] text-text-muted flex items-center gap-1">
                  <span>Note: Cash on Delivery is currently unavailable.</span>
                </p>
              </div>
            )}
          </div>

          {/* 3. Order Summary Card */}
          <div className="bg-surface border border-border-neutral rounded-2xl p-5 shadow-xs space-y-4">
            <h2 className="text-base font-bold font-heading text-text-main border-b border-border-neutral pb-3">
              Order Summary
            </h2>

            {/* Bill Details */}
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between text-text-muted">
                <span>Items Subtotal</span>
                <span className="text-text-main font-medium">₹{(cartSubtotalPaise / 100).toFixed(0)}</span>
              </div>

              {cartSavingsPaise > 0 && (
                <div className="flex justify-between text-status-success font-medium">
                  <span>Product Savings</span>
                  <span>-₹{(cartSavingsPaise / 100).toFixed(0)}</span>
                </div>
              )}

              {couponDiscountPaise > 0 && (
                <div className="flex justify-between text-brand font-medium">
                  <span>Coupon Discount ({appliedCoupon?.code})</span>
                  <span>-₹{(couponDiscountPaise / 100).toFixed(0)}</span>
                </div>
              )}

              <div className="flex justify-between text-text-muted">
                <span>Delivery Charges</span>
                <span className={isFreeDelivery ? 'text-status-success font-semibold' : 'text-text-main'}>
                  {isFreeDelivery ? 'FREE' : `₹${(deliveryFeePaise / 100).toFixed(0)}`}
                </span>
              </div>

              {/* Delivery ETA info only when serviceable */}
              {isPincodeServiceable && (
                <div className="flex items-center gap-1.5 text-[11px] text-brand pt-1 font-medium">
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    Estimated delivery: {settings?.estimatedDeliveryWindow || '90–120 mins'} in {settings?.serviceCity || 'Indore'}
                  </span>
                </div>
              )}

              <div className="pt-3 border-t border-border-neutral flex justify-between text-base font-bold text-text-main">
                <span>Total Amount:</span>
                <span className="text-xl text-brand font-extrabold font-mono">
                  ₹{(finalPayablePaise / 100).toFixed(0)}
                </span>
              </div>
            </div>

            {/* Minimum Order Warning */}
            {isBelowMinOrder && (
              <div className="p-3 bg-status-warning/10 border border-status-warning/20 rounded-xl text-status-warning text-xs flex items-center justify-between">
                <span>Min order ₹{(effectiveMinOrderPaise / 100).toFixed(0)} for delivery</span>
                <span className="font-bold">
                  Add ₹{((effectiveMinOrderPaise - cartSubtotalPaise) / 100).toFixed(0)} more
                </span>
              </div>
            )}

            {/* Administrator Preview Mode Notice */}
            {isAdmin && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-800 text-xs flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <div>
                  <span className="font-bold block text-amber-900">Live Store Preview Mode</span>
                  <span>Order placement and payment execution are disabled for administrative accounts. Please use a customer account to place orders.</span>
                </div>
              </div>
            )}

            {/* Checkout Error */}
            {checkoutError && (
              <div className="p-3 bg-status-error/10 border border-status-error/20 rounded-xl text-status-error text-xs font-medium">
                {checkoutError}
              </div>
            )}

            {/* Proceed to Checkout / Place Order Button */}
            <button
              type="button"
              onClick={handlePlaceOrder}
              disabled={isAdmin || submitting || isBelowMinOrder || !isPincodeServiceable || isZonePaused || !isAnyPaymentEnabled}
              className={`w-full py-3.5 font-bold text-sm rounded-xl shadow-xs transition flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-brand ${
                isAdmin || submitting || isBelowMinOrder || !isPincodeServiceable || isZonePaused || !isAnyPaymentEnabled
                  ? 'bg-border-neutral text-text-muted cursor-not-allowed shadow-none'
                  : 'bg-brand hover:bg-brand-hover text-white active:scale-98 cursor-pointer'
              }`}
            >
              {submitting ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Processing Order...</span>
                </div>
              ) : isAdmin ? (
                <span>Preview Mode • Orders Disabled</span>
              ) : isAuthenticated ? (
                <>
                  <span>Proceed to Checkout • ₹{(finalPayablePaise / 100).toFixed(0)}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              ) : (
                <>
                  <span>Sign In to Checkout • ₹{(finalPayablePaise / 100).toFixed(0)}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          {/* 4. Reassurance Badges */}
          <div className="p-3 bg-surface-subtle border border-border-neutral rounded-xl space-y-2 text-[11px] text-text-muted">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-brand" />
              <span>100% Pure, Hygienically Packed Groceries</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-brand" />
              <span>Doorstep Delivery across {settings.serviceCity || 'Indore'} in {settings.estimatedDeliveryWindow || '90–120 mins'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Map Location Picker Modal (Leaflet / OpenStreetMap / Google Map style) */}
      <LocationPickerModal
        isOpen={isMapModalOpen}
        onClose={() => setIsMapModalOpen(false)}
        onLocationSelect={handleLocationPickedFromMap}
        initialCoordinates={deliveryCoordinates}
        title="Set Delivery Address on Map"
      />
    </div>
  );
}
