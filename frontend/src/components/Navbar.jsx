/**
 * Navigation Bar Component — Professional Grocery E-commerce Header.
 *
 * Single-Row Primary Navigation:
 * [Logo + Khushboo Grocery] [Store Location Selector] [Search Bar] [Categories] [Profile] [Cart]
 *
 * Features:
 * - Location selector beside logo with dynamic location state & Leaflet map picker.
 * - Dismissible slim announcement strip for store notices / paused alerts.
 * - Flexible-width search bar syncing with URL query params.
 * - Categories link, Profile dropdown with outside-click handling, and animated Cart button.
 * - Responsive breakpoints for Desktop, Tablet, and Mobile.
 *
 * @module components/Navbar
 */

import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  ShoppingBag,
  Search,
  MapPin,
  User as UserIcon,
  ShieldCheck,
  LogOut,
  ChevronDown,
  LayoutDashboard,
  Grid,
  X,
  Check,
  Settings,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useStoreSettings } from '../context/StoreSettingsContext.jsx';
import { motion, AnimatePresence } from 'framer-motion';
import { LocationPickerModal } from './map/LocationPickerModal.jsx';
import { NotificationBell } from './NotificationBell.jsx';
import { resolveImageUrl, getApiUploadUrl } from '../config/api.js';

export function Navbar({ onOpenAuth }) {
  const { user, isAuthenticated, isAdmin, isSuperAdmin, logout, exitPreviewMode } = useAuth();
  const { cartItemCount, cartSubtotalPaise, cartBounceKey } = useCart();
  const { settings } = useStoreSettings();

  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isAddressSelectOpen, setIsAddressSelectOpen] = useState(false);

  const userDropdownRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Active customer location state (loaded from localStorage or fallback)
  const [customerLocation, setCustomerLocation] = useState(() => {
    try {
      const stored = localStorage.getItem('khushboo_customer_location');
      if (stored) return JSON.parse(stored);
    } catch (e) {
      // Ignore JSON parse errors
    }
    return null;
  });

  // Track dismissed announcement banner in sessionStorage
  const [dismissedNotice, setDismissedNotice] = useState(() => {
    try {
      return sessionStorage.getItem('khushboo_dismissed_notice');
    } catch (e) {
      return null;
    }
  });

  // Keep search input synced with URL query param if present
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get('search');
    if (q !== null && q !== undefined) {
      setSearchTerm(q);
    } else {
      setSearchTerm('');
    }
  }, [location.search]);

  // Close profile dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target)) {
        setUserDropdownOpen(false);
      }
    }
    if (userDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [userDropdownOpen]);

  // Compute active location display label
  const displayLocationLabel = (() => {
    if (customerLocation?.shortName) {
      return customerLocation.shortName;
    }
    if (customerLocation?.locality) {
      return customerLocation.locality;
    }
    if (customerLocation?.formattedAddress) {
      return customerLocation.formattedAddress.split(',')[0].trim();
    }
    const defaultAddr = user?.addresses?.find((a) => a.isDefault) || user?.addresses?.[0];
    if (defaultAddr) {
      return (
        defaultAddr.locality ||
        defaultAddr.landmark ||
        defaultAddr.street?.split(',')[0].trim() ||
        defaultAddr.city ||
        'Indore'
      );
    }
    if (settings?.centralHub) {
      return settings.centralHub;
    }
    if (settings?.serviceCity) {
      return settings.serviceCity;
    }
    return 'Select delivery location';
  })();

  // Handle location selection from interactive Leaflet map modal
  const handleLocationModalConfirm = (locData) => {
    const shortName =
      locData.locality ||
      (locData.formattedAddress ? locData.formattedAddress.split(',')[0].trim() : '') ||
      locData.city ||
      'Selected Location';

    const newLoc = {
      shortName,
      locality: locData.locality || '',
      formattedAddress: locData.formattedAddress || '',
      coordinates: locData.coordinates || null,
      pincode: locData.pincode || '',
      city: locData.city || 'Indore',
    };

    setCustomerLocation(newLoc);
    try {
      localStorage.setItem('khushboo_customer_location', JSON.stringify(newLoc));
      window.dispatchEvent(new CustomEvent('khushboo:location_changed', { detail: newLoc }));
    } catch (e) {
      // Ignore storage errors
    }
    setIsLocationModalOpen(false);
  };

  // Handle location selection from saved addresses list
  const handleSelectSavedAddress = (addr) => {
    const shortName =
      addr.locality ||
      addr.landmark ||
      addr.street?.split(',')[0].trim() ||
      addr.city ||
      'Indore';

    const newLoc = {
      addressId: addr._id,
      shortName,
      locality: addr.locality || '',
      formattedAddress: `${addr.street}, ${addr.city} ${addr.pincode}`,
      pincode: addr.pincode || '',
      city: addr.city || 'Indore',
      coordinates: addr.coordinates || null,
    };

    setCustomerLocation(newLoc);
    try {
      localStorage.setItem('khushboo_customer_location', JSON.stringify(newLoc));
      window.dispatchEvent(new CustomEvent('khushboo:location_changed', { detail: newLoc }));
    } catch (e) {
      // Ignore storage errors
    }
    setIsAddressSelectOpen(false);
  };

  // Open location selector flow (saved address switcher if multiple, else map picker directly)
  const handleOpenLocationFlow = () => {
    if (user?.addresses && user.addresses.length > 1) {
      setIsAddressSelectOpen(true);
    } else {
      setIsLocationModalOpen(true);
    }
  };

  // Dismiss promotional notice
  const handleDismissNotice = () => {
    if (settings?.announcementNotice) {
      try {
        sessionStorage.setItem('khushboo_dismissed_notice', settings.announcementNotice);
      } catch (e) {}
      setDismissedNotice(settings.announcementNotice);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      navigate(`/?search=${encodeURIComponent(searchTerm.trim())}`);
    } else {
      navigate('/');
    }
  };

  const handleClearNavbarSearch = () => {
    setSearchTerm('');
    if (location.search.includes('search=')) {
      navigate('/');
    }
  };

  const handleLogout = async () => {
    await logout();
    setUserDropdownOpen(false);
    navigate('/');
  };

  const cartTotalRupees = (cartSubtotalPaise / 100).toFixed(0);

  const showNotice =
    Boolean(settings?.announcementNotice) && dismissedNotice !== settings?.announcementNotice;
  const showStoreClosed = settings && settings.isOpen === false;

  return (
    <>
      <header className="sticky top-0 z-40 w-full max-w-full bg-surface/98 backdrop-blur-md border-b border-border-neutral shadow-xs">
        {/* Slim, optional, dismissible announcement banner */}
        {(showStoreClosed || showNotice) && (
          <div
            className={`px-3 sm:px-4 py-1.5 text-xs font-medium border-b flex items-center justify-between gap-2 sm:gap-3 ${
              showStoreClosed
                ? 'bg-amber-500/10 text-amber-900 border-amber-500/20'
                : 'bg-brand-light text-brand border-brand/20'
            }`}
          >
            <div className="max-w-7xl mx-auto flex-1 flex items-center justify-center gap-2 text-center min-w-0">
              <span className="truncate">
                {showStoreClosed
                  ? '⚠️ Online checkout is temporarily paused for maintenance. You can still browse products!'
                  : `📢 ${settings.announcementNotice}`}
              </span>
            </div>
            {showNotice && !showStoreClosed && (
              <button
                type="button"
                onClick={handleDismissNotice}
                className="p-1 rounded hover:bg-brand/10 text-brand transition shrink-0"
                aria-label="Dismiss announcement notice"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Clean, Single-Row Main Header */}
        <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 h-15 sm:h-16 md:h-17 flex items-center justify-between gap-1.5 sm:gap-4">
          {/* Left: Brand Logo & Store Location Selector */}
          <div className="flex items-center gap-1.5 sm:gap-3 lg:gap-4 min-w-0 flex-1 sm:flex-initial">
            {/* 1. Brand Logo */}
            <Link to="/" className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 group" aria-label="Khushboo Grocery Service Home">
              <img
                src="/websiteLogo.png"
                alt="Khushboo Grocery Service Logo"
                className="w-8 h-8 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl object-contain shadow-xs border border-border-neutral/60 bg-surface group-hover:scale-105 transition-transform shrink-0"
              />
              <div className="flex flex-col justify-center leading-none">
                <span className="font-heading font-extrabold text-[13px] sm:text-base md:text-lg tracking-tight text-text-main leading-tight whitespace-nowrap">
                  Khushboo <span className="text-brand">Grocery</span>
                  <span className="hidden sm:inline text-brand"> Service</span>
                </span>
                <span className="text-[8.5px] uppercase font-bold tracking-wider text-brand block sm:hidden leading-none mt-0.5">
                  Service
                </span>
                <span className="text-[9px] uppercase font-bold tracking-widest text-text-muted hidden sm:block mt-0.5">
                  Pure & Stone-Ground
                </span>
              </div>
            </Link>

            {/* Divider between brand and location */}
            <div className="h-6 sm:h-7 w-px bg-border-neutral hidden sm:block shrink-0" />

            {/* 2. Store Location Selector beside Logo */}
            <button
              type="button"
              onClick={handleOpenLocationFlow}
              className="flex items-center gap-1 sm:gap-2 px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-surface-subtle/70 sm:bg-transparent hover:bg-surface-subtle border border-border-neutral/60 sm:border-transparent hover:border-border-neutral transition text-left shrink min-w-0 max-w-[105px] xs:max-w-[130px] sm:max-w-[200px] lg:max-w-[240px] group focus:outline-none focus:ring-1 focus:ring-brand"
              aria-label="Select delivery location"
              title={`Delivering to: ${displayLocationLabel}. Click to change.`}
            >
              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-md sm:rounded-lg bg-brand-light text-brand flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <MapPin className="w-3 h-3 sm:w-4 sm:h-4 text-brand" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="hidden sm:flex items-center gap-1.5 leading-none">
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider truncate">
                    Delivering to
                  </span>
                  <span className="text-[10px] font-bold text-brand hover:underline shrink-0">
                    Change
                  </span>
                </div>
                <div className="flex items-center gap-0.5 sm:mt-0.5">
                  <span className="text-[11px] sm:text-xs font-bold text-text-main truncate leading-tight block">
                    {displayLocationLabel}
                  </span>
                  <ChevronDown className="w-3 h-3 text-text-muted shrink-0 group-hover:text-text-main transition" />
                </div>
              </div>
            </button>
          </div>

          {/* 3. Search Input (Desktop & Tablet) */}
          <form
            onSubmit={handleSearchSubmit}
            className="hidden md:flex flex-1 max-w-md lg:max-w-xl mx-2 lg:mx-4 relative items-center"
          >
            <Search className="w-4 h-4 text-text-muted absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search products & groceries..."
              className="w-full bg-surface border border-border-neutral rounded-xl pl-10 pr-9 py-2 text-xs text-text-main placeholder:text-text-muted focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition shadow-xs h-10"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={handleClearNavbarSearch}
                className="absolute right-3 text-text-muted hover:text-text-main transition p-1 cursor-pointer"
                aria-label="Clear search query"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </form>

          {/* Right Group: Categories, Customer Profile & Live Cart */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* 4. Categories Navigation */}
            <Link
              to="/categories"
              className={`hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold h-10 transition shrink-0 ${
                location.pathname.startsWith('/categories')
                  ? 'bg-brand-light text-brand border border-brand/20'
                  : 'text-text-muted hover:text-text-main hover:bg-surface-subtle border border-transparent hover:border-border-neutral'
              }`}
            >
              <Grid className="w-4 h-4 text-brand" />
              <span>Categories</span>
            </Link>

            {/* 5. Customer Profile Dropdown */}
            {isAuthenticated ? (
              <div className="relative shrink-0" ref={userDropdownRef}>
                <button
                  type="button"
                  onClick={() => setUserDropdownOpen((prev) => !prev)}
                  className="flex items-center gap-1.5 sm:gap-2 p-1.5 sm:px-3 sm:py-2 rounded-xl bg-surface border border-border-neutral text-xs font-medium text-text-main hover:border-brand/40 transition shadow-xs h-9 sm:h-10 focus:outline-none focus:ring-1 focus:ring-brand shrink-0"
                  aria-haspopup="true"
                  aria-expanded={userDropdownOpen}
                  aria-label="User account menu"
                >
                  <div className="w-6 h-6 rounded-full overflow-hidden bg-brand-light text-brand flex items-center justify-center font-bold text-[11px] shrink-0 border border-brand/20">
                    {user?.avatar ? (
                      <img
                        src={resolveImageUrl(user.avatar)}
                        alt={user?.name || 'User'}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const apiFallback = getApiUploadUrl(user.avatar);
                          if (apiFallback && e.currentTarget.src !== apiFallback) {
                            e.currentTarget.src = apiFallback;
                            return;
                          }
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      user?.name?.[0]?.toUpperCase() || 'U'
                    )}
                  </div>
                  <span className="hidden sm:inline-block max-w-[85px] truncate font-semibold">
                    {user?.name || 'Account'}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-text-muted hidden sm:block" />
                </button>

                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-60 bg-surface border border-border-neutral rounded-xl shadow-lg p-2 z-50 text-xs animate-fadeIn">
                    <div className="px-3 py-2 border-b border-border-neutral mb-1 flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full overflow-hidden bg-brand-light text-brand flex items-center justify-center font-bold text-xs shrink-0 border border-brand/20">
                        {user?.avatar ? (
                          <img
                            src={resolveImageUrl(user.avatar)}
                            alt={user?.name || 'User'}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const apiFallback = getApiUploadUrl(user.avatar);
                              if (apiFallback && e.currentTarget.src !== apiFallback) {
                                e.currentTarget.src = apiFallback;
                                return;
                              }
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          user?.name?.[0]?.toUpperCase() || 'U'
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-text-main truncate">{user?.name}</p>
                        <p className="text-[11px] text-text-muted truncate">
                          {user?.email || user?.phone}
                        </p>
                        <span className="inline-block mt-0.5 text-[9px] px-2 py-0.5 rounded-full bg-brand-light text-brand font-bold uppercase tracking-wider">
                          {user?.role}
                        </span>
                      </div>
                    </div>

                    {isAdmin ? (
                      <div className="space-y-1 mb-1">
                        <Link
                          to="/admin/dashboard"
                          onClick={() => {
                            exitPreviewMode();
                            setUserDropdownOpen(false);
                          }}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-light text-brand hover:bg-brand-light/80 transition font-bold"
                        >
                          <LayoutDashboard className="w-4 h-4 text-brand shrink-0" />
                          <span>Back to Admin Dashboard</span>
                        </Link>

                        <Link
                          to="/admin/profile"
                          onClick={() => {
                            exitPreviewMode();
                            setUserDropdownOpen(false);
                          }}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-subtle transition font-medium"
                        >
                          <UserIcon className="w-4 h-4 text-brand shrink-0" />
                          <span>Admin Profile</span>
                        </Link>

                        <Link
                          to="/admin/settings"
                          onClick={() => {
                            exitPreviewMode();
                            setUserDropdownOpen(false);
                          }}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-subtle transition font-medium"
                        >
                          <Settings className="w-4 h-4 text-brand shrink-0" />
                          <span>Delivery & Store Settings</span>
                        </Link>
                      </div>
                    ) : (
                      <Link
                        to="/account"
                        onClick={() => setUserDropdownOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-subtle transition font-medium"
                      >
                        <UserIcon className="w-4 h-4 text-brand shrink-0" />
                        <span>My Account & Orders</span>
                      </Link>
                    )}

                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-error hover:bg-error/10 transition mt-1"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Log Out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenAuth}
                className="flex items-center gap-1 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-surface hover:bg-surface-subtle border border-border-neutral hover:border-brand/40 text-xs font-semibold text-text-main transition shadow-xs h-9 sm:h-10 focus:outline-none focus:ring-1 focus:ring-brand shrink-0"
              >
                <UserIcon className="w-3.5 h-3.5 text-brand" />
                <span>Sign In</span>
              </button>
            )}

            {/* Real-time Notifications Bell */}
            {isAuthenticated && <NotificationBell placement="customer" />}

            {/* 6. Live Cart Button with Product-to-Cart Bounce Animation */}
            <Link
              to="/cart"
              id="header-cart-icon"
              className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-brand hover:bg-brand-hover text-white font-semibold text-xs h-9 sm:h-10 transition shadow-xs active:scale-98 shrink-0 focus:outline-none focus:ring-2 focus:ring-brand"
              aria-label="View Shopping Cart"
            >
              <motion.div
                key={cartBounceKey}
                animate={cartBounceKey > 0 ? { scale: [1, 1.28, 0.9, 1.08, 1], rotate: [0, -8, 8, -3, 0] } : {}}
                transition={{ duration: 0.45, ease: 'easeOut' }}
                className="relative flex items-center justify-center"
              >
                <ShoppingBag className="w-4 h-4" />
                {cartItemCount > 0 && (
                  <motion.span
                    key={cartItemCount}
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                    className="absolute -top-2 -right-2 bg-white text-brand border border-brand text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-extrabold shadow-xs"
                  >
                    {cartItemCount}
                  </motion.span>
                )}
              </motion.div>
              <span className="hidden sm:inline-block">
                {cartItemCount > 0 ? `₹${cartTotalRupees}` : 'Cart'}
              </span>
            </Link>
          </div>
        </div>

        {/* Mobile Search Input Row (< 768px) */}
        <div className="md:hidden px-2.5 sm:px-4 pb-2 pt-0 bg-surface">
          <form onSubmit={handleSearchSubmit} className="relative flex items-center">
            <Search className="w-4 h-4 text-text-muted absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search products & groceries..."
              className="w-full bg-surface-subtle border border-border-neutral rounded-xl pl-9 pr-8 py-1.5 text-xs text-text-main placeholder:text-text-muted focus:outline-none focus:border-brand shadow-xs h-9"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={handleClearNavbarSearch}
                className="absolute right-2.5 text-text-muted hover:text-text-main p-1 cursor-pointer"
                aria-label="Clear search query"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </form>
        </div>
      </header>

      {/* Saved Addresses Quick-Select Modal */}
      {isAddressSelectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-text-main/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-surface rounded-2xl border border-border-neutral shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-border-neutral flex items-center justify-between bg-surface-subtle">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-brand" />
                <h3 className="text-sm font-bold font-heading text-text-main">
                  Select Delivery Location
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddressSelectOpen(false)}
                className="p-1 rounded-lg text-text-muted hover:text-text-main hover:bg-surface transition"
                aria-label="Close address selector"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
              {user?.addresses && user.addresses.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                    Saved Addresses
                  </p>
                  {user.addresses.map((addr) => {
                    const isSelected =
                      customerLocation?.addressId === addr._id ||
                      (!customerLocation && (addr.isDefault || user.addresses[0]._id === addr._id));
                    return (
                      <button
                        key={addr._id}
                        type="button"
                        onClick={() => handleSelectSavedAddress(addr)}
                        className={`w-full text-left p-3 rounded-xl border transition flex items-start justify-between gap-3 ${
                          isSelected
                            ? 'border-brand bg-brand-light/30 text-text-main'
                            : 'border-border-neutral bg-surface hover:bg-surface-subtle text-text-main'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[11px] font-bold text-brand uppercase tracking-wider bg-brand-light px-2 py-0.5 rounded-full border border-brand/20">
                              {addr.tag || 'Saved'}
                            </span>
                            {addr.isDefault && (
                              <span className="text-[10px] text-text-muted font-medium">Default</span>
                            )}
                          </div>
                          <p className="text-xs font-medium text-text-main line-clamp-2">
                            {addr.street}, {addr.city} {addr.pincode}
                          </p>
                        </div>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-brand text-white flex items-center justify-center shrink-0 mt-0.5">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setIsAddressSelectOpen(false);
                  setIsLocationModalOpen(true);
                }}
                className="w-full py-2.5 px-4 rounded-xl border border-dashed border-brand/40 hover:border-brand text-brand font-semibold text-xs flex items-center justify-center gap-2 hover:bg-brand-light/20 transition mt-2"
              >
                <MapPin className="w-4 h-4 text-brand" />
                <span>Choose on Map / New Location</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leaflet Interactive Map Location Picker */}
      <LocationPickerModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        onLocationSelect={handleLocationModalConfirm}
        initialCoordinates={
          customerLocation?.coordinates ||
          settings?.centralCoordinates || { lat: 22.7196, lng: 75.8577 }
        }
        title="Select Delivery Location in Indore"
      />
    </>
  );
}
