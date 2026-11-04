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
import { NotificationToastContainer } from './components/NotificationToastContainer.jsx';

// Storefront Pages
import { HomePage } from './pages/HomePage.jsx';
import { CategoriesPage } from './pages/CategoriesPage.jsx';
import { CategoryDetailPage } from './pages/CategoryDetailPage.jsx';
import { AccountPage } from './pages/AccountPage.jsx';
import { CartPage } from './pages/CartPage.jsx';
import { ProductDetailPage } from './pages/ProductDetailPage.jsx';
import { SkeletonDashboard } from './components/skeleton/index.js';

// Dedicated Authentication Pages
import { LoginPage } from './pages/auth/LoginPage.jsx';
import { RegisterPage } from './pages/auth/RegisterPage.jsx';
import { VerifyEmailPage } from './pages/auth/VerifyEmailPage.jsx';
import { VerifyEmailPendingPage } from './pages/auth/VerifyEmailPendingPage.jsx';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage.jsx';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage.jsx';
import { ClaimAccountPage } from './pages/auth/ClaimAccountPage.jsx';

// Lazy-loaded Legal & Secondary Content
const PrivacyPolicyPage = React.lazy(() =>
  import('./pages/PrivacyPolicyPage.jsx').then((m) => ({ default: m.PrivacyPolicyPage }))
);
const TermsPage = React.lazy(() =>
  import('./pages/TermsPage.jsx').then((m) => ({ default: m.TermsPage }))
);
const FaqPage = React.lazy(() =>
  import('./pages/FaqPage.jsx').then((m) => ({ default: m.FaqPage }))
);
const HelpSupportPage = React.lazy(() =>
  import('./pages/HelpSupportPage.jsx').then((m) => ({ default: m.HelpSupportPage }))
);

// Lazy-loaded Administrative Suite (Isolated from storefront customer bundles)
const AdminLayout = React.lazy(() =>
  import('./pages/admin/AdminLayout.jsx').then((m) => ({ default: m.AdminLayout }))
);
const AdminDashboard = React.lazy(() =>
  import('./pages/admin/AdminDashboard.jsx').then((m) => ({ default: m.AdminDashboard }))
);
const AdminOrders = React.lazy(() =>
  import('./pages/admin/AdminOrders.jsx').then((m) => ({ default: m.AdminOrders }))
);
const AdminProducts = React.lazy(() =>
  import('./pages/admin/AdminProducts.jsx').then((m) => ({ default: m.AdminProducts }))
);
const AdminCategories = React.lazy(() =>
  import('./pages/admin/AdminCategories.jsx').then((m) => ({ default: m.AdminCategories }))
);
const AdminInventory = React.lazy(() =>
  import('./pages/admin/AdminInventory.jsx').then((m) => ({ default: m.AdminInventory }))
);
const AdminCustomers = React.lazy(() =>
  import('./pages/admin/AdminCustomers.jsx').then((m) => ({ default: m.AdminCustomers }))
);
const AdminZones = React.lazy(() =>
  import('./pages/admin/AdminZones.jsx').then((m) => ({ default: m.AdminZones }))
);
const AdminContent = React.lazy(() =>
  import('./pages/admin/AdminContent.jsx').then((m) => ({ default: m.AdminContent }))
);
const AdminCoupons = React.lazy(() =>
  import('./pages/admin/AdminCoupons.jsx').then((m) => ({ default: m.AdminCoupons }))
);
const AdminReports = React.lazy(() =>
  import('./pages/admin/AdminReports.jsx').then((m) => ({ default: m.AdminReports }))
);
const AdminSettings = React.lazy(() =>
  import('./pages/admin/AdminSettings.jsx').then((m) => ({ default: m.AdminSettings }))
);
const AdminBanners = React.lazy(() =>
  import('./pages/admin/AdminBanners.jsx').then((m) => ({ default: m.AdminBanners }))
);
const AdminProfile = React.lazy(() =>
  import('./pages/admin/AdminProfile.jsx').then((m) => ({ default: m.AdminProfile }))
);

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
        <React.Suspense fallback={null}>
          <Outlet />
        </React.Suspense>
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
            {/* Position-Aware Real-Time Notification Toasts (Global for Customer & Admin) */}
            <NotificationToastContainer />
            <StoreSettingsProvider>
              <CartProvider>
                {/* Application Routes */}
                <Routes>
                  {/* Customer Storefront Routes */}
                  <Route element={<StorefrontLayout onOpenAuth={() => setIsAuthOpen(true)} />}>
                    <Route path="/" element={<StorefrontHomeRoute onOpenAuth={() => setIsAuthOpen(true)} />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                    <Route path="/signup" element={<RegisterPage />} />
                    <Route path="/verify-email" element={<VerifyEmailPage />} />
                    <Route path="/verify-email-pending" element={<VerifyEmailPendingPage />} />
                    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                    <Route path="/reset-password" element={<ResetPasswordPage />} />
                    <Route path="/claim-account" element={<ClaimAccountPage />} />
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
                  <Route
                    path="/admin"
                    element={
                      <React.Suspense
                        fallback={
                          <div className="min-h-screen bg-primary-bg p-6 flex flex-col items-center justify-center">
                            <SkeletonDashboard />
                          </div>
                        }
                      >
                        <AdminLayout />
                      </React.Suspense>
                    }
                  >
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

                {/* Authentication Modal (Phone OTP & Admin Login) - Highest Priority Dialog */}
                <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
              </CartProvider>
            </StoreSettingsProvider>
          </NotificationProvider>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
