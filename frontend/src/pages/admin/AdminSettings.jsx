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
  Plus,
  Trash2,
  RotateCcw,
  Info,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { LocationPickerModal } from '../../components/map/LocationPickerModal.jsx';
import { testNotificationSound } from '../../utils/soundManager.js';
import { useNotifications } from '../../context/NotificationContext.jsx';
import { SkeletonTitle, SkeletonText, SkeletonBase, SkeletonButton } from '../../components/skeleton/index.js';
import { validateCoordinates } from '../../utils/coordinateValidator.js';

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

  const [distancePricingEnabled, setDistancePricingEnabled] = useState(false);
  const [distanceRules, setDistanceRules] = useState([
    { fromKm: 0, toKm: 5, feeRupees: 25, useStandardFee: true, label: '0–5 km' },
    { fromKm: 5, toKm: 10, feeRupees: 30, useStandardFee: false, label: '5–10 km' },
    { fromKm: 10, toKm: 15, feeRupees: 40, useStandardFee: false, label: '10–15 km' },
  ]);
  const [initialDistanceState, setInitialDistanceState] = useState(null);

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

        const currentBaseFee = (d.deliveryFeeBasePaise || 2500) / 100;
        const currentMaxKm = d.maxDeliveryDistanceKm || 15;
        const defaultRules = [
          { fromKm: 0, toKm: 5, feeRupees: currentBaseFee, useStandardFee: true, label: '0–5 km' },
          { fromKm: 5, toKm: 10, feeRupees: 30, useStandardFee: false, label: '5–10 km' },
          { fromKm: 10, toKm: currentMaxKm, feeRupees: 40, useStandardFee: false, label: `10–${currentMaxKm} km` },
        ];

        const fetchedRules = (d.distanceBasedPricing?.rules && d.distanceBasedPricing.rules.length > 0)
          ? d.distanceBasedPricing.rules.map((r) => ({
              fromKm: r.fromKm,
              toKm: r.toKm,
              feeRupees: r.feeRupees !== undefined ? r.feeRupees : (r.feePaise ? r.feePaise / 100 : 0),
              useStandardFee: Boolean(r.useStandardFee),
              label: r.label || `${r.fromKm}–${r.toKm} km`,
            }))
          : defaultRules;

        const isDistanceEnabled = Boolean(d.distanceBasedPricing?.enabled);

        setDistancePricingEnabled(isDistanceEnabled);
        setDistanceRules(fetchedRules);
        setInitialDistanceState({
          enabled: isDistanceEnabled,
          rules: JSON.parse(JSON.stringify(fetchedRules)),
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

  const validateClientDistanceRules = (rules, maxRadiusKm, standardFee) => {
    const errs = [];
    if (!rules || rules.length === 0) {
      errs.push('At least one distance rule is required.');
      return errs;
    }
    const maxR = Number(maxRadiusKm) || 15;
    if (rules[0].fromKm !== 0) {
      errs.push(`First distance slab must start at 0 km (currently ${rules[0].fromKm} km).`);
    }
    for (let i = 0; i < rules.length; i++) {
      const r = rules[i];
      const from = Number(r.fromKm);
      const to = Number(r.toKm);
      const fee = r.useStandardFee ? Number(standardFee) : Number(r.feeRupees);

      if (isNaN(from) || from < 0) {
        errs.push(`Slab #${i + 1}: "From (km)" must be a positive number or zero.`);
      }
      if (isNaN(to) || to <= 0) {
        errs.push(`Slab #${i + 1}: "To (km)" must be greater than 0.`);
      } else if (to <= from) {
        errs.push(`Slab #${i + 1}: "To (km)" (${to} km) must be strictly greater than "From (km)" (${from} km).`);
      }
      if (to > maxR) {
        errs.push(`Slab #${i + 1}: "To (km)" (${to} km) cannot exceed Maximum Delivery Radius (${maxR} km).`);
      }
      if (isNaN(fee) || fee < 0) {
        errs.push(`Slab #${i + 1}: Delivery fee cannot be negative.`);
      }
      if (i > 0) {
        const prev = rules[i - 1];
        const prevTo = Number(prev.toKm);
        if (from < prevTo) {
          errs.push(`Overlapping slabs detected: Slab #${i} ends at ${prevTo} km, but Slab #${i + 1} begins at ${from} km.`);
        } else if (from > prevTo) {
          errs.push(`Coverage gap between Slab #${i} and #${i + 1}: Missing interval between ${prevTo} km and ${from} km.`);
        }
      }
    }
    const last = rules[rules.length - 1];
    if (last && Number(last.toKm) !== maxR) {
      errs.push(`Final slab must end exactly at Maximum Delivery Radius (${maxR} km). Currently ends at ${last.toKm} km.`);
    }
    return errs;
  };

  const handleAddSlab = () => {
    const maxR = Number(settings.maxDeliveryDistanceKm) || 15;
    const lastRule = distanceRules[distanceRules.length - 1];
    const lastTo = lastRule ? Number(lastRule.toKm) : 0;

    if (lastTo >= maxR) {
      if (distanceRules.length > 0 && lastRule.fromKm < maxR - 1) {
        const splitPoint = Math.round(((lastRule.fromKm + maxR) / 2) * 10) / 10;
        const updated = [...distanceRules];
        updated[updated.length - 1] = {
          ...lastRule,
          toKm: splitPoint,
          label: `${lastRule.fromKm}–${splitPoint} km`,
        };
        updated.push({
          fromKm: splitPoint,
          toKm: maxR,
          feeRupees: Number(lastRule.feeRupees) + 10,
          useStandardFee: false,
          label: `${splitPoint}–${maxR} km`,
        });
        setDistanceRules(updated);
        return;
      }
    }

    const newFrom = lastTo;
    const newTo = Math.min(maxR, newFrom + 5);
    const newFee = lastRule ? Number(lastRule.feeRupees) + 10 : 30;

    setDistanceRules([
      ...distanceRules,
      {
        fromKm: newFrom,
        toKm: newTo,
        feeRupees: newFee,
        useStandardFee: false,
        label: `${newFrom}–${newTo} km`,
      },
    ]);
  };

  const handleRemoveSlab = (indexToRemove) => {
    if (distanceRules.length <= 1) return;
    const updated = distanceRules.filter((_, idx) => idx !== indexToRemove);

    for (let i = 0; i < updated.length; i++) {
      if (i === 0) {
        updated[i].fromKm = 0;
      } else {
        updated[i].fromKm = updated[i - 1].toKm;
      }
      updated[i].label = `${updated[i].fromKm}–${updated[i].toKm} km`;
    }
    setDistanceRules(updated);
  };

  const handleUpdateSlab = (index, field, value) => {
    const updated = distanceRules.map((rule, idx) => {
      if (idx !== index) return rule;
      const modified = { ...rule };
    if (field === 'toKm') {
        // Enforce integer km values — delivery distance slabs use whole-kilometre boundaries.
        // Rounding to 1 decimal (×10/10) caused browser step-validation conflicts when the
        // stored value (e.g. 4.6) didn't align with the input step, producing confusing
        // "valid values are X and Y" browser tooltips on the spinner arrows.
        const numVal = Math.max(0, Math.round(Number(value)));
        modified.toKm = numVal;
        modified.label = `${modified.fromKm}–${numVal} km`;
      } else if (field === 'useStandardFee') {
        modified.useStandardFee = Boolean(value);
        if (modified.useStandardFee) {
          modified.feeRupees = Number(settings.deliveryFeeBaseRupees);
        }
      } else if (field === 'feeRupees') {
        modified.feeRupees = Math.max(0, Math.round(Number(value)));
      }
      return modified;
    });

    if (field === 'toKm' && index < updated.length - 1) {
      updated[index + 1].fromKm = updated[index].toKm;
      updated[index + 1].label = `${updated[index + 1].fromKm}–${updated[index + 1].toKm} km`;
    }

    setDistanceRules(updated);
  };

  const handleSyncFinalSlabToMaxRadius = () => {
    const maxR = Number(settings.maxDeliveryDistanceKm) || 15;
    if (distanceRules.length === 0) return;
    const updated = [...distanceRules];
    const last = updated[updated.length - 1];
    updated[updated.length - 1] = {
      ...last,
      toKm: maxR,
      label: `${last.fromKm}–${maxR} km`,
    };
    setDistanceRules(updated);
  };

  const handleResetToDefaultSlabs = () => {
    const maxR = Number(settings.maxDeliveryDistanceKm) || 15;
    const baseFee = Number(settings.deliveryFeeBaseRupees) || 25;
    if (maxR <= 5) {
      setDistanceRules([
        { fromKm: 0, toKm: maxR, feeRupees: baseFee, useStandardFee: true, label: `0–${maxR} km` },
      ]);
    } else if (maxR <= 10) {
      setDistanceRules([
        { fromKm: 0, toKm: 5, feeRupees: baseFee, useStandardFee: true, label: '0–5 km' },
        { fromKm: 5, toKm: maxR, feeRupees: 30, useStandardFee: false, label: `5–${maxR} km` },
      ]);
    } else {
      setDistanceRules([
        { fromKm: 0, toKm: 5, feeRupees: baseFee, useStandardFee: true, label: '0–5 km' },
        { fromKm: 5, toKm: 10, feeRupees: 30, useStandardFee: false, label: '5–10 km' },
        { fromKm: 10, toKm: maxR, feeRupees: 40, useStandardFee: false, label: `10–${maxR} km` },
      ]);
    }
  };

  const handleRevertDistance = () => {
    if (initialDistanceState) {
      setDistancePricingEnabled(initialDistanceState.enabled);
      setDistanceRules(JSON.parse(JSON.stringify(initialDistanceState.rules)));
    }
  };

  const liveValidationErrors = validateClientDistanceRules(
    distanceRules,
    settings.maxDeliveryDistanceKm,
    settings.deliveryFeeBaseRupees
  );

  const isDistanceDirty =
    initialDistanceState &&
    (initialDistanceState.enabled !== distancePricingEnabled ||
      JSON.stringify(initialDistanceState.rules) !== JSON.stringify(distanceRules));

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

    // Distance pricing client validation
    if (distancePricingEnabled) {
      const distanceErrs = validateClientDistanceRules(
        distanceRules,
        settings.maxDeliveryDistanceKm,
        settings.deliveryFeeBaseRupees
      );
      if (distanceErrs.length > 0) {
        setErrorMsg(`Distance Pricing Validation Error: ${distanceErrs[0]}`);
        setSaving(false);
        return;
      }
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
        distanceBasedPricing: {
          enabled: distancePricingEnabled,
          rules: distanceRules.map((r) => ({
            fromKm: Number(r.fromKm),
            toKm: Number(r.toKm),
            feeRupees: r.useStandardFee ? Number(settings.deliveryFeeBaseRupees) : Number(r.feeRupees),
            feePaise: Math.round((r.useStandardFee ? Number(settings.deliveryFeeBaseRupees) : Number(r.feeRupees)) * 100),
            useStandardFee: Boolean(r.useStandardFee),
            label: `${r.fromKm}–${r.toKm} km`,
          })),
        },
      };

      const res = await apiClient.put('/v1/admin/settings', payload);
      if (res.data?.success) {
        setInitialDistanceState({
          enabled: distancePricingEnabled,
          rules: JSON.parse(JSON.stringify(distanceRules)),
        });
        setSuccessMsg('Storefront, distance pricing & payment settings updated successfully.');
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

          {/* Distance-Based Delivery Pricing Section */}
          <div className="pt-4 border-t border-border-neutral space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-surface-subtle rounded-xl border border-border-neutral">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-brand" />
                  <span className="text-xs font-bold text-text-main">Distance-Based Delivery Pricing</span>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                      distancePricingEnabled
                        ? 'bg-emerald-100 text-status-success'
                        : 'bg-zinc-200 text-text-muted'
                    }`}
                  >
                    {distancePricingEnabled ? 'Active (Distance Slabs)' : 'Disabled (Flat Standard Fee)'}
                  </span>
                </div>
                <p className="text-[11px] text-text-muted max-w-2xl">
                  Dynamically charges delivery fees based on authoritative road distance from the Geeta Bhawan store hub.
                  When disabled, the flat Standard Delivery Fee (₹{settings.deliveryFeeBaseRupees}) applies to all eligible deliveries.
                  Orders reaching the Free Delivery Threshold (₹{settings.freeDeliveryThresholdRupees}) always receive 100% free delivery.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setDistancePricingEnabled(!distancePricingEnabled)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition shadow-xs shrink-0 cursor-pointer ${
                  distancePricingEnabled
                    ? 'bg-emerald-50 text-status-success border-emerald-200 hover:bg-emerald-100'
                    : 'bg-zinc-100 text-text-muted border-zinc-200 hover:bg-zinc-200'
                }`}
              >
                {distancePricingEnabled ? (
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

            {/* Slabs Configuration Container */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-text-main">Distance Slabs & Rates</span>
                  <span className="text-[10px] text-text-muted bg-surface-subtle px-2 py-0.5 rounded-md border border-border-neutral">
                    {distanceRules.length} {distanceRules.length === 1 ? 'slab' : 'slabs'} defined
                  </span>
                  {isDistanceDirty && (
                    <span className="text-[10px] font-medium text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                      Unsaved changes
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAddSlab}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-brand text-white hover:bg-brand-hover transition shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Distance Slab</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleResetToDefaultSlabs}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-surface border border-border-neutral text-text-muted hover:text-text-main hover:bg-surface-subtle transition cursor-pointer"
                    title="Reset to 0-5km Standard, 5-10km ₹30, 10-15km ₹40"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Defaults</span>
                  </button>

                  {isDistanceDirty && (
                    <button
                      type="button"
                      onClick={handleRevertDistance}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-zinc-100 border border-zinc-200 text-zinc-600 hover:bg-zinc-200 transition cursor-pointer"
                      title="Discard unsaved slab changes"
                    >
                      <span>Discard</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-hidden rounded-xl border border-border-neutral">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-surface-subtle border-b border-border-neutral text-text-muted uppercase text-[10px] font-semibold tracking-wider">
                      <th className="py-2.5 px-3">Slab</th>
                      <th className="py-2.5 px-3">From (km)</th>
                      <th className="py-2.5 px-3">To (km)</th>
                      <th className="py-2.5 px-3">Boundary Logic</th>
                      <th className="py-2.5 px-3">Delivery Fee</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-neutral bg-surface">
                    {distanceRules.map((rule, idx) => {
                      const isLast = idx === distanceRules.length - 1;
                      return (
                        <tr key={idx} className="hover:bg-surface-subtle/50 transition">
                          <td className="py-3 px-3 font-semibold text-text-main">
                            <span className="bg-brand-light text-brand px-2 py-0.5 rounded text-[11px] font-mono font-bold">
                              #{idx + 1}
                            </span>
                          </td>

                          {/* From km */}
                          <td className="py-3 px-3">
                            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-subtle border border-border-neutral font-mono font-bold text-text-main">
                              <span>{rule.fromKm}</span>
                              <span className="text-text-muted text-[10px]">km</span>
                            </div>
                          </td>

                          {/* To km */}
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                step="1"
                                min="1"
                                max={settings.maxDeliveryDistanceKm}
                                value={rule.toKm}
                                onChange={(e) => handleUpdateSlab(idx, 'toKm', e.target.value)}
                                className="w-24 bg-primary-bg border border-border-neutral rounded-lg px-2.5 py-1 text-xs font-mono text-text-main focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                              />
                              <span className="text-text-muted text-xs font-mono">km</span>
                            </div>
                          </td>

                          {/* Boundary Logic */}
                          <td className="py-3 px-3">
                            {isLast ? (
                              <div className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                                <span>[{rule.fromKm}, {rule.toKm}] km</span>
                                <span className="text-[10px] font-sans font-normal">(Terminal)</span>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1 font-mono text-[11px] font-medium text-text-muted bg-surface-subtle px-2.5 py-1 rounded-md border border-border-neutral">
                                <span>[{rule.fromKm}, {rule.toKm}) km</span>
                                <span className="text-[10px] font-sans">(Half-open)</span>
                              </div>
                            )}
                          </td>

                          {/* Delivery Fee */}
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-3">
                              <label className="flex items-center gap-1.5 cursor-pointer select-none text-[11px] text-text-muted hover:text-text-main">
                                <input
                                  type="checkbox"
                                  checked={rule.useStandardFee}
                                  onChange={(e) => handleUpdateSlab(idx, 'useStandardFee', e.target.checked)}
                                  className="rounded border-border-neutral text-brand focus:ring-brand cursor-pointer"
                                />
                                <span>Standard Fee</span>
                              </label>

                              {rule.useStandardFee ? (
                                <span className="font-mono font-bold text-xs text-text-main bg-brand-light px-2.5 py-1 rounded-md border border-brand/20">
                                  ₹{settings.deliveryFeeBaseRupees}
                                </span>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <span className="text-text-muted font-semibold text-xs">₹</span>
                                  <input
                                    type="number"
                                    min="0"
                                    value={rule.feeRupees}
                                    onChange={(e) => handleUpdateSlab(idx, 'feeRupees', e.target.value)}
                                    className="w-20 bg-primary-bg border border-border-neutral rounded-lg px-2.5 py-1 text-xs font-mono font-semibold text-text-main focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                                  />
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveSlab(idx)}
                              disabled={distanceRules.length <= 1}
                              className="p-1.5 rounded-lg text-status-error hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent transition cursor-pointer"
                              title={distanceRules.length <= 1 ? 'At least one slab required' : 'Delete distance slab'}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards View */}
              <div className="md:hidden space-y-3">
                {distanceRules.map((rule, idx) => {
                  const isLast = idx === distanceRules.length - 1;
                  return (
                    <div
                      key={idx}
                      className="p-3.5 bg-surface rounded-xl border border-border-neutral shadow-xs space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="bg-brand-light text-brand px-2 py-0.5 rounded text-[11px] font-mono font-bold">
                            Slab #{idx + 1}
                          </span>
                          <span className="font-mono text-xs font-semibold text-text-main">
                            {rule.fromKm} to {rule.toKm} km
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveSlab(idx)}
                          disabled={distanceRules.length <= 1}
                          className="p-1.5 rounded-lg text-status-error hover:bg-red-50 disabled:opacity-30 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="block text-[10px] text-text-muted font-semibold mb-1">From (km)</label>
                          <div className="px-2.5 py-1.5 bg-surface-subtle border border-border-neutral rounded-lg font-mono font-bold text-text-main">
                            {rule.fromKm} km
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] text-text-muted font-semibold mb-1">To (km)</label>
                          <input
                            type="number"
                            step="1"
                            min="1"
                            max={settings.maxDeliveryDistanceKm}
                            value={rule.toKm}
                            onChange={(e) => handleUpdateSlab(idx, 'toKm', e.target.value)}
                            className="w-full bg-primary-bg border border-border-neutral rounded-lg px-2.5 py-1.5 text-xs font-mono text-text-main"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-border-neutral">
                        <label className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer">
                          <input
                            type="checkbox"
                            checked={rule.useStandardFee}
                            onChange={(e) => handleUpdateSlab(idx, 'useStandardFee', e.target.checked)}
                            className="rounded border-border-neutral text-brand"
                          />
                          <span>Use Standard Fee</span>
                        </label>

                        {rule.useStandardFee ? (
                          <span className="font-mono font-bold text-xs text-text-main bg-brand-light px-2.5 py-1 rounded-md">
                            ₹{settings.deliveryFeeBaseRupees}
                          </span>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className="text-text-muted text-xs font-semibold">₹</span>
                            <input
                              type="number"
                              min="0"
                              value={rule.feeRupees}
                              onChange={(e) => handleUpdateSlab(idx, 'feeRupees', e.target.value)}
                              className="w-20 bg-primary-bg border border-border-neutral rounded-lg px-2 py-1 text-xs font-mono font-semibold text-text-main"
                            />
                          </div>
                        )}
                      </div>

                      <div className="text-[10px] font-mono text-text-muted bg-surface-subtle px-2 py-1 rounded">
                        Interval: {isLast ? `[${rule.fromKm}, ${rule.toKm}] km (Terminal)` : `[${rule.fromKm}, ${rule.toKm}) km`}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Boundary Logic Reference Callout */}
              <div className="p-3 bg-surface-subtle border border-border-neutral rounded-xl text-[11px] text-text-muted space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-text-main">
                  <Info className="w-3.5 h-3.5 text-brand shrink-0" />
                  <span>Boundary Behavior & Rounding Reference:</span>
                </div>
                <p>
                  Intermediate distance slabs use half-open intervals <code className="font-mono text-brand font-semibold">[from, to)</code>: a customer at 4.99 km pays the 0–5 km fee, while exactly 5.00 km transitions into the 5–10 km slab.
                  The terminal slab <code className="font-mono text-brand font-semibold">[{distanceRules[distanceRules.length - 1]?.fromKm || 10}, {settings.maxDeliveryDistanceKm}] km</code> is closed and inclusive up to the configured Maximum Delivery Radius ({settings.maxDeliveryDistanceKm} km). Orders beyond {settings.maxDeliveryDistanceKm} km are marked unserviceable.
                </p>
              </div>

              {/* Live Validation Warnings */}
              {liveValidationErrors.length > 0 && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs space-y-2 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Configuration Warnings ({liveValidationErrors.length})</span>
                    </div>

                    {distanceRules.length > 0 &&
                      Number(distanceRules[distanceRules.length - 1].toKm) !== Number(settings.maxDeliveryDistanceKm) && (
                        <button
                          type="button"
                          onClick={handleSyncFinalSlabToMaxRadius}
                          className="px-2.5 py-1 rounded-lg bg-amber-200/80 hover:bg-amber-200 text-amber-900 font-semibold text-[11px] transition cursor-pointer"
                        >
                          Auto-extend final slab to {settings.maxDeliveryDistanceKm} km
                        </button>
                      )}
                  </div>

                  <ul className="list-disc pl-5 space-y-1 text-[11px]">
                    {liveValidationErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
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
          if (!place) return;
          const coordCheck = validateCoordinates(place.coordinates);
          if (!coordCheck.valid || !coordCheck.normalized) return;

          setSettings((prev) => ({
            ...prev,
            address: place.formattedAddress || prev.address,
            serviceCity: place.city || prev.serviceCity,
            servicePincode: place.pincode || prev.servicePincode,
            dispatchCoordinates: coordCheck.normalized,
          }));
        }}
        title="Set Store Central Dispatch Hub"
      />
    </div>
  );
}
