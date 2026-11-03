/**
 * Customer Account & Profile Page.
 *
 * Route: /account
 * Supports Profile Details, Multi-Address Book (Add/Edit/Delete/Set Default),
 * Order History with tracking timelines & cancellations, and Session Security.
 * Styled with warm ivory background, clean white cards, soft neutral dividers, and forest green accents.
 *
 * @module pages/AccountPage
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { apiClient } from '../config/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import {
  User as UserIcon,
  MapPin,
  Package,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  LogOut,
  RefreshCw,
  Home,
  Building,
  X,
  CreditCard,
  Banknote,
  Navigation,
  Camera,
  ArrowLeft,
  ArrowRight,
  Headphones,
  HelpCircle,
  FileText,
  ShieldCheck,
  Scale,
  Phone,
  Mail,
  Clock,
  Send,
  Bell,
  ExternalLink,
  CheckCheck,
  Lock,
  Key,
  Eye,
  EyeOff,
} from 'lucide-react';
import { LocationPickerModal } from '../components/map/LocationPickerModal.jsx';
import { Pagination } from '../components/Pagination.jsx';
import { useNotifications } from '../context/NotificationContext.jsx';
import { SkeletonAccountPage, SkeletonOrderList, SkeletonBase, SkeletonText } from '../components/skeleton/index.js';

export function AccountPage({ onOpenAuth }) {
  const {
    user,
    isAuthenticated,
    loading: authLoading,
    updateProfile,
    uploadAvatar,
    removeAvatar,
    addAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
    submitDeletionRequest,
    logout,
    changePassword,
    logoutAll,
  } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();

  const {
    notifications,
    unreadCount: notifUnreadCount,
    markAsRead: notifMarkAsRead,
    markAllAsRead: notifMarkAllAsRead,
    deleteNotification: notifDelete,
    clearAllRead: notifClearAllRead,
    loading: notifLoading,
  } = useNotifications();

  const ALLOWED_TABS = ['orders', 'addresses', 'profile', 'security', 'support', 'notifications'];
  const searchParams = new URLSearchParams(location.search);
  const initialTab = searchParams.get('tab') || location.state?.tab || 'orders';

  const [activeTab, setActiveTab] = useState(
    ALLOWED_TABS.includes(initialTab) ? initialTab : 'orders'
  );

  // Security & Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [passLoading, setPassLoading] = useState(false);
  const [passSuccess, setPassSuccess] = useState('');
  const [passError, setPassError] = useState('');
  const [logoutAllLoading, setLogoutAllLoading] = useState(false);
  const [logoutAllSuccess, setLogoutAllSuccess] = useState('');

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPassError('');
    setPassSuccess('');

    if (newPassword.length < 12) {
      setPassError('New password must contain at least 12 characters.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPassError('New passwords do not match.');
      return;
    }

    setPassLoading(true);
    try {
      await changePassword(currentPassword, newPassword, confirmNewPassword);
      setPassSuccess('Your password has been changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err) {
      setPassError(err.message || 'Failed to update password. Please check your current password.');
    } finally {
      setPassLoading(false);
    }
  };

  const handleLogoutAll = async () => {
    if (!window.confirm('Are you sure you want to log out from all devices? You will need to sign in again.')) {
      return;
    }
    setLogoutAllLoading(true);
    try {
      await logoutAll();
      navigate('/login', { replace: true });
    } catch (err) {
      setPassError(err.message || 'Failed to revoke sessions.');
    } finally {
      setLogoutAllLoading(false);
    }
  };

  useEffect(() => {
    const tabParam = new URLSearchParams(location.search).get('tab') || location.state?.tab;
    if (tabParam && ALLOWED_TABS.includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [location.search, location.state]);

  // Support Ticket Form State
  const [supportForm, setSupportForm] = useState({
    subject: '',
    message: '',
    orderNumber: '',
  });
  const [supportSubmitting, setSupportSubmitting] = useState(false);
  const [supportSuccess, setSupportSuccess] = useState('');
  const [supportError, setSupportError] = useState('');

  const handleSupportSubmit = async (e) => {
    e.preventDefault();
    if (!supportForm.subject.trim() || !supportForm.message.trim()) {
      setSupportError('Please provide both a subject and details of your request.');
      return;
    }
    setSupportSubmitting(true);
    setSupportError('');
    setSupportSuccess('');
    try {
      const res = await apiClient.post('/v1/content/inquiry', {
        name: user?.name || 'Customer',
        phone: user?.phone || '',
        email: user?.email || '',
        subject: supportForm.subject.trim(),
        message: supportForm.message.trim(),
        orderNumber: supportForm.orderNumber || '',
      });
      if (res.data?.success) {
        setSupportSuccess(res.data.message || 'Your support inquiry has been submitted! Our Indore team will contact you shortly.');
        setSupportForm({ subject: '', message: '', orderNumber: '' });
      } else {
        setSupportError(res.data?.message || 'Failed to submit inquiry.');
      }
    } catch (err) {
      setSupportError(err.response?.data?.message || err.message || 'Unable to submit support ticket.');
    } finally {
      setSupportSubmitting(false);
    }
  };

  // Avatar Upload State & Ref
  const avatarInputRef = useRef(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState('');

  // Profile Form State
  const [profileName, setProfileName] = useState(user?.name || '');
  const [profileEmail, setProfileEmail] = useState(user?.email || '');
  const [profileUpdating, setProfileUpdating] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [profileError, setProfileError] = useState('');

  // Account Deletion State
  const [deletionReason, setDeletionReason] = useState('');
  const [deletionSubmitting, setDeletionSubmitting] = useState(false);
  const [deletionMsg, setDeletionMsg] = useState('');
  const [deletionError, setDeletionError] = useState('');
  const [showDeletionForm, setShowDeletionForm] = useState(false);

  const handleRequestDeletion = async (e) => {
    e.preventDefault();
    setDeletionSubmitting(true);
    setDeletionError('');
    setDeletionMsg('');
    try {
      const res = await submitDeletionRequest(deletionReason);
      setDeletionMsg(res.message || 'Account deletion request submitted for compliance review.');
      setShowDeletionForm(false);
    } catch (err) {
      setDeletionError(err.response?.data?.message || err.message || 'Failed to submit deletion request.');
    } finally {
      setDeletionSubmitting(false);
    }
  };

  const handleAvatarFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input value so re-selecting same file triggers onChange
    e.target.value = '';

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setAvatarError('Please select a valid image file (JPEG, PNG, or WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setAvatarError('Profile image size must not exceed 5 MB.');
      return;
    }

    setAvatarUploading(true);
    setAvatarError('');
    try {
      await uploadAvatar(file);
      setProfileMsg('Profile picture updated successfully!');
      setTimeout(() => setProfileMsg(''), 4000);
    } catch (err) {
      setAvatarError(err.message || 'Failed to upload profile picture.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!window.confirm('Are you sure you want to remove your profile picture?')) return;
    setAvatarUploading(true);
    setAvatarError('');
    try {
      await removeAvatar();
      setProfileMsg('Profile picture removed successfully.');
      setTimeout(() => setProfileMsg(''), 4000);
    } catch (err) {
      setAvatarError(err.message || 'Failed to remove profile picture.');
    } finally {
      setAvatarUploading(false);
    }
  };

  // Orders State
  const [orders, setOrders] = useState([]);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersPagination, setOrdersPagination] = useState({
    currentPage: 1,
    pageSize: 6,
    totalOrders: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  });
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedOrderToCancel, setSelectedOrderToCancel] = useState(null);
  const [cancelReason, setCancelReason] = useState('Changed my mind');
  const [cancelling, setCancelling] = useState(false);

  // Address Modal State
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [addressForm, setAddressForm] = useState({
    label: 'Home',
    recipientName: '',
    phone: '',
    street: '',
    landmark: '',
    city: 'Indore',
    state: 'Madhya Pradesh',
    pincode: '452001',
    coordinates: null,
    formattedAddress: '',
    isDefault: false,
  });
  const [addressSubmitting, setAddressSubmitting] = useState(false);
  const [addressError, setAddressError] = useState('');

  const handleMapLocationSelected = (place) => {
    // Intelligently resolve the street/colony from reverse geocoded details
    const streetCandidate = [
      place.houseNumber,
      place.street || place.name,
    ].filter(Boolean).join(', ');

    let resolvedStreet = streetCandidate;
    if (!resolvedStreet) {
      if (place.locality) {
        resolvedStreet = place.locality;
      } else if (place.formattedAddress) {
        // Use first two segments (e.g. "Karondiya, Bhat khedi")
        const segments = place.formattedAddress.split(',');
        resolvedStreet = segments.slice(0, Math.min(2, segments.length)).join(', ').trim();
      }
    }

    const resolvedLandmark = place.sublocality || place.locality || place.district || '';

    setAddressForm((prev) => ({
      ...prev,
      street: resolvedStreet || place.formattedAddress || prev.street,
      landmark: resolvedLandmark || prev.landmark,
      city: place.city || 'Indore',
      state: place.state || 'Madhya Pradesh',
      pincode: place.pincode || prev.pincode,
      coordinates: place.coordinates || null,
      formattedAddress: place.formattedAddress || '',
      houseNumber: place.houseNumber || '',
      locality: place.locality || '',
    }));
  };

  // Sync profile form when user loads
  useEffect(() => {
    if (user) {
      setProfileName(user.name || '');
      setProfileEmail(user.email || '');
    }
  }, [user]);

  // Load customer orders with backend pagination (6 orders per page)
  const fetchOrders = async (targetPage = ordersPage) => {
    setOrdersLoading(true);
    try {
      const res = await apiClient.get('/v1/orders', {
        params: { page: targetPage, limit: 6 },
      });
      if (res.data?.success) {
        const orderList = res.data?.data?.orders || (Array.isArray(res.data?.data) ? res.data.data : []);
        const paginationMeta = res.data?.data?.pagination || {
          currentPage: res.data?.page || targetPage,
          pageSize: 6,
          totalOrders: res.data?.total ?? orderList.length,
          totalPages: res.data?.totalPages || 1,
          hasNextPage: targetPage < (res.data?.totalPages || 1),
          hasPreviousPage: targetPage > 1,
        };

        if (paginationMeta.totalPages > 0 && targetPage > paginationMeta.totalPages) {
          setOrdersPage(paginationMeta.totalPages);
          return;
        }

        setOrders(orderList);
        setOrdersPagination(paginationMeta);
      }
    } catch (err) {
      console.error('[account] Error fetching orders:', err.message);
    } finally {
      setOrdersLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchOrders(ordersPage);
    }
  }, [isAuthenticated, ordersPage]);

  if (authLoading) {
    return <SkeletonAccountPage />;
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen py-20 flex flex-col items-center justify-center text-center px-4 bg-primary-bg text-text-main">
        <div className="w-20 h-20 rounded-2xl bg-surface border border-border-neutral flex items-center justify-center text-brand mb-4 shadow-xs">
          <UserIcon className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-bold font-heading text-text-main">Sign In to View Your Account</h2>
        <p className="text-xs text-text-muted max-w-sm mt-1 mb-6">
          Track your active grocery deliveries in Indore, manage saved addresses, and view order receipts.
        </p>
        <button
          onClick={onOpenAuth}
          className="px-6 py-3 bg-brand hover:bg-brand-hover text-white font-bold text-xs rounded-xl shadow-xs transition"
        >
          Sign In with Mobile OTP
        </button>
      </div>
    );
  }

  // Handle Profile Update
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileUpdating(true);
    setProfileMsg('');
    setProfileError('');
    try {
      await updateProfile({ name: profileName, email: profileEmail });
      setProfileMsg('Profile updated successfully!');
    } catch (err) {
      setProfileError(err.message || 'Failed to update profile.');
    } finally {
      setProfileUpdating(false);
    }
  };

  // Open Address Modal for New
  const handleOpenAddAddress = () => {
    setEditingAddressId(null);
    setAddressForm({
      label: 'Home',
      recipientName: user?.name || '',
      phone: user?.phone?.replace(/^\+91/, '') || '',
      street: '',
      landmark: '',
      city: 'Indore',
      state: 'Madhya Pradesh',
      pincode: '452001',
      isDefault: user?.addresses?.length === 0,
    });
    setAddressError('');
    setAddressModalOpen(true);
  };

  // Open Address Modal for Edit
  const handleOpenEditAddress = (addr) => {
    setEditingAddressId(addr._id);
    setAddressForm({
      label: addr.label || 'Home',
      recipientName: addr.recipientName || '',
      phone: addr.phone || '',
      street: addr.street || '',
      landmark: addr.landmark || '',
      city: addr.city || 'Indore',
      state: addr.state || 'Madhya Pradesh',
      pincode: addr.pincode || '452001',
      coordinates: addr.coordinates || null,
      formattedAddress: addr.formattedAddress || '',
      isDefault: addr.isDefault || false,
    });
    setAddressError('');
    setAddressModalOpen(true);
  };

  // Save Address (Create or Update)
  const handleAddressSubmit = async (e) => {
    e.preventDefault();

    if (!addressForm.street || addressForm.street.trim().length < 3) {
      setAddressError('Please provide a valid street address or select your location on the map.');
      return;
    }

    setAddressSubmitting(true);
    setAddressError('');
    try {
      const payload = {
        label: addressForm.label || 'Home',
        recipientName: addressForm.recipientName.trim(),
        phone: addressForm.phone.trim(),
        street: addressForm.street.trim(),
        landmark: addressForm.landmark?.trim() || '',
        city: addressForm.city?.trim() || 'Indore',
        state: addressForm.state?.trim() || 'Madhya Pradesh',
        pincode: addressForm.pincode.trim(),
        isDefault: Boolean(addressForm.isDefault),
      };

      if (addressForm.coordinates && typeof addressForm.coordinates.lat === 'number') {
        payload.coordinates = {
          lat: addressForm.coordinates.lat,
          lng: addressForm.coordinates.lng,
        };
      }
      if (addressForm.formattedAddress) {
        payload.formattedAddress = addressForm.formattedAddress.trim();
      }
      if (addressForm.houseNumber) {
        payload.houseNumber = addressForm.houseNumber.trim();
      }
      if (addressForm.locality) {
        payload.locality = addressForm.locality.trim();
      }

      if (editingAddressId) {
        await updateAddress(editingAddressId, payload);
      } else {
        await addAddress(payload);
      }
      setAddressModalOpen(false);
    } catch (err) {
      const errMsg =
        err.response?.data?.message ||
        (Array.isArray(err.response?.data?.errors)
          ? err.response.data.errors.map((e) => e.message).join(', ')
          : '') ||
        err.message ||
        'Failed to save address.';
      setAddressError(errMsg);
    } finally {
      setAddressSubmitting(false);
    }
  };

  // Handle Order Cancel
  const handleCancelOrder = async () => {
    if (!selectedOrderToCancel) return;
    setCancelling(true);
    try {
      await apiClient.post(`/v1/orders/${selectedOrderToCancel._id}/cancel`, {
        reason: cancelReason,
      });
      setCancelModalOpen(false);
      await fetchOrders(ordersPage);
    } catch (err) {
      alert(err.message || 'Unable to cancel order.');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="min-h-screen py-8 sm:py-10 bg-primary-bg text-text-main">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Back to Home / Store Navigation */}
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface hover:bg-surface-subtle text-text-muted hover:text-brand border border-border-neutral hover:border-brand/30 text-xs font-semibold transition group shadow-xs"
          >
            <ArrowLeft className="w-4 h-4 text-brand transition-transform group-hover:-translate-x-1" />
            <span>Back to Home / Shopping</span>
          </Link>
        </div>

        {/* User Summary Header */}
        <div className="bg-surface border border-border-neutral rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            {/* Avatar container with live photo preview & camera upload button */}
            <div className="relative group w-20 h-20 sm:w-22 sm:h-22 shrink-0">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleAvatarFileChange}
              />

              <div className="w-full h-full rounded-2xl overflow-hidden bg-brand/10 border-2 border-brand/20 shadow-xs flex items-center justify-center relative">
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user?.name || 'Customer'}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-brand to-brand-hover text-white font-extrabold text-2xl sm:text-3xl flex items-center justify-center">
                    {user?.name?.[0]?.toUpperCase() || 'U'}
                  </div>
                )}

                {/* Upload Spinner Overlay */}
                {avatarUploading && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center text-white z-10">
                    <RefreshCw className="w-5 h-5 animate-spin text-white mb-1" />
                    <span className="text-[9px] font-bold">Uploading...</span>
                  </div>
                )}

                {/* Desktop Hover Overlay */}
                {!avatarUploading && (
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="absolute inset-0 bg-black/45 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white cursor-pointer z-10"
                    title="Change Profile Picture"
                  >
                    <Camera className="w-5 h-5 mb-0.5 text-white" />
                    <span className="text-[10px] font-bold">Change</span>
                  </button>
                )}
              </div>

              {/* Mobile / Quick Camera Badge */}
              {!avatarUploading && (
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-brand hover:bg-brand-hover text-white shadow-md border-2 border-surface flex items-center justify-center transition cursor-pointer hover:scale-105 active:scale-95 z-20"
                  title="Upload profile photo"
                  aria-label="Upload profile photo"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Profile Info & Actions */}
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold font-heading text-text-main">{user?.name}</h1>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-brand-light text-brand border border-brand/20">
                  Verified Customer
                </span>
              </div>
              <p className="text-xs text-text-muted font-mono">{user?.phone}</p>
              {user?.email && <p className="text-xs text-text-muted">{user.email}</p>}

              {/* Avatar quick buttons */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={avatarUploading}
                  className="text-[11px] font-semibold text-brand hover:underline inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <Camera className="w-3.5 h-3.5" />
                  {user?.avatar ? 'Change photo' : 'Upload photo'}
                </button>
                {user?.avatar && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    disabled={avatarUploading}
                    className="text-[11px] font-semibold text-text-muted hover:text-status-error transition inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-3 h-3" />
                    Remove photo
                  </button>
                )}
              </div>

              {avatarError && (
                <p className="text-[11px] text-status-error font-medium pt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {avatarError}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={() => {
              logout();
              navigate('/');
            }}
            className="px-4 py-2 rounded-xl bg-surface hover:bg-surface-subtle text-status-error border border-border-neutral hover:border-status-error/30 text-xs font-semibold flex items-center gap-2 transition shadow-xs cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-border-neutral gap-2 sm:gap-6 overflow-x-auto text-xs font-bold">
          <button
            onClick={() => setActiveTab('orders')}
            className={`pb-3 px-2 flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
              activeTab === 'orders'
                ? 'border-brand text-brand'
                : 'border-transparent text-text-muted hover:text-text-main'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>My Orders ({orders.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('addresses')}
            className={`pb-3 px-2 flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
              activeTab === 'addresses'
                ? 'border-brand text-brand'
                : 'border-transparent text-text-muted hover:text-text-main'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Saved Addresses ({user?.addresses?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`pb-3 px-2 flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
              activeTab === 'profile'
                ? 'border-brand text-brand'
                : 'border-transparent text-text-muted hover:text-text-main'
            }`}
          >
            <UserIcon className="w-4 h-4" />
            <span>Profile Details</span>
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`pb-3 px-2 flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
              activeTab === 'security'
                ? 'border-brand text-brand'
                : 'border-transparent text-text-muted hover:text-text-main'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Account Security</span>
          </button>

          <button
            onClick={() => setActiveTab('support')}
            className={`pb-3 px-2 flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
              activeTab === 'support'
                ? 'border-brand text-brand'
                : 'border-transparent text-text-muted hover:text-text-main'
            }`}
          >
            <Headphones className="w-4 h-4" />
            <span>Help & Support</span>
          </button>

          <button
            onClick={() => setActiveTab('notifications')}
            className={`pb-3 px-2 flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
              activeTab === 'notifications'
                ? 'border-brand text-brand'
                : 'border-transparent text-text-muted hover:text-text-main'
            }`}
          >
            <Bell className="w-4 h-4" />
            <span>Notifications</span>
            {notifUnreadCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-status-error text-[10px] font-bold text-white leading-none">
                {notifUnreadCount}
              </span>
            )}
          </button>
        </div>

        {/* ── Tab 1: Orders ──────────────────────────────────────────────── */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            {ordersLoading ? (
              <SkeletonOrderList count={3} />
            ) : orders.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-surface border border-border-neutral space-y-3 shadow-xs">
                <Package className="w-12 h-12 text-text-muted mx-auto" />
                <h3 className="text-base font-bold text-text-main">No orders yet</h3>
                <p className="text-xs text-text-muted max-w-sm mx-auto">
                  You haven't placed any grocery orders yet. Discover our fresh, stone-ground flours, pulses, and spices.
                </p>
                <Link
                  to="/"
                  className="mt-2 inline-block px-5 py-2.5 bg-brand hover:bg-brand-hover text-white font-bold text-xs rounded-xl transition shadow-xs"
                >
                  Start Shopping
                </Link>
              </div>
            ) : (
              orders.map((order) => {
                const isCancellable = order.orderStatus === 'PLACED' || order.orderStatus === 'CONFIRMED';
                const totalRupees = (order.pricing?.grandTotalPaise / 100).toFixed(0);

                return (
                  <div
                    key={order._id}
                    className="bg-surface border border-border-neutral rounded-2xl p-5 sm:p-6 space-y-4 hover:border-brand/40 transition shadow-xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border-neutral pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-text-main">
                            #{order.orderNumber}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                              order.orderStatus === 'DELIVERED'
                                ? 'bg-status-success/10 text-status-success border border-status-success/20'
                                : order.orderStatus === 'CANCELLED'
                                ? 'bg-status-error/10 text-status-error border border-status-error/20'
                                : 'bg-brand-light text-brand border border-brand/20'
                            }`}
                          >
                            {order.orderStatus}
                          </span>
                        </div>
                        <p className="text-[11px] text-text-muted mt-0.5">
                          Placed on {new Date(order.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                        </p>
                      </div>

                      <div className="text-left sm:text-right">
                        <span className="text-base font-extrabold text-brand font-mono">₹{totalRupees}</span>
                        <div className="flex items-center gap-1.5 text-[11px] text-text-muted sm:justify-end">
                          {order.payment?.method === 'COD' ? <Banknote className="w-3.5 h-3.5 text-brand" /> : <CreditCard className="w-3.5 h-3.5 text-brand" />}
                          <span>{order.payment?.method} ({order.payment?.status})</span>
                        </div>
                      </div>
                    </div>

                    {/* Items List */}
                    <div className="space-y-2">
                      {order.items?.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs py-1">
                          <div className="flex items-center gap-2 truncate max-w-md">
                            <span className="w-5 h-5 rounded-md bg-surface-subtle border border-border-neutral flex items-center justify-center font-bold text-[10px] text-brand shrink-0">
                              {item.quantity}×
                            </span>
                            <span className="text-text-main truncate">{item.productName}</span>
                            <span className="text-text-muted font-mono">({item.variantLabel})</span>
                          </div>
                          <span className="text-text-main font-semibold shrink-0 font-mono">
                            ₹{(item.subtotalPaise / 100).toFixed(0)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Delivery & Timeline Footer */}
                    <div className="pt-3 border-t border-border-neutral flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-text-muted">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-brand shrink-0" />
                        <span className="truncate max-w-xs">{order.deliveryAddress?.street}, Indore ({order.deliveryAddress?.pincode})</span>
                      </div>

                      {isCancellable && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedOrderToCancel(order);
                            setCancelModalOpen(true);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-status-error/10 hover:bg-status-error/20 text-status-error border border-status-error/20 font-bold transition self-start sm:self-auto"
                        >
                          Cancel Order
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {orders.length > 0 && ordersPagination.totalOrders > 0 && (
              <div className="bg-surface border border-border-neutral rounded-2xl p-4 shadow-xs">
                <Pagination
                  currentPage={ordersPage}
                  totalPages={ordersPagination.totalPages}
                  totalOrders={ordersPagination.totalOrders}
                  pageSize={6}
                  onPageChange={(newPage) => setOrdersPage(newPage)}
                  loading={ordersLoading}
                  itemName="orders"
                />
              </div>
            )}
          </div>
        )}

        {/* ── Tab 2: Saved Addresses ──────────────────────────────────────── */}
        {activeTab === 'addresses' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold font-heading text-text-main">Delivery Addresses</h2>
                <p className="text-xs text-text-muted">Manage saved addresses for express delivery in Indore.</p>
              </div>
              <button
                type="button"
                onClick={handleOpenAddAddress}
                className="px-4 py-2 bg-brand hover:bg-brand-hover text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Add New Address</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {user?.addresses?.map((addr) => (
                <div
                  key={addr._id}
                  className={`bg-surface border rounded-2xl p-5 space-y-3 relative transition shadow-xs ${
                    addr.isDefault ? 'border-brand ring-1 ring-brand/30' : 'border-border-neutral'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-surface-subtle text-brand border border-border-neutral">
                        {addr.label === 'Work' ? <Building className="w-3.5 h-3.5" /> : <Home className="w-3.5 h-3.5" />}
                      </span>
                      <span className="font-bold text-sm text-text-main">{addr.label}</span>
                      {addr.isDefault && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-light text-brand border border-brand/20">
                          Default
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEditAddress(addr)}
                        className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-subtle transition text-xs font-semibold"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteAddress(addr._id)}
                        className="p-1.5 rounded-lg text-status-error hover:bg-status-error/10 transition"
                        aria-label="Delete Address"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="text-xs text-text-main space-y-1">
                    <p className="font-semibold text-text-main">{addr.recipientName}</p>
                    <p className="text-text-muted">{addr.street}</p>
                    {addr.landmark && <p className="text-text-muted">Landmark: {addr.landmark}</p>}
                    <p className="text-text-muted">{addr.city}, {addr.state} — <strong className="text-brand font-mono">{addr.pincode}</strong></p>
                    <p className="text-text-muted font-mono text-[11px] pt-1">Phone: +91 {addr.phone}</p>
                  </div>

                  {!addr.isDefault && (
                    <button
                      type="button"
                      onClick={() => setDefaultAddress(addr._id)}
                      className="text-xs font-bold text-brand hover:underline pt-1 block"
                    >
                      Set as Default Delivery Address
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Tab 3: Profile Form ─────────────────────────────────────────── */}
        {activeTab === 'profile' && (
          <div className="max-w-xl bg-surface border border-border-neutral rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs">
            <div>
              <h2 className="text-lg font-bold font-heading text-text-main">Personal Information</h2>
              <p className="text-xs text-text-muted">Update your customer profile details.</p>
            </div>

            {profileMsg && (
              <div className="p-3 bg-status-success/10 border border-status-success/20 rounded-xl flex items-center gap-2 text-xs text-status-success">
                <CheckCircle2 className="w-4 h-4 text-status-success shrink-0" />
                <span>{profileMsg}</span>
              </div>
            )}
            {profileError && (
              <div className="p-3 bg-status-error/10 border border-status-error/20 rounded-xl flex items-center gap-2 text-xs text-status-error">
                <AlertCircle className="w-4 h-4 text-status-error shrink-0" />
                <span>{profileError}</span>
              </div>
            )}

            {/* Profile Photo Section */}
            <div className="p-4 rounded-xl bg-surface-subtle border border-border-neutral flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-brand/10 border border-brand/20 relative shrink-0">
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user?.name || 'Customer'}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-brand text-white font-bold text-xl flex items-center justify-center">
                    {user?.name?.[0]?.toUpperCase() || 'U'}
                  </div>
                )}
                {avatarUploading && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <RefreshCw className="w-4 h-4 text-white animate-spin" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-text-main">Profile Photo</p>
                <p className="text-[11px] text-text-muted">JPG, PNG, or WebP. Max 5 MB.</p>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={avatarUploading}
                    className="px-3 py-1 bg-brand text-white text-[11px] font-bold rounded-lg hover:bg-brand-hover transition shadow-xs inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    {user?.avatar ? 'Change Photo' : 'Upload Photo'}
                  </button>
                  {user?.avatar && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      disabled={avatarUploading}
                      className="px-2.5 py-1 text-text-muted hover:text-status-error text-[11px] font-semibold rounded-lg hover:bg-surface transition inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="w-3 h-3" />
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>

            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-text-main">
                    Email Address
                  </label>
                  {user?.isEmailVerified ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3" />
                      Verified
                    </span>
                  ) : (
                    <Link
                      to={`/verify-email-pending?email=${encodeURIComponent(user?.email || '')}`}
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 hover:underline"
                    >
                      Verify Email &rarr;
                    </Link>
                  )}
                </div>
                <input
                  type="email"
                  disabled
                  value={user?.email || ''}
                  className="w-full px-4 py-2.5 bg-surface-subtle border border-border-neutral rounded-xl text-text-muted text-xs cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-main mb-1.5">
                  Contact Phone Number (For Deliveries)
                </label>
                <input
                  type="text"
                  disabled
                  value={user?.phone || 'Not linked'}
                  className="w-full px-4 py-2.5 bg-surface-subtle border border-border-neutral rounded-xl text-text-muted text-xs font-mono cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-main mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="Your full name"
                  required
                  className="w-full px-4 py-2.5 bg-surface border border-border-neutral rounded-xl text-text-main text-xs focus:outline-none focus:border-brand shadow-xs transition"
                />
              </div>

              <button
                type="submit"
                disabled={profileUpdating}
                className="w-full py-3 bg-brand hover:bg-brand-hover text-white font-bold text-xs rounded-xl transition disabled:opacity-50 shadow-xs cursor-pointer"
              >
                {profileUpdating ? 'Saving...' : 'Save Profile Changes'}
              </button>
            </form>

            {/* Customer Care, FAQs & Legal Policies Section */}
            <div className="pt-6 border-t border-border-neutral space-y-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">
                  Support & Store Policies
                </h3>
                <p className="text-[11px] text-text-muted">
                  Quick access to customer care, delivery guidelines, terms of service, and privacy standards.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* 1. Customer Support Card */}
                <button
                  type="button"
                  onClick={() => setActiveTab('support')}
                  className="p-3.5 rounded-xl bg-surface-subtle hover:bg-surface border border-border-neutral hover:border-brand/40 transition text-left group flex items-start gap-3 shadow-2xs cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-brand-light text-brand flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                    <Headphones className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-text-main group-hover:text-brand transition">Customer Support</span>
                      <ArrowRight className="w-3.5 h-3.5 text-text-muted group-hover:text-brand group-hover:translate-x-0.5 transition" />
                    </div>
                    <p className="text-[11px] text-text-muted mt-0.5 line-clamp-2">
                      Reach Indore dispatch or submit a support inquiry ticket.
                    </p>
                  </div>
                </button>

                {/* 2. FAQs Card */}
                <Link
                  to="/faq"
                  className="p-3.5 rounded-xl bg-surface-subtle hover:bg-surface border border-border-neutral hover:border-brand/40 transition text-left group flex items-start gap-3 shadow-2xs"
                >
                  <div className="w-8 h-8 rounded-lg bg-brand-light text-brand flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                    <HelpCircle className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-text-main group-hover:text-brand transition">Delivery FAQs</span>
                      <ArrowRight className="w-3.5 h-3.5 text-text-muted group-hover:text-brand group-hover:translate-x-0.5 transition" />
                    </div>
                    <p className="text-[11px] text-text-muted mt-0.5 line-clamp-2">
                      Frequently asked questions about zones, speed, and payments.
                    </p>
                  </div>
                </Link>

                {/* 3. Terms & Conditions Card */}
                <Link
                  to="/terms"
                  state={{ from: '/account?tab=profile', tab: 'profile', label: 'Back to Profile Details' }}
                  className="p-3.5 rounded-xl bg-surface-subtle hover:bg-surface border border-border-neutral hover:border-brand/40 transition text-left group flex items-start gap-3 shadow-2xs"
                >
                  <div className="w-8 h-8 rounded-lg bg-brand-light text-brand flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                    <Scale className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-text-main group-hover:text-brand transition">Terms & Conditions</span>
                      <ArrowRight className="w-3.5 h-3.5 text-text-muted group-hover:text-brand group-hover:translate-x-0.5 transition" />
                    </div>
                    <p className="text-[11px] text-text-muted mt-0.5 line-clamp-2">
                      Store terms, order acceptance, pricing, and return policies.
                    </p>
                  </div>
                </Link>

                {/* 4. Privacy Policy Card */}
                <Link
                  to="/privacy-policy"
                  state={{ from: '/account?tab=profile', tab: 'profile', label: 'Back to Profile Details' }}
                  className="p-3.5 rounded-xl bg-surface-subtle hover:bg-surface border border-border-neutral hover:border-brand/40 transition text-left group flex items-start gap-3 shadow-2xs"
                >
                  <div className="w-8 h-8 rounded-lg bg-brand-light text-brand flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-text-main group-hover:text-brand transition">Privacy Policy</span>
                      <ArrowRight className="w-3.5 h-3.5 text-text-muted group-hover:text-brand group-hover:translate-x-0.5 transition" />
                    </div>
                    <p className="text-[11px] text-text-muted mt-0.5 line-clamp-2">
                      How your phone number, delivery addresses, and data are protected.
                    </p>
                  </div>
                </Link>
              </div>
            </div>

            {/* Account Closure & Data Deletion */}
            <div className="pt-5 border-t border-border-neutral space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="font-bold font-heading text-status-error text-xs">Account Closure & Data Deletion</h4>
                  <p className="text-text-muted text-[11px]">
                    In compliance with statutory privacy regulations, you may request permanent deletion of your account.
                  </p>
                </div>
                {!showDeletionForm && !user?.deletionRequest?.requested && (
                  <button
                    type="button"
                    onClick={() => setShowDeletionForm(true)}
                    className="px-3.5 py-1.5 bg-status-error/10 hover:bg-status-error/20 text-status-error border border-status-error/30 font-semibold text-xs rounded-xl transition cursor-pointer self-start sm:self-auto shrink-0"
                  >
                    Request Deletion
                  </button>
                )}
              </div>

              {deletionMsg && (
                <div className="p-3 bg-status-success/10 border border-status-success/20 rounded-xl text-status-success text-xs">
                  {deletionMsg}
                </div>
              )}

              {deletionError && (
                <div className="p-3 bg-status-error/10 border border-status-error/20 rounded-xl text-status-error text-xs">
                  {deletionError}
                </div>
              )}

              {user?.deletionRequest?.requested ? (
                <div className="p-3 bg-surface-subtle border border-border-neutral rounded-xl space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Request Status:</span>
                    <span
                      className={`font-bold uppercase tracking-wider px-2 py-0.5 rounded text-[10px] ${
                        user.deletionRequest.status === 'APPROVED'
                          ? 'bg-status-success/10 text-status-success border border-status-success/20'
                          : user.deletionRequest.status === 'REJECTED'
                          ? 'bg-status-error/10 text-status-error border border-status-error/20'
                          : 'bg-brand-light text-brand border border-brand/20'
                      }`}
                    >
                      {user.deletionRequest.status === 'PENDING'
                        ? 'Pending Compliance Review'
                        : user.deletionRequest.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-text-muted">
                    <span>Submitted On:</span>
                    <span>
                      {user.deletionRequest.requestedAt
                        ? new Date(user.deletionRequest.requestedAt).toLocaleDateString()
                        : 'Recently'}
                    </span>
                  </div>
                  {user.deletionRequest.reason && (
                    <p className="text-text-muted italic pt-1">
                      Reason: "{user.deletionRequest.reason}"
                    </p>
                  )}
                  {user.deletionRequest.adminNotes && (
                    <p className="text-brand pt-1 font-medium">
                      Compliance Note: {user.deletionRequest.adminNotes}
                    </p>
                  )}
                </div>
              ) : showDeletionForm ? (
                <form onSubmit={handleRequestDeletion} className="space-y-3 pt-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-text-main mb-1">
                      Reason for deletion (optional)
                    </label>
                    <textarea
                      value={deletionReason}
                      onChange={(e) => setDeletionReason(e.target.value)}
                      placeholder="Please let us know how we can improve our grocery service..."
                      rows={3}
                      className="w-full px-3 py-2 bg-surface border border-border-neutral rounded-xl text-xs text-text-main focus:outline-none focus:border-brand shadow-xs"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={deletionSubmitting}
                      className="px-4 py-2 bg-status-error text-white font-bold text-xs rounded-xl shadow-xs transition hover:bg-status-error/90 disabled:opacity-50 cursor-pointer"
                    >
                      {deletionSubmitting ? 'Submitting...' : 'Confirm Deletion Request'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDeletionForm(false)}
                      className="px-4 py-2 bg-surface hover:bg-surface-subtle border border-border-neutral text-text-main font-semibold text-xs rounded-xl transition cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : null}
            </div>
          </div>
        )}

        {/* ── Tab: Account Security & Credentials ──────────────────────────── */}
        {activeTab === 'security' && (
          <div className="max-w-xl space-y-6">
            <div className="bg-surface border border-border-neutral rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs">
              <div>
                <h2 className="text-lg font-bold font-heading text-text-main">Account Security</h2>
                <p className="text-xs text-text-muted">Change your account password and manage active device sessions.</p>
              </div>

              {passSuccess && (
                <div className="p-3.5 bg-status-success/10 border border-status-success/20 rounded-xl flex items-center gap-2.5 text-xs text-status-success">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{passSuccess}</span>
                </div>
              )}

              {passError && (
                <div className="p-3.5 bg-status-error/10 border border-status-error/20 rounded-xl flex items-center gap-2.5 text-xs text-status-error">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{passError}</span>
                </div>
              )}

              {/* Change Password Form */}
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1.5">
                    Current Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-text-muted absolute left-3.5 top-3.5" />
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••••••"
                      required
                      className="w-full pl-10 pr-10 py-2.5 text-xs bg-surface-subtle border border-border-neutral rounded-xl text-text-main focus:outline-none focus:border-brand"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3.5 top-3 text-text-muted hover:text-text-main"
                    >
                      {showCurrentPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-text-muted absolute left-3.5 top-3.5" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••••••"
                      required
                      minLength={12}
                      className="w-full pl-10 pr-10 py-2.5 text-xs bg-surface-subtle border border-border-neutral rounded-xl text-text-main focus:outline-none focus:border-brand"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3.5 top-3 text-text-muted hover:text-text-main"
                    >
                      {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-text-muted mt-1">
                    Must be at least 12 characters and include uppercase, lowercase, number, and special character.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1.5">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-text-muted absolute left-3.5 top-3.5" />
                    <input
                      type={showConfirmNewPassword ? 'text' : 'password'}
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="••••••••••••"
                      required
                      className="w-full pl-10 pr-10 py-2.5 text-xs bg-surface-subtle border border-border-neutral rounded-xl text-text-main focus:outline-none focus:border-brand"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                      className="absolute right-3.5 top-3 text-text-muted hover:text-text-main"
                    >
                      {showConfirmNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={passLoading || !currentPassword || !newPassword || !confirmNewPassword}
                  className="w-full py-2.5 px-4 bg-brand hover:bg-brand-hover text-white font-semibold text-xs rounded-xl shadow-xs transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-2"
                >
                  {passLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Updating Password...</span>
                    </>
                  ) : (
                    <span>Update Password</span>
                  )}
                </button>
              </form>

              {/* Session Management */}
              <div className="pt-6 border-t border-border-neutral space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-xs text-text-main">Session Management</h4>
                    <p className="text-[11px] text-text-muted mt-0.5">
                      Sign out of Khushboo Food Service across all browsers, phones, and computers.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogoutAll}
                    disabled={logoutAllLoading}
                    className="px-3.5 py-2 bg-surface hover:bg-surface-subtle border border-border-neutral text-status-error font-semibold text-xs rounded-xl transition shadow-2xs cursor-pointer self-start sm:self-auto shrink-0 flex items-center gap-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>{logoutAllLoading ? 'Revoking...' : 'Sign Out Everywhere'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'support' && (
          <div className="space-y-6">
            {/* Verified Contact Channels Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Helpline */}
              <div className="p-4 rounded-2xl bg-surface border border-border-neutral shadow-xs space-y-2">
                <div className="w-9 h-9 rounded-xl bg-brand-light text-brand flex items-center justify-center">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider block">Customer Helpline</span>
                  <a
                    href="tel:+919826012345"
                    className="text-xs font-bold text-brand hover:underline font-mono"
                  >
                    +91 98260 12345
                  </a>
                </div>
                <p className="text-[11px] text-text-muted">Direct phone assistance for active deliveries across Indore.</p>
              </div>

              {/* Email */}
              <div className="p-4 rounded-2xl bg-surface border border-border-neutral shadow-xs space-y-2">
                <div className="w-9 h-9 rounded-xl bg-brand-light text-brand flex items-center justify-center">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider block">Email Support</span>
                  <a
                    href="mailto:support@khushboofood.com"
                    className="text-xs font-bold text-brand hover:underline truncate block"
                  >
                    support@khushboofood.com
                  </a>
                </div>
                <p className="text-[11px] text-text-muted">Inquiries, invoice requests, and general questions.</p>
              </div>

              {/* Operating Hours */}
              <div className="p-4 rounded-2xl bg-surface border border-border-neutral shadow-xs space-y-2">
                <div className="w-9 h-9 rounded-xl bg-brand-light text-brand flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider block">Operating Hours</span>
                  <span className="text-xs font-bold text-text-main">7:00 AM – 10:00 PM</span>
                </div>
                <p className="text-[11px] text-text-muted">Active 7 days a week including Sundays & festivals.</p>
              </div>

              {/* Rapid Resolution Guarantee */}
              <div className="p-4 rounded-2xl bg-surface border border-border-neutral shadow-xs space-y-2">
                <div className="w-9 h-9 rounded-xl bg-brand-light text-brand flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider block">Dispatch Guarantee</span>
                  <span className="text-xs font-bold text-text-main">15-Minute Priority</span>
                </div>
                <p className="text-[11px] text-text-muted">Fast resolution for live grocery orders and deliveries.</p>
              </div>
            </div>

            {/* Support Ticket Submission Form & FAQ Links */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Inquiry Form */}
              <div className="lg:col-span-7 bg-surface border border-border-neutral rounded-2xl p-6 sm:p-8 shadow-xs space-y-5">
                <div>
                  <h3 className="text-base font-bold font-heading text-text-main">Submit a Support Ticket</h3>
                  <p className="text-xs text-text-muted mt-0.5">
                    Report an issue with an order, quality concern, or ask a question.
                  </p>
                </div>

                {supportSuccess && (
                  <div className="p-3.5 bg-status-success/10 border border-status-success/20 rounded-xl flex items-center gap-2 text-xs text-status-success">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{supportSuccess}</span>
                  </div>
                )}

                {supportError && (
                  <div className="p-3.5 bg-status-error/10 border border-status-error/20 rounded-xl flex items-center gap-2 text-xs text-status-error">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{supportError}</span>
                  </div>
                )}

                <form onSubmit={handleSupportSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-text-main mb-1">Your Name</label>
                      <input
                        type="text"
                        disabled
                        value={user?.name || ''}
                        className="w-full px-3.5 py-2 bg-surface-subtle border border-border-neutral rounded-xl text-xs text-text-muted cursor-not-allowed"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-text-main mb-1">Contact Phone</label>
                      <input
                        type="text"
                        disabled
                        value={user?.phone || ''}
                        className="w-full px-3.5 py-2 bg-surface-subtle border border-border-neutral rounded-xl text-xs font-mono text-text-muted cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-text-main mb-1">
                      Related Order <span className="text-text-muted">(Optional)</span>
                    </label>
                    <select
                      value={supportForm.orderNumber}
                      onChange={(e) => setSupportForm({ ...supportForm, orderNumber: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-surface border border-border-neutral rounded-xl text-xs text-text-main focus:outline-none focus:border-brand shadow-xs"
                    >
                      <option value="">None / General Inquiry</option>
                      {orders.map((ord) => (
                        <option key={ord._id} value={ord.orderNumber}>
                          {ord.orderNumber} — ₹{(ord.pricing?.grandTotalPaise / 100).toFixed(0)} ({ord.orderStatus})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-text-main mb-1">Subject *</label>
                    <input
                      type="text"
                      required
                      value={supportForm.subject}
                      onChange={(e) => setSupportForm({ ...supportForm, subject: e.target.value })}
                      placeholder="e.g. Delivery ETA inquiry, Damaged item packaging"
                      className="w-full px-3.5 py-2.5 bg-surface border border-border-neutral rounded-xl text-xs text-text-main placeholder:text-text-muted focus:outline-none focus:border-brand shadow-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-text-main mb-1">Detailed Message *</label>
                    <textarea
                      required
                      rows={4}
                      value={supportForm.message}
                      onChange={(e) => setSupportForm({ ...supportForm, message: e.target.value })}
                      placeholder="Describe what you need help with. Please include any specific details..."
                      className="w-full px-3.5 py-2.5 bg-surface border border-border-neutral rounded-xl text-xs text-text-main placeholder:text-text-muted focus:outline-none focus:border-brand shadow-xs"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={supportSubmitting}
                    className="w-full sm:w-auto px-6 py-2.5 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-xl transition shadow-xs inline-flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {supportSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>{supportSubmitting ? 'Submitting Inquiry...' : 'Submit Support Ticket'}</span>
                  </button>
                </form>
              </div>

              {/* Helpful Links & Legal Reference Cards */}
              <div className="lg:col-span-5 space-y-4">
                {/* FAQs Callout */}
                <div className="p-5 bg-surface border border-border-neutral rounded-2xl shadow-xs space-y-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-brand-light text-brand flex items-center justify-center shrink-0">
                      <HelpCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-text-main">Looking for Quick Answers?</h4>
                      <p className="text-[11px] text-text-muted">Browse our comprehensive grocery delivery FAQs.</p>
                    </div>
                  </div>
                  <p className="text-xs text-text-muted leading-relaxed">
                    Check answers on delivery coverage across Indore, minimum orders, stone-ground flour freshness, and payment options.
                  </p>
                  <Link
                    to="/faq"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-brand hover:underline"
                  >
                    <span>Visit Help & FAQ Center</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                {/* Legal Policies Cards */}
                <div className="p-5 bg-surface border border-border-neutral rounded-2xl shadow-xs space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted">
                    Store Policies & Legal
                  </h4>

                  <div className="space-y-2">
                    <Link
                      to="/terms"
                      state={{ from: '/account?tab=support', tab: 'support', label: 'Back to Account Support' }}
                      className="p-3 rounded-xl bg-surface-subtle hover:bg-surface border border-border-neutral hover:border-brand/40 transition flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Scale className="w-4 h-4 text-brand shrink-0" />
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-text-main group-hover:text-brand block truncate transition">
                            Terms & Conditions
                          </span>
                          <span className="text-[10px] text-text-muted block truncate">
                            Order acceptance, pricing, delivery, and refund policy
                          </span>
                        </div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-text-muted group-hover:text-brand shrink-0 ml-2 group-hover:translate-x-0.5 transition" />
                    </Link>

                    <Link
                      to="/privacy-policy"
                      state={{ from: '/account?tab=support', tab: 'support', label: 'Back to Account Support' }}
                      className="p-3 rounded-xl bg-surface-subtle hover:bg-surface border border-border-neutral hover:border-brand/40 transition flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <ShieldCheck className="w-4 h-4 text-brand shrink-0" />
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-text-main group-hover:text-brand block truncate transition">
                            Privacy Policy
                          </span>
                          <span className="text-[10px] text-text-muted block truncate">
                            Data protection, encryption, and statutory compliance
                          </span>
                        </div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-text-muted group-hover:text-brand shrink-0 ml-2 group-hover:translate-x-0.5 transition" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab 5: Real-Time Notifications ───────────────────────────────── */}
        {activeTab === 'notifications' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-surface border border-border-neutral shadow-xs">
              <div>
                <h3 className="font-heading font-bold text-base text-text-main flex items-center gap-2">
                  <span>Notifications & Alerts</span>
                  {notifUnreadCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-status-error text-white text-[11px] font-bold">
                      {notifUnreadCount} unread
                    </span>
                  )}
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Real-time updates about your grocery orders, doorstep deliveries, and support inquiries.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {notifUnreadCount > 0 && (
                  <button
                    type="button"
                    onClick={notifMarkAllAsRead}
                    className="px-3 py-1.5 rounded-xl bg-brand-light text-brand hover:bg-brand-light/80 text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Mark All Read</span>
                  </button>
                )}
                {notifications.some((n) => n.isRead) && (
                  <button
                    type="button"
                    onClick={notifClearAllRead}
                    className="px-3 py-1.5 rounded-xl bg-surface hover:bg-surface-subtle border border-border-neutral text-xs font-semibold text-text-muted hover:text-status-error transition shadow-xs"
                  >
                    Clear Read
                  </button>
                )}
              </div>
            </div>

            {notifLoading && notifications.length === 0 ? (
              <div className="space-y-2.5" aria-busy="true" aria-label="Loading notifications">
                {[1, 2, 3, 4].map((idx) => (
                  <div key={idx} className="p-4 rounded-2xl border border-border-neutral bg-surface flex items-start gap-3 shadow-xs">
                    <SkeletonBase className="w-9 h-9 rounded-xl shrink-0" />
                    <div className="flex-1 space-y-2">
                      <SkeletonText width="40%" height="h-3.5" />
                      <SkeletonText width="80%" height="h-3" />
                      <SkeletonText width="25%" height="h-2.5" />
                    </div>
                  </div>
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-surface border border-border-neutral space-y-3 shadow-xs">
                <Bell className="w-12 h-12 text-text-muted mx-auto opacity-40" />
                <h4 className="text-base font-bold text-text-main">No notifications yet</h4>
                <p className="text-xs text-text-muted max-w-sm mx-auto">
                  When you place orders, receive support replies, or when offers are published, updates will appear here in real time.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {notifications.map((n) => {
                  const isUnread = !n.isRead;
                  return (
                    <div
                      key={n._id}
                      onClick={() => {
                        if (isUnread) notifMarkAsRead(n._id);
                        if (n.targetUrl) navigate(n.targetUrl);
                      }}
                      className={`p-4 rounded-2xl border transition flex items-start justify-between gap-3 cursor-pointer shadow-xs ${
                        isUnread
                          ? 'bg-surface border-brand/40 ring-1 ring-brand/10'
                          : 'bg-surface/80 border-border-neutral hover:bg-surface'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                            n.category === 'ORDER'
                              ? 'bg-emerald-500/10 text-emerald-600'
                              : n.category === 'PAYMENT'
                              ? 'bg-blue-500/10 text-blue-600'
                              : n.category === 'SUPPORT'
                              ? 'bg-indigo-500/10 text-indigo-600'
                              : 'bg-brand-light text-brand'
                          }`}
                        >
                          {n.category === 'ORDER' ? (
                            <Package className="w-4 h-4" />
                          ) : n.category === 'PAYMENT' ? (
                            <CreditCard className="w-4 h-4" />
                          ) : n.category === 'SUPPORT' ? (
                            <Headphones className="w-4 h-4" />
                          ) : (
                            <Bell className="w-4 h-4" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-bold text-xs text-text-main">{n.title}</span>
                            {isUnread && (
                              <span className="w-2 h-2 rounded-full bg-brand shrink-0" />
                            )}
                            <span className="text-[10px] text-text-muted font-mono ml-auto">
                              {new Date(n.createdAt).toLocaleString('en-IN', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>

                          <p className="text-xs text-text-muted leading-relaxed">{n.message}</p>

                          {n.targetUrl && (
                            <div className="mt-2 flex items-center gap-1 text-xs text-brand font-semibold hover:underline">
                              <span>Open Record</span>
                              <ExternalLink className="w-3 h-3" />
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {isUnread && (
                          <button
                            type="button"
                            onClick={() => notifMarkAsRead(n._id)}
                            className="p-1.5 rounded-lg text-text-muted hover:text-brand hover:bg-brand-light transition"
                            title="Mark as read"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => notifDelete(n._id)}
                          className="p-1.5 rounded-lg text-text-muted hover:text-status-error hover:bg-status-error/10 transition"
                          title="Delete notification"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Address Modal ─────────────────────────────────────────────────── */}
      {addressModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn">
          <div className="relative w-full max-w-md bg-surface border border-border-neutral rounded-2xl shadow-xl p-6 text-text-main">
            <button
              onClick={() => setAddressModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-full text-text-muted hover:text-text-main hover:bg-surface-subtle transition"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold font-heading text-text-main mb-1">
              {editingAddressId ? 'Edit Address' : 'Add Delivery Address'}
            </h3>
            <p className="text-xs text-text-muted mb-4">Central Indore delivery service zone (15 km max).</p>

            {addressError && (
              <div className="mb-4 p-3 bg-status-error/10 border border-status-error/20 rounded-xl text-xs text-status-error">
                {addressError}
              </div>
            )}

            <form onSubmit={handleAddressSubmit} className="space-y-3.5 text-xs">
              <div className="flex gap-2">
                {['Home', 'Work', 'Other'].map((lbl) => (
                  <button
                    key={lbl}
                    type="button"
                    onClick={() => setAddressForm((p) => ({ ...p, label: lbl }))}
                    className={`flex-1 py-1.5 rounded-lg border font-bold transition shadow-xs ${
                      addressForm.label === lbl
                        ? 'border-brand bg-brand-light text-brand'
                        : 'border-border-neutral bg-surface text-text-muted hover:text-text-main'
                    }`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>

              {/* Map Locate Button */}
              <button
                type="button"
                onClick={() => setMapPickerOpen(true)}
                className="w-full py-2 px-3 bg-brand-light/60 hover:bg-brand-light border border-brand/20 rounded-xl text-xs font-bold text-brand flex items-center justify-center gap-2 transition shadow-xs"
              >
                <MapPin className="w-4 h-4" />
                <span>Choose on Map / Pin Exact Colony</span>
              </button>

              {addressForm.coordinates && (
                <div className="p-2.5 bg-surface-subtle border border-border-neutral rounded-xl text-[11px] text-text-muted flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-brand shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <span className="font-bold text-text-main block">Map Coordinates Linked:</span>
                    <span className="font-mono text-[10px] block text-brand">
                      {addressForm.coordinates.lat?.toFixed(5)}, {addressForm.coordinates.lng?.toFixed(5)}
                    </span>
                    {addressForm.formattedAddress && (
                      <span className="text-[10px] line-clamp-1 text-text-muted mt-0.5">
                        {addressForm.formattedAddress}
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-text-main mb-1">Recipient Name</label>
                <input
                  type="text"
                  value={addressForm.recipientName}
                  onChange={(e) => setAddressForm((p) => ({ ...p, recipientName: e.target.value }))}
                  required
                  placeholder="e.g. Ramesh Sharma"
                  className="w-full px-3 py-2 bg-surface border border-border-neutral rounded-xl text-text-main focus:outline-none focus:border-brand shadow-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-text-main mb-1">Contact Phone</label>
                <input
                  type="tel"
                  value={addressForm.phone}
                  onChange={(e) => setAddressForm((p) => ({ ...p, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                  required
                  placeholder="98260 12345"
                  className="w-full px-3 py-2 bg-surface border border-border-neutral rounded-xl text-text-main focus:outline-none focus:border-brand shadow-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-text-main mb-1">Street Address / House No.</label>
                <input
                  type="text"
                  value={addressForm.street}
                  onChange={(e) => setAddressForm((p) => ({ ...p, street: e.target.value }))}
                  required
                  placeholder="Flat 201, Shanti Kunj, MG Road"
                  className="w-full px-3 py-2 bg-surface border border-border-neutral rounded-xl text-text-main focus:outline-none focus:border-brand shadow-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-text-main mb-1">Landmark (Optional)</label>
                <input
                  type="text"
                  value={addressForm.landmark}
                  onChange={(e) => setAddressForm((p) => ({ ...p, landmark: e.target.value }))}
                  placeholder="Near Geeta Bhawan Temple"
                  className="w-full px-3 py-2 bg-surface border border-border-neutral rounded-xl text-text-main focus:outline-none focus:border-brand shadow-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-text-main mb-1">City</label>
                  <input
                    type="text"
                    value={addressForm.city}
                    onChange={(e) => setAddressForm((p) => ({ ...p, city: e.target.value }))}
                    placeholder="Indore"
                    className="w-full px-3 py-2 bg-surface border border-border-neutral rounded-xl text-text-main focus:outline-none focus:border-brand shadow-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-text-main mb-1">PIN Code (Indore)</label>
                  <input
                    type="text"
                    value={addressForm.pincode}
                    onChange={(e) => setAddressForm((p) => ({ ...p, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                    required
                    maxLength={6}
                    placeholder="452001"
                    className="w-full px-3 py-2 bg-surface border border-border-neutral rounded-xl text-brand font-mono font-bold focus:outline-none focus:border-brand shadow-xs"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={addressForm.isDefault}
                  onChange={(e) => setAddressForm((p) => ({ ...p, isDefault: e.target.checked }))}
                  className="w-3.5 h-3.5 accent-brand rounded"
                />
                <span className="text-[11px] text-text-muted font-medium">Set as default delivery address</span>
              </label>

              <button
                type="submit"
                disabled={addressSubmitting}
                className="w-full py-2.5 bg-brand hover:bg-brand-hover text-white font-bold rounded-xl transition disabled:opacity-50 mt-2 shadow-xs"
              >
                {addressSubmitting ? 'Saving...' : 'Save Address'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Cancel Order Dialog ───────────────────────────────────────────── */}
      {cancelModalOpen && selectedOrderToCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-md bg-surface border border-border-neutral rounded-2xl p-6 text-text-main space-y-4 shadow-xl">
            <h3 className="text-lg font-bold font-heading text-text-main">Cancel Order #{selectedOrderToCancel.orderNumber}</h3>
            <p className="text-xs text-text-muted">
              Are you sure you want to cancel this order? All items will be released back to grocery stock.
            </p>

            <div>
              <label className="block text-xs font-semibold text-text-main mb-1">Reason for cancellation</label>
              <select
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-3 py-2 bg-surface border border-border-neutral rounded-xl text-xs text-text-main shadow-xs"
              >
                <option value="Changed my mind">Changed my mind</option>
                <option value="Ordered by mistake">Ordered by mistake</option>
                <option value="Need to change delivery address">Need to change delivery address</option>
                <option value="Delivery time too long">Delivery time too long</option>
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCancelModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-surface hover:bg-surface-subtle border border-border-neutral text-text-main font-bold text-xs transition shadow-xs"
              >
                Keep Order
              </button>
              <button
                type="button"
                onClick={handleCancelOrder}
                disabled={cancelling}
                className="flex-1 py-2.5 rounded-xl bg-status-error hover:bg-status-error/90 text-white font-bold text-xs transition disabled:opacity-50 shadow-xs"
              >
                {cancelling ? 'Cancelling...' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Map Location Picker Modal */}
      <LocationPickerModal
        isOpen={mapPickerOpen}
        onClose={() => setMapPickerOpen(false)}
        onLocationSelect={handleMapLocationSelected}
        initialCoordinates={addressForm.coordinates}
        title="Pin Delivery Location on Map"
      />
    </div>
  );
}
