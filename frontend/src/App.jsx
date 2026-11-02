/**
 * Khushboo Food Service — Production Grocery E-Commerce Platform.
 *
 * Full application routing:
 * - Public Storefront: Home (/), All Categories (/categories),
 *   Category Products (/categories/:slug), and Cart & Checkout.
 * - Customer Portal: Profile, Saved Addresses, Order History (/account).
 * - Admin Panel: Protected Dashboard, Orders, Products & Variants,
 *   Categories, Inventory, Customers, Coupons, Reports, Settings, Profile.
 *
 * @module App
 */

import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { SocketProvider } from './context/SocketContext.jsx';
import { NotificationProvider } from './context/NotificationContext.jsx';
import { StoreSettingsProvider } from './context/StoreSettingsContext.jsx';
import { CartProvider } from './context/CartContext.jsx';
import { Navbar } from './components/Navbar.jsx';
import { Footer } from './components/Footer.jsx';
import { AuthModal } from './components/AuthModal.jsx';
import { ScrollRestoration } from './components/ScrollRestoration.jsx';
import { AdminLiveStoreBanner } from './components/AdminLiveStoreBanner.jsx';

// Storefront Pages
import { HomePage } from './pages/HomePage.jsx';
import { CategoriesPage } from './pages/CategoriesPage.jsx';
import { CategoryDetailPage } from './pages/CategoryDetailPage.jsx';
import { AccountPage } from './pages/AccountPage.jsx';
import { CartPage } from './pages/CartPage.jsx';
import { ProductDetailPage } from './pages/ProductDetailPage.jsx';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage.jsx';
import { TermsPage } from './pages/TermsPage.jsx';
import { FaqPage } from './pages/FaqPage.jsx';
import { HelpSupportPage } from './pages/HelpSupportPage.jsx';

// Admin Pages
import { AdminLayout } from './pages/admin/AdminLayout.jsx';
import { AdminDashboard } from './pages/admin/AdminDashboard.jsx';
import { AdminOrders } from './pages/admin/AdminOrders.jsx';
import { AdminProducts } from './pages/admin/AdminProducts.jsx';
import { AdminCategories } from './pages/admin/AdminCategories.jsx';
import { AdminInventory } from './pages/admin/AdminInventory.jsx';
import { AdminCustomers } from './pages/admin/AdminCustomers.jsx';
import { AdminZones } from './pages/admin/AdminZones.jsx';
import { AdminContent } from './pages/admin/AdminContent.jsx';
import { AdminCoupons } from './pages/admin/AdminCoupons.jsx';
import { AdminReports } from './pages/admin/AdminReports.jsx';
import { AdminSettings } from './pages/admin/AdminSettings.jsx';
import { AdminBanners } from './pages/admin/AdminBanners.jsx';
import { AdminProfile } from './pages/admin/AdminProfile.jsx';

import { MobileFloatingCartBar } from './components/MobileFloatingCartBar.jsx';
import './App.css';

/**
 * Public Customer Storefront Layout (Header + Content + Footer)
 */
function StorefrontLayout({ onOpenAuth }) {
  return (
    <div className="min-h-screen flex flex-col bg-primary-bg text-text-main font-sans selection:bg-brand-light selection:text-brand-hover overflow-x-hidden max-w-full">
      <AdminLiveStoreBanner />
      <Navbar onOpenAuth={onOpenAuth} />
      <main className="flex-1">
        <Outlet />
      </main>
      <MobileFloatingCartBar />
      <Footer />
    </div>
  );
}

/**
 * Role-Aware Storefront Home Route.
 * If authenticated as Super Admin or Admin and not actively in Live Store preview mode,
 * redirect immediately to Admin Dashboard as the primary default workspace.
 */
function StorefrontHomeRoute({ onOpenAuth }) {
  const { isAdmin, isPreviewMode, loading } = useAuth();

  if (!loading && isAdmin && !isPreviewMode) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <HomePage onOpenAuth={onOpenAuth} />;
}

/**
 * Customer Account Route Guard.
 * Administrative accounts are redirected to the Admin Profile instead of customer order history.
 */
function AccountRoute({ onOpenAuth }) {
  const { isAdmin, loading } = useAuth();

  if (!loading && isAdmin) {
    return <Navigate to="/admin/profile" replace />;
  }

  return <AccountPage onOpenAuth={onOpenAuth} />;
}

export default function App() {
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  React.useEffect(() => {
    const handleOpenAuth = () => setIsAuthOpen(true);
    window.addEventListener('khushboo:open_auth', handleOpenAuth);
    return () => window.removeEventListener('khushboo:open_auth', handleOpenAuth);
  }, []);

  return (
    <BrowserRouter>
      {/* Global Scroll Restoration across all route navigations & history navigation */}
      <ScrollRestoration />

      <AuthProvider>
        <SocketProvider>
          <NotificationProvider>
            <StoreSettingsProvider>
              <CartProvider>
                {/* Authentication Modal (Phone OTP & Admin Login) */}
                <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />

                {/* Application Routes */}
                <Routes>
                  {/* Customer Storefront Routes */}
                  <Route element={<StorefrontLayout onOpenAuth={() => setIsAuthOpen(true)} />}>
                    <Route path="/" element={<StorefrontHomeRoute onOpenAuth={() => setIsAuthOpen(true)} />} />
                    <Route path="/categories" element={<CategoriesPage />} />
                    <Route path="/categories/:slug" element={<CategoryDetailPage />} />
                    <Route path="/products/:slug" element={<ProductDetailPage />} />
                    <Route path="/cart" element={<CartPage onOpenAuth={() => setIsAuthOpen(true)} />} />
                    <Route path="/account" element={<AccountRoute onOpenAuth={() => setIsAuthOpen(true)} />} />
                    <Route path="/account/*" element={<AccountRoute onOpenAuth={() => setIsAuthOpen(true)} />} />
                    <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
                    <Route path="/terms" element={<TermsPage />} />
                    <Route path="/faq" element={<FaqPage />} />
                    <Route path="/help" element={<HelpSupportPage />} />
                  </Route>

                  {/* Admin Management Portal (Protected by AdminLayout RBAC Guard) */}
                  <Route path="/admin" element={<AdminLayout />}>
                    <Route index element={<Navigate to="/admin/dashboard" replace />} />
                    <Route path="dashboard" element={<AdminDashboard />} />
                    <Route path="orders" element={<AdminOrders />} />
                    <Route path="products" element={<AdminProducts />} />
                    <Route path="categories" element={<AdminCategories />} />
                    <Route path="inventory" element={<AdminInventory />} />
                    <Route path="zones" element={<AdminZones />} />
                    <Route path="customers" element={<AdminCustomers />} />
                    <Route path="content" element={<AdminContent />} />
                    <Route path="coupons" element={<AdminCoupons />} />
                    <Route path="reports" element={<AdminReports />} />
                    <Route path="payments" element={<AdminReports />} />
                    <Route path="settings" element={<AdminSettings />} />
                    <Route path="delivery-settings" element={<AdminSettings />} />
                    <Route path="banners" element={<AdminBanners />} />
                    <Route path="profile" element={<AdminProfile />} />
                    <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
                  </Route>

                  {/* Fallback Catch-all Route */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </CartProvider>
            </StoreSettingsProvider>
          </NotificationProvider>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
