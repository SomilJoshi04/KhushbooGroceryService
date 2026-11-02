/**
 * Admin Panel Layout Component.
 *
 * Provides persistent clean white sidebar navigation, light neutral content area,
 * admin header with role badge, live storefront shortcut, and mobile responsive drawer.
 *
 * Organized into:
 * 1. Store Operations (Dashboard, Orders, Products, Categories, Inventory, Zone Management, Store Settings)
 * 2. Customers & Growth (Customers, Coupons, Reports & Analytics)
 * 3. Website & Management (Content Management, Admin Profile)
 *
 * @module pages/admin/AdminLayout
 */

import React, { useState, useEffect, useRef } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useStoreSettings } from '../../context/StoreSettingsContext.jsx';
import { NotificationBell } from '../../components/NotificationBell.jsx';
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Grid,
  Boxes,
  Users,
  TicketPercent,
  Settings,
  BarChart3,
  User as UserIcon,
  LogOut,
  ExternalLink,
  Menu,
  X,
  ShieldCheck,
  MapPin,
  FileText,
  Image as ImageIcon,
  Store,
  Eye,
  ChevronDown,
} from 'lucide-react';

export function AdminLayout() {
  const { user, isAdmin, isSuperAdmin, enterPreviewMode, logout, loading } = useAuth();
  const { settings } = useStoreSettings();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [adminDropdownOpen, setAdminDropdownOpen] = useState(false);
  const adminDropdownRef = useRef(null);
  const navigate = useNavigate();

  // Ensure active admin working mode clears preview state
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('khushboo_admin_preview');
    }
  }, []);

  // Close admin profile dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (adminDropdownRef.current && !adminDropdownRef.current.contains(event.target)) {
        setAdminDropdownOpen(false);
      }
    }
    if (adminDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [adminDropdownOpen]);

  const handleOpenLiveStore = () => {
    enterPreviewMode();
    navigate('/');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary-bg text-text-main">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-brand border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold text-text-muted">Loading administrative portal...</span>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen py-20 flex flex-col items-center justify-center text-center px-4 bg-primary-bg text-text-main">
        <div className="w-16 h-16 rounded-2xl bg-status-error/10 border border-status-error/20 text-status-error flex items-center justify-center mb-4 shadow-xs">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold font-heading text-text-main">Access Denied</h2>
        <p className="text-xs text-text-muted max-w-sm mt-1 mb-6">
          You must be logged in as an authorized store administrator or manager to access the administration portal.
        </p>
        <Link
          to="/"
          className="px-5 py-2.5 bg-brand hover:bg-brand-hover text-white font-bold text-xs rounded-xl transition shadow-xs"
        >
          Return to Storefront
        </Link>
      </div>
    );
  }

  const navSections = [
    {
      title: 'Store Operations',
      links: [
        { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/admin/orders', label: 'Orders & Deliveries', icon: Package },
        { to: '/admin/products', label: 'Products & Variants', icon: ShoppingBag },
        { to: '/admin/categories', label: 'Categories', icon: Grid },
        { to: '/admin/inventory', label: 'Inventory & Stock', icon: Boxes },
        { to: '/admin/zones', label: 'Zone Management', icon: MapPin },
        { to: '/admin/settings', label: 'Delivery & Store Settings', icon: Settings },
      ],
    },
    {
      title: 'Customers & Growth',
      links: [
        { to: '/admin/customers', label: 'Customers', icon: Users },
        { to: '/admin/coupons', label: 'Coupons & Offers', icon: TicketPercent },
        { to: '/admin/reports', label: 'Reports & Analytics', icon: BarChart3 },
      ],
    },
    {
      title: 'Website Management',
      links: [
        { to: '/admin/banners', label: 'Promotional Banners', icon: ImageIcon },
        { to: '/admin/content', label: 'Content Management', icon: FileText },
        { to: '/admin/profile', label: 'Admin Profile', icon: UserIcon },
      ],
    },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-primary-bg text-text-main flex flex-col">
      {/* Admin Top Header */}
      <header className="sticky top-0 z-40 bg-surface border-b border-border-neutral px-4 sm:px-6 h-16 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSidebarOpen((prev) => !prev)}
            className="md:hidden p-2 rounded-xl text-text-muted hover:text-text-main hover:bg-surface-subtle transition"
            aria-label="Toggle Navigation Menu"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <Link to="/admin/dashboard" className="flex items-center gap-2.5">
            <img
              src="/websiteLogo.png"
              alt="Khushboo Admin Logo"
              className="w-8 h-8 rounded-lg object-contain shadow-xs border border-border-neutral/60 bg-surface"
            />
            <div>
              <span className="font-heading font-extrabold text-sm text-text-main block leading-tight">
                Khushboo <span className="text-brand">Admin</span>
              </span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-brand block">
                {user?.role || 'SUPER_ADMIN'}
              </span>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Prominent Live Store Navigation Button */}
          <button
            type="button"
            onClick={handleOpenLiveStore}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-light hover:bg-brand-light/80 border border-brand/30 text-xs text-brand font-bold transition shadow-xs cursor-pointer active:scale-98"
            title="Open Customer-Facing Storefront Preview"
          >
            <Store className="w-4 h-4 text-brand shrink-0" />
            <span className="hidden xs:inline">Live Store</span>
            <ExternalLink className="w-3 h-3 text-brand/70" />
          </button>

          {/* Real-time Notifications Bell */}
          <NotificationBell placement="admin" />

          {/* Administrative Profile Dropdown */}
          <div className="relative inline-block text-left" ref={adminDropdownRef}>
            <button
              type="button"
              onClick={() => setAdminDropdownOpen((prev) => !prev)}
              className="flex items-center gap-2 pl-2 sm:pl-3 py-1 rounded-xl hover:bg-surface-subtle border border-transparent hover:border-border-neutral transition cursor-pointer"
              aria-label="Admin Profile Menu"
              aria-expanded={adminDropdownOpen}
            >
              <div className="w-8 h-8 rounded-lg overflow-hidden bg-brand-light text-brand font-bold flex items-center justify-center text-xs shrink-0 border border-brand/20">
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user?.name || 'Admin'}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  user?.name?.[0]?.toUpperCase() || 'A'
                )}
              </div>
              <div className="hidden md:block text-left text-xs leading-tight">
                <span className="font-bold text-text-main block truncate max-w-[120px]">{user?.name}</span>
                <span className="text-[10px] text-brand block font-semibold uppercase">{user?.role || 'SUPER_ADMIN'}</span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-text-muted hidden sm:block" />
            </button>

            {adminDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-surface border border-border-neutral rounded-2xl shadow-xl p-2 z-50 text-xs animate-fadeIn">
                {/* Header Card */}
                <div className="p-3 border-b border-border-neutral mb-1 bg-surface-subtle/50 rounded-xl">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-brand text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                      {user?.name?.[0]?.toUpperCase() || 'A'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-text-main truncate">{user?.name || 'Administrator'}</p>
                      <p className="text-[10px] text-text-muted font-mono truncate">{user?.email || user?.phone}</p>
                      <span className="inline-block mt-1 text-[9px] px-2 py-0.5 rounded-full bg-brand-light text-brand font-bold uppercase tracking-wider">
                        {user?.role || 'SUPER_ADMIN'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Navigation Items */}
                <div className="space-y-0.5 py-1">
                  <Link
                    to="/admin/profile"
                    onClick={() => setAdminDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-text-muted hover:text-text-main hover:bg-surface-subtle transition font-medium"
                  >
                    <UserIcon className="w-4 h-4 text-brand shrink-0" />
                    <span>Admin Profile</span>
                  </Link>

                  <Link
                    to="/admin/settings"
                    onClick={() => setAdminDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-text-muted hover:text-text-main hover:bg-surface-subtle transition font-medium"
                  >
                    <Settings className="w-4 h-4 text-brand shrink-0" />
                    <span>Delivery & Store Settings</span>
                  </Link>

                  <button
                    type="button"
                    onClick={() => {
                      setAdminDropdownOpen(false);
                      handleOpenLiveStore();
                    }}
                    className="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-xl text-brand hover:bg-brand-light/60 transition font-semibold cursor-pointer"
                  >
                    <Store className="w-4 h-4 text-brand shrink-0" />
                    <span>Preview Live Storefront</span>
                  </button>
                </div>

                {/* Sign Out Action */}
                <div className="pt-1 border-t border-border-neutral mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setAdminDropdownOpen(false);
                      handleLogout();
                    }}
                    className="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-xl text-status-error hover:bg-status-error/10 transition font-semibold cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 shrink-0" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Container with Sidebar + Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Navigation */}
        <aside
          className={`fixed md:static inset-y-16 md:inset-y-0 left-0 z-30 w-64 bg-surface border-r border-border-neutral p-4 flex flex-col justify-between transition-transform duration-300 ease-in-out shadow-xs overflow-y-auto ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          }`}
        >
          <div className="space-y-4">
            {/* Live Storefront Quick Preview Card in Sidebar */}
            <div className="p-3 bg-brand-light/40 border border-brand/20 rounded-2xl flex items-center justify-between shadow-xs">
              <div className="min-w-0 pr-2">
                <span className="text-[9px] font-bold uppercase tracking-wider text-brand block truncate">
                  Customer Store
                </span>
                <span className="text-xs font-bold text-text-main block truncate">
                  Live Preview
                </span>
              </div>
              <button
                type="button"
                onClick={handleOpenLiveStore}
                className="px-2.5 py-1.5 bg-brand hover:bg-brand-hover text-white text-[11px] font-semibold rounded-xl flex items-center gap-1.5 transition shadow-xs cursor-pointer shrink-0 active:scale-98"
                title="Preview Live Storefront"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>View</span>
              </button>
            </div>
            {navSections.map((section) => (
              <div key={section.title} className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted px-3 py-1 block">
                  {section.title}
                </span>
                {section.links.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setSidebarOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3.5 py-2.5 text-xs font-semibold transition ${
                          isActive
                            ? 'bg-brand-light text-brand font-bold border-l-4 border-brand rounded-r-xl rounded-l-none shadow-xs'
                            : 'text-text-muted hover:text-text-main hover:bg-surface-subtle rounded-xl border-l-4 border-transparent'
                        }`
                      }
                    >
                      <Icon className="w-4 h-4 shrink-0 text-brand" />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Store Info Footer Card in Sidebar */}
          <div className="p-3 bg-surface-subtle border border-border-neutral rounded-xl text-[11px] text-text-muted space-y-1 mt-6">
            <div className="flex items-center gap-1.5 text-text-main font-bold">
              <span className={`w-2 h-2 rounded-full ${settings.isOpen ? 'bg-status-success' : 'bg-status-warning'}`} />
              <span>{settings.serviceCity || 'Indore'} {settings.isOpen ? 'Store Active' : 'Orders Paused'}</span>
            </div>
            <p className="truncate" title={settings.address}>{settings.centralHub || 'Central Dispatch Hub'} (PIN {settings.servicePincode || '452001'})</p>
            <p className="text-[10px] text-text-muted">Min Order: ₹{settings.minOrderAmountRupees} • Speed: {settings.estimatedDeliveryWindow}</p>
          </div>
        </aside>

        {/* Content Area */}
        <main id="admin-main-scroll" className="flex-1 overflow-y-auto overflow-x-hidden min-w-0 bg-primary-bg p-3 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
