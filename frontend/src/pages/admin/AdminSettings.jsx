/**
 * Admin Delivery & Storefront Configuration.
 *
 * Route: /admin/settings
 * Allows authorized administrators to manage store availability (open/close orders),
 * announcement banner, delivery fee thresholds, minimum order size, and contact details.
 *
 * @module pages/admin/AdminSettings
 */

import React, { useState, useEffect } from 'react';
import { apiClient } from '../../config/api.js';
import {
  Settings,
  Store,
  Truck,
  Phone,
  Mail,
  MapPin,
  Clock,
  IndianRupee,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  ShieldCheck,
  Compass,
  Volume2,
  VolumeX,
  CreditCard,
  Banknote,
  Play,
  Bell,
  BellOff,
  Send,
  Smartphone,
} from 'lucide-react';
import { LocationPickerModal } from '../../components/map/LocationPickerModal.jsx';
import { testNotificationSound } from '../../utils/soundManager.js';
import { useNotifications } from '../../context/NotificationContext.jsx';
import { SkeletonTitle, SkeletonText, SkeletonBase, SkeletonButton } from '../../components/skeleton/index.js';

export function AdminSettings() {
  const {
    pushSupported,
    isPushSubscribed,
    pushLoading,
    enablePush,
    disablePush,
    testPush,
    desktopPermission,
  } = useNotifications();

  const [pushStatusMsg, setPushStatusMsg] = useState('');
  const [pushErrorMsg, setPushErrorMsg] = useState('');
  const [testingPush, setTestingPush] = useState(false);

  const handleToggleAdminPush = async () => {
    setPushStatusMsg('');
    setPushErrorMsg('');
    try {
      if (isPushSubscribed) {
        await disablePush();
        setPushStatusMsg('Admin browser push alerts disabled on this device.');
      } else {
        await enablePush();
        setPushStatusMsg('Admin browser push alerts enabled! You will now receive new-order alerts even when your browser tab is closed.');
      }
    } catch (err) {
      setPushErrorMsg(err.message || 'Failed to update push settings.');
    }
  };

  const handleTestAdminPush = async () => {
    setPushStatusMsg('');
    setPushErrorMsg('');
    setTestingPush(true);
    try {
      const res = await testPush();
      setPushStatusMsg(res?.message || 'Admin test push notification sent successfully.');
    } catch (err) {
      setPushErrorMsg(err.message || 'Failed to dispatch test notification.');
    } finally {
      setTestingPush(false);
    }
  };

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingSound, setTestingSound] = useState(false);
  const [soundTestStatus, setSoundTestStatus] = useState('');
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [settings, setSettings] = useState({
    storeName: 'Khushboo Grocery Service',
    tagline: 'Indore’s Premier Fresh Grocery & Daily Essentials Store',
    contactPhone: '+91 98260 12345',
    contactEmail: 'support@khushboofood.com',
    address: '123 MG Road, Geeta Bhawan, Indore, Madhya Pradesh 452001',
    serviceCity: 'Indore',
    servicePincode: '452001',
    dispatchCoordinates: { lat: 22.7196, lng: 75.8577 },
    isOpen: true,
    announcementNotice: '',
    minOrderAmountRupees: 150,
    freeDeliveryThresholdRupees: 499,
    deliveryFeeBaseRupees: 25,
    maxDeliveryDistanceKm: 15,
    estimatedDeliveryWindow: '90 - 120 Minutes',
    soundEnabled: true,
    soundCooldownSeconds: 3,
    codEnabled: true,
    onlinePaymentEnabled: true,
  });

  const fetchSettings = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await apiClient.get('/v1/admin/settings');
      if (res.data?.success && res.data?.data) {
        const d = res.data.data;
        setSettings({
          storeName: d.storeName || 'Khushboo Grocery Service',
          tagline: d.tagline || '',
          contactPhone: d.contactPhone || '',
          contactEmail: d.contactEmail || '',
          address: d.address || '',
          serviceCity: d.serviceCity || 'Indore',
          servicePincode: d.servicePincode || '452001',
          dispatchCoordinates: d.dispatchCoordinates || { lat: 22.7196, lng: 75.8577 },
          isOpen: d.isOpen ?? true,
          announcementNotice: d.announcementNotice || '',
          minOrderAmountRupees: (d.minOrderAmountPaise || 15000) / 100,
          freeDeliveryThresholdRupees: (d.freeDeliveryThresholdPaise || 49900) / 100,
          deliveryFeeBaseRupees: (d.deliveryFeeBasePaise || 2500) / 100,
          maxDeliveryDistanceKm: d.maxDeliveryDistanceKm || 15,
          estimatedDeliveryWindow: d.estimatedDeliveryWindow || '90 - 120 Minutes',
          soundEnabled: d.notificationSettings?.soundEnabled ?? true,
          soundCooldownSeconds: d.notificationSettings?.soundCooldownSeconds ?? 3,
          codEnabled: d.paymentSettings?.codEnabled ?? true,
          onlinePaymentEnabled: d.paymentSettings?.onlinePaymentEnabled ?? true,
        });
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load store settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleTestSound = async () => {
    setTestingSound(true);
    setSoundTestStatus('Playing notification sound...');
    try {
      const res = await testNotificationSound();
      if (res.success) {
        setSoundTestStatus('Notification sound played successfully.');
      } else {
        setSoundTestStatus(res.message);
      }
    } catch (err) {
      setSoundTestStatus(err.message || 'Sound playback failed.');
    } finally {
      setTestingSound(false);
      setTimeout(() => setSoundTestStatus(''), 4000);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    // Strict validation: At least one payment method must remain enabled
    if (settings.codEnabled === false && settings.onlinePaymentEnabled === false) {
      setErrorMsg('At least one payment method (Cash on Delivery or Online Payment) must remain enabled.');
      setSaving(false);
      return;
    }

    try {
      const payload = {
        storeName: settings.storeName.trim(),
        tagline: settings.tagline.trim(),
        contactPhone: settings.contactPhone.trim(),
        contactEmail: settings.contactEmail.trim(),
        address: settings.address.trim(),
        serviceCity: settings.serviceCity.trim(),
        servicePincode: settings.servicePincode.trim(),
        dispatchCoordinates: settings.dispatchCoordinates,
        isOpen: settings.isOpen,
        announcementNotice: settings.announcementNotice.trim(),
        minOrderAmountPaise: Math.round(Number(settings.minOrderAmountRupees) * 100),
        freeDeliveryThresholdPaise: Math.round(Number(settings.freeDeliveryThresholdRupees) * 100),
        deliveryFeeBasePaise: Math.round(Number(settings.deliveryFeeBaseRupees) * 100),
        maxDeliveryDistanceKm: Number(settings.maxDeliveryDistanceKm),
        estimatedDeliveryWindow: settings.estimatedDeliveryWindow.trim(),
        notificationSettings: {
          soundEnabled: settings.soundEnabled,
          soundCooldownSeconds: Number(settings.soundCooldownSeconds) || 3,
        },
        paymentSettings: {
          codEnabled: settings.codEnabled,
          onlinePaymentEnabled: settings.onlinePaymentEnabled,
        },
      };

      const res = await apiClient.put('/v1/admin/settings', payload);
      if (res.data?.success) {
        setSuccessMsg('Storefront, notification sound & payment settings updated successfully.');
        window.dispatchEvent(new CustomEvent('khushboo:settings_updated'));
        setTimeout(() => setSuccessMsg(''), 5000);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-5xl" aria-busy="true" aria-label="Loading store configuration">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <SkeletonTitle height="h-7" width="260px" />
            <SkeletonText width="320px" height="h-3" />
          </div>
          <SkeletonBase className="w-9 h-9 rounded-xl" />
        </div>

        <div className="space-y-6">
          {[1, 2, 3].map((card) => (
            <div key={card} className="bg-surface border border-border-neutral rounded-2xl p-6 shadow-xs space-y-4">
              <SkeletonTitle height="h-5" width="200px" />
              <div className="space-y-3">
                <SkeletonBase className="h-14 w-full rounded-xl" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <SkeletonBase className="h-10 w-full rounded-xl" />
                  <SkeletonBase className="h-10 w-full rounded-xl" />
                </div>
              </div>
            </div>
          ))}
          <SkeletonButton className="w-36 h-10" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-text-main flex items-center gap-2.5">
            <Settings className="w-6 h-6 text-brand" />
            Store & Delivery Settings
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Configure live operating hours, delivery thresholds in Indore, and customer notices.
          </p>
        </div>

        <button
          onClick={fetchSettings}
          className="p-2.5 rounded-xl bg-surface border border-border-neutral text-text-muted hover:text-text-main hover:bg-surface-subtle transition self-start sm:self-auto shadow-xs"
          title="Reload Settings"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-status-success text-xs flex items-center gap-3 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-status-error text-xs flex items-center gap-3 animate-fadeIn">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Store Availability Card */}
        <div className="bg-surface border border-border-neutral rounded-2xl p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-bold font-heading text-text-main flex items-center gap-2">
            <Store className="w-4 h-4 text-brand" />
            Storefront Availability
          </h2>

          <div className="flex items-center justify-between p-4 bg-surface-subtle rounded-xl border border-border-neutral">
            <div>
              <span className="text-xs font-bold text-text-main block">Accepting Online Orders</span>
              <p className="text-[11px] text-text-muted mt-0.5">
                When toggled off, customers can browse products but checkout will be temporarily paused.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSettings({ ...settings, isOpen: !settings.isOpen })}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition shadow-xs ${
                settings.isOpen
                  ? 'bg-emerald-50 text-status-success border-emerald-200 hover:bg-emerald-100'
                  : 'bg-red-50 text-status-error border-red-200 hover:bg-red-100'
              }`}
            >
              {settings.isOpen ? (
                <>
                  <ToggleRight className="w-5 h-5 text-status-success" />
                  <span>Store Open</span>
                </>
              ) : (
                <>
                  <ToggleLeft className="w-5 h-5 text-status-error" />
                  <span>Store Paused</span>
                </>
              )}
            </button>
          </div>

          <div>
            <label className="block text-xs text-text-main font-semibold mb-1">
              Storefront Announcement Notice
            </label>
            <input
              type="text"
              value={settings.announcementNotice}
              onChange={(e) => setSettings({ ...settings, announcementNotice: e.target.value })}
              placeholder="e.g. Pure & Stone-Ground MP Sharbati Wheat Flour delivered in 90 mins across Indore."
              className="w-full bg-primary-bg border border-border-neutral rounded-xl px-3 py-2 text-xs text-text-main placeholder:text-text-muted focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            />
            <span className="text-[10px] text-text-muted block mt-1">
              Displayed prominently on the top announcement ribbon of the customer storefront.
            </span>
          </div>
        </div>

        {/* Notification Sound Controls Card */}
        <div className="bg-surface border border-border-neutral rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold font-heading text-text-main flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-brand" />
                Notification Sound Controls
              </h2>
              <p className="text-[11px] text-text-muted mt-0.5">
                Master audio control for real-time customer and admin notification alerts across the platform.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTestSound}
                disabled={testingSound}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-brand/30 bg-brand-light text-brand hover:bg-brand/15 transition cursor-pointer shadow-xs disabled:opacity-50"
                title="Test audio playback in current browser session"
              >
                <Play className="w-3.5 h-3.5" />
                <span>{testingSound ? 'Playing...' : 'Test Sound'}</span>
              </button>
            </div>
          </div>

          {soundTestStatus && (
            <div className="text-[11px] font-medium text-brand bg-brand-light/60 px-3 py-1.5 rounded-lg border border-brand/20 flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-3.5 h-3.5 text-brand shrink-0" />
              <span>{soundTestStatus}</span>
            </div>
          )}

          <div className="flex items-center justify-between p-4 bg-surface-subtle rounded-xl border border-border-neutral">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-text-main">Global Notification Sound</span>
                <span
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                    settings.soundEnabled
                      ? 'bg-emerald-100 text-status-success'
                      : 'bg-zinc-200 text-text-muted'
                  }`}
                >
                  {settings.soundEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <p className="text-[11px] text-text-muted mt-0.5 max-w-xl">
                When enabled, eligible new orders, support tickets, cancellations, and stock alerts play an audio chime.
                When disabled, all notifications remain silent platform-wide while badges and lists continue updating.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSettings({ ...settings, soundEnabled: !settings.soundEnabled })}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition shadow-xs cursor-pointer ${
                settings.soundEnabled
                  ? 'bg-emerald-50 text-status-success border-emerald-200 hover:bg-emerald-100'
                  : 'bg-zinc-100 text-text-muted border-zinc-200 hover:bg-zinc-200'
              }`}
            >
              {settings.soundEnabled ? (
                <>
                  <ToggleRight className="w-5 h-5 text-status-success" />
                  <span>Sound Enabled</span>
                </>
              ) : (
                <>
                  <ToggleLeft className="w-5 h-5 text-text-muted" />
                  <span>Sound Muted</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Admin Web Push Notification Controls Card */}
        <div className="bg-surface border border-border-neutral rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold font-heading text-text-main flex items-center gap-2">
                <Bell className="w-4 h-4 text-brand" />
                Admin Browser Web Push (VAPID)
              </h2>
              <p className="text-[11px] text-text-muted mt-0.5">
                Receive background OS desktop and mobile push notifications for incoming customer orders even when the admin panel tab is closed.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {isPushSubscribed && (
                <button
                  type="button"
                  onClick={handleTestAdminPush}
                  disabled={testingPush}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-brand/30 bg-brand-light text-brand hover:bg-brand/15 transition cursor-pointer shadow-xs disabled:opacity-50"
                  title="Dispatch a test VAPID push notification to this admin device"
                >
                  <Send className="w-3.5 h-3.5 text-brand" />
                  <span>{testingPush ? 'Dispatching...' : 'Test Admin Push'}</span>
                </button>
              )}
            </div>
          </div>

          {pushStatusMsg && (
            <div className="text-[11px] font-medium text-status-success bg-status-success/10 px-3 py-1.5 rounded-lg border border-status-success/20 flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-3.5 h-3.5 text-status-success shrink-0" />
              <span>{pushStatusMsg}</span>
            </div>
          )}

          {pushErrorMsg && (
            <div className="text-[11px] font-medium text-status-error bg-status-error/10 px-3 py-1.5 rounded-lg border border-status-error/20 flex items-center gap-2 animate-fadeIn">
              <AlertCircle className="w-3.5 h-3.5 text-status-error shrink-0" />
              <span>{pushErrorMsg}</span>
            </div>
          )}

          <div className="flex items-center justify-between p-4 bg-surface-subtle rounded-xl border border-border-neutral">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-text-main">Admin Device Web Push</span>
                <span
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                    isPushSubscribed
                      ? 'bg-emerald-100 text-status-success'
                      : 'bg-zinc-200 text-text-muted'
                  }`}
                >
                  {isPushSubscribed ? 'Subscribed' : 'Not Subscribed'}
                </span>
                {desktopPermission === 'denied' && (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-status-error/15 text-status-error">
                    Blocked in Browser
                  </span>
                )}
              </div>
              <p className="text-[11px] text-text-muted mt-0.5 max-w-xl">
                When enabled, your current browser registers with standard VAPID push services to receive alerts for new orders and high-priority store events.
              </p>
            </div>

            <div>
              {!pushSupported ? (
                <span className="text-xs text-text-muted bg-surface px-3 py-1.5 rounded-xl border border-border-neutral">
                  Push Unsupported
                </span>
              ) : desktopPermission === 'denied' ? (
                <span className="text-xs text-status-error font-medium">
                  Allow notifications in browser
                </span>
              ) : (
                <button
                  type="button"
                  disabled={pushLoading}
                  onClick={handleToggleAdminPush}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition shadow-xs cursor-pointer ${
                    isPushSubscribed
                      ? 'bg-emerald-50 text-status-success border-emerald-200 hover:bg-emerald-100'
                      : 'bg-zinc-100 text-text-muted border-zinc-200 hover:bg-zinc-200'
                  } ${pushLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isPushSubscribed ? (
                    <>
                      <ToggleRight className="w-5 h-5 text-status-success" />
                      <span>{pushLoading ? 'Updating...' : 'Push Enabled'}</span>
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="w-5 h-5 text-text-muted" />
                      <span>{pushLoading ? 'Updating...' : 'Enable Push'}</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Payment Methods Card */}
        <div className="bg-surface border border-border-neutral rounded-2xl p-6 shadow-xs space-y-4">
          <div>
            <h2 className="text-sm font-bold font-heading text-text-main flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-brand" />
              Payment Methods Management
            </h2>
            <p className="text-[11px] text-text-muted mt-0.5">
              Control which payment options are presented to customers during checkout in Indore.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Cash on Delivery (COD) */}
            <div className="flex items-start justify-between p-4 bg-surface-subtle rounded-xl border border-border-neutral gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-brand shrink-0" />
                  <span className="text-xs font-bold text-text-main">Cash on Delivery (COD)</span>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                      settings.codEnabled
                        ? 'bg-emerald-100 text-status-success'
                        : 'bg-zinc-200 text-text-muted'
                    }`}
                  >
                    {settings.codEnabled ? 'Active' : 'Disabled'}
                  </span>
                </div>
                <p className="text-[11px] text-text-muted">
                  Allow customers to pay with physical cash upon doorstep grocery delivery.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSettings({ ...settings, codEnabled: !settings.codEnabled })}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition shadow-xs shrink-0 cursor-pointer ${
                  settings.codEnabled
                    ? 'bg-emerald-50 text-status-success border-emerald-200 hover:bg-emerald-100'
                    : 'bg-zinc-100 text-text-muted border-zinc-200 hover:bg-zinc-200'
                }`}
              >
                {settings.codEnabled ? (
                  <>
                    <ToggleRight className="w-4 h-4 text-status-success" />
                    <span>Enabled</span>
                  </>
                ) : (
                  <>
                    <ToggleLeft className="w-4 h-4 text-text-muted" />
                    <span>Disabled</span>
                  </>
                )}
              </button>
            </div>

            {/* Online Payment (Razorpay UPI/Cards) */}
            <div className="flex items-start justify-between p-4 bg-surface-subtle rounded-xl border border-border-neutral gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-brand shrink-0" />
                  <span className="text-xs font-bold text-text-main">Online Payment (UPI / Cards)</span>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                      settings.onlinePaymentEnabled
                        ? 'bg-emerald-100 text-status-success'
                        : 'bg-zinc-200 text-text-muted'
                    }`}
                  >
                    {settings.onlinePaymentEnabled ? 'Active' : 'Disabled'}
                  </span>
                </div>
                <p className="text-[11px] text-text-muted">
                  Accept instant digital payments through Razorpay (UPI, Google Pay, PhonePe, Cards, Netbanking).
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSettings({ ...settings, onlinePaymentEnabled: !settings.onlinePaymentEnabled })}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition shadow-xs shrink-0 cursor-pointer ${
                  settings.onlinePaymentEnabled
                    ? 'bg-emerald-50 text-status-success border-emerald-200 hover:bg-emerald-100'
                    : 'bg-zinc-100 text-text-muted border-zinc-200 hover:bg-zinc-200'
                }`}
              >
                {settings.onlinePaymentEnabled ? (
                  <>
                    <ToggleRight className="w-4 h-4 text-status-success" />
                    <span>Enabled</span>
                  </>
                ) : (
                  <>
                    <ToggleLeft className="w-4 h-4 text-text-muted" />
                    <span>Disabled</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {settings.codEnabled === false && settings.onlinePaymentEnabled === false && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-status-error flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Warning: Both payment methods are disabled. You cannot save settings until at least one method is enabled.</span>
            </div>
          )}
        </div>

        {/* Indore Delivery & Thresholds Card */}
        <div className="bg-surface border border-border-neutral rounded-2xl p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-bold font-heading text-text-main flex items-center gap-2">
            <Truck className="w-4 h-4 text-brand" />
            Indore Delivery Rules & Pricing
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-text-main font-semibold mb-1">Minimum Order Amount (₹)</label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  value={settings.minOrderAmountRupees}
                  onChange={(e) => setSettings({ ...settings, minOrderAmountRupees: e.target.value })}
                  className="w-full bg-primary-bg border border-border-neutral rounded-xl px-3 py-2 text-text-main font-mono focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                />
              </div>
              <span className="text-[10px] text-text-muted block mt-1">Orders below this cannot checkout.</span>
            </div>

            <div>
              <label className="block text-text-main font-semibold mb-1">Free Delivery Threshold (₹)</label>
              <input
                type="number"
                min={0}
                value={settings.freeDeliveryThresholdRupees}
                onChange={(e) => setSettings({ ...settings, freeDeliveryThresholdRupees: e.target.value })}
                className="w-full bg-primary-bg border border-border-neutral rounded-xl px-3 py-2 text-text-main font-mono focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              />
              <span className="text-[10px] text-text-muted block mt-1">Delivery fee is waived on orders ≥ this.</span>
            </div>

            <div>
              <label className="block text-text-main font-semibold mb-1">Standard Delivery Fee (₹)</label>
              <input
                type="number"
                min={0}
                value={settings.deliveryFeeBaseRupees}
                onChange={(e) => setSettings({ ...settings, deliveryFeeBaseRupees: e.target.value })}
                className="w-full bg-primary-bg border border-border-neutral rounded-xl px-3 py-2 text-text-main font-mono focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              />
              <span className="text-[10px] text-text-muted block mt-1">Charged when order is below free threshold.</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-2">
            <div>
              <label className="block text-text-main font-semibold mb-1">Max Delivery Radius (km)</label>
              <input
                type="number"
                min={1}
                value={settings.maxDeliveryDistanceKm}
                onChange={(e) => setSettings({ ...settings, maxDeliveryDistanceKm: e.target.value })}
                className="w-full bg-primary-bg border border-border-neutral rounded-xl px-3 py-2 text-text-main font-mono focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              />
              <span className="text-[10px] text-text-muted block mt-1">Radius from Geeta Bhawan, Indore.</span>
            </div>

            <div>
              <label className="block text-text-main font-semibold mb-1">Delivery Window Promise</label>
              <input
                type="text"
                value={settings.estimatedDeliveryWindow}
                onChange={(e) => setSettings({ ...settings, estimatedDeliveryWindow: e.target.value })}
                placeholder="e.g. 90 - 120 Minutes"
                className="w-full bg-primary-bg border border-border-neutral rounded-xl px-3 py-2 text-text-main placeholder:text-text-muted focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              />
              <span className="text-[10px] text-text-muted block mt-1">Customer delivery timeframe display.</span>
            </div>
          </div>
        </div>

        {/* Business & Contact Details Card */}
        <div className="bg-surface border border-border-neutral rounded-2xl p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-bold font-heading text-text-main flex items-center gap-2">
            <MapPin className="w-4 h-4 text-brand" />
            Store Information & Contact Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-text-main font-semibold mb-1">Store Name</label>
              <input
                type="text"
                value={settings.storeName}
                onChange={(e) => setSettings({ ...settings, storeName: e.target.value })}
                className="w-full bg-primary-bg border border-border-neutral rounded-xl px-3 py-2 text-text-main focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              />
            </div>

            <div>
              <label className="block text-text-main font-semibold mb-1">Tagline</label>
              <input
                type="text"
                value={settings.tagline}
                onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
                className="w-full bg-primary-bg border border-border-neutral rounded-xl px-3 py-2 text-text-main focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              />
            </div>

            <div>
              <label className="block text-text-main font-semibold mb-1">Support Phone</label>
              <input
                type="text"
                value={settings.contactPhone}
                onChange={(e) => setSettings({ ...settings, contactPhone: e.target.value })}
                className="w-full bg-primary-bg border border-border-neutral rounded-xl px-3 py-2 text-text-main font-mono focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              />
            </div>

            <div>
              <label className="block text-text-main font-semibold mb-1">Support Email</label>
              <input
                type="email"
                value={settings.contactEmail}
                onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })}
                className="w-full bg-primary-bg border border-border-neutral rounded-xl px-3 py-2 text-text-main focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              />
            </div>
          </div>

          <div className="text-xs space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-text-main font-semibold">Store Dispatch Center Address</label>
              <button
                type="button"
                onClick={() => setMapModalOpen(true)}
                className="px-3 py-1 rounded-lg bg-brand-light text-brand text-xs font-bold hover:bg-brand-light/80 transition flex items-center gap-1.5"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Configure Hub on Map</span>
              </button>
            </div>
            <input
              type="text"
              value={settings.address}
              onChange={(e) => setSettings({ ...settings, address: e.target.value })}
              className="w-full bg-primary-bg border border-border-neutral rounded-xl px-3 py-2 text-text-main focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            />
            {settings.dispatchCoordinates && (
              <div className="p-2.5 bg-surface-subtle border border-border-neutral rounded-xl text-[11px] text-text-muted flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-brand shrink-0" />
                <span>
                  Authoritative Dispatch Coordinates:{' '}
                  <strong className="font-mono text-brand">
                    {settings.dispatchCoordinates.lat?.toFixed(5)}, {settings.dispatchCoordinates.lng?.toFixed(5)}
                  </strong>{' '}
                  (Used for road distance calculations)
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-brand hover:bg-brand-hover text-white font-semibold text-xs rounded-xl shadow-xs flex items-center gap-2 transition"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Saving Configuration...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save All Settings</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Map Location Picker Modal */}
      <LocationPickerModal
        isOpen={mapModalOpen}
        onClose={() => setMapModalOpen(false)}
        initialCoordinates={settings.dispatchCoordinates}
        onLocationSelect={(place) => {
          setSettings((prev) => ({
            ...prev,
            address: place.formattedAddress || prev.address,
            serviceCity: place.city || prev.serviceCity,
            servicePincode: place.pincode || prev.servicePincode,
            dispatchCoordinates: place.coordinates,
          }));
        }}
        title="Set Store Central Dispatch Hub"
      />
    </div>
  );
}
