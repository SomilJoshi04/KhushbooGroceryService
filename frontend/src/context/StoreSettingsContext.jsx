/**
 * Store Settings & Dynamic Configuration Context.
 *
 * Provides real-time store details, Indore delivery thresholds, operating status,
 * customer support helpline, and dispatch hub information across the entire website.
 * Automatically synchronizes whenever an administrator updates settings or delivery zones.
 *
 * @module context/StoreSettingsContext
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiClient } from '../config/api.js';
import { useSocket } from './SocketContext.jsx';
import { swrCache } from '../utils/swrCache.js';

const StoreSettingsContext = createContext(null);

const DEFAULT_SETTINGS = {
  storeName: 'Khushboo Grocery Service',
  tagline: '100% Pure & Stone-Ground Groceries',
  contactPhone: '+91 98260 12345',
  contactEmail: 'support@khushboofood.com',
  address: '123 MG Road, Geeta Bhawan, Indore, Madhya Pradesh 452001',
  serviceCity: 'Indore',
  servicePincode: '452001',
  centralHub: 'Geeta Bhawan, MG Road',
  isOpen: true,
  announcementNotice: '',
  minOrderAmountPaise: 1000,
  minOrderAmountRupees: 10,
  freeDeliveryThresholdPaise: 49900,
  freeDeliveryThresholdRupees: 499,
  deliveryFeeBasePaise: 2500,
  deliveryFeeBaseRupees: 25,
  maxDeliveryDistanceKm: 15,
  estimatedDeliveryWindow: '90–120 Minutes',
  primaryZone: null,
  activeZones: [],
  paymentSettings: {
    codEnabled: true,
    onlinePaymentEnabled: true,
  },
  notificationSettings: {
    soundEnabled: true,
    soundCooldownSeconds: 3,
  },
  distanceBasedPricing: {
    enabled: false,
    rules: [],
  },
};

export function StoreSettingsProvider({ children }) {
  const { socket } = useSocket();
  const [settings, setSettings] = useState(() => {
    try {
      const cached = localStorage.getItem('khushboo_store_settings');
      if (cached) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(cached), loading: false };
      }
    } catch {
      // Ignore cache parsing errors
    }
    return { ...DEFAULT_SETTINGS, loading: true };
  });

  const refreshSettings = useCallback(async () => {
    try {
      const res = await apiClient.get('/v1/store/settings');
      if (res.data?.success && res.data?.data) {
        const d = res.data.data;
        swrCache.set('store_settings', d, 5 * 60 * 1000);
        const minPaise = d.effectiveMinOrderAmountPaise ?? d.minOrderAmountPaise ?? 1000;
        const freePaise = d.effectiveFreeDeliveryThresholdPaise ?? d.freeDeliveryThresholdPaise ?? 49900;
        const feePaise = d.deliveryFeeBasePaise ?? 2500;
        const windowText = d.effectiveEstimatedDeliveryWindow || d.estimatedDeliveryWindow || '90–120 Minutes';

        let hub = d.centralHub;
        if (!hub && d.address) {
          const parts = d.address.split(',').map((s) => s.trim()).filter(Boolean);
          hub = parts.length >= 2 ? `${parts[1]}, ${parts[0]}` : parts[0] || 'Geeta Bhawan, MG Road';
        }

        const updated = {
          storeName: d.storeName || 'Khushboo Grocery Service',
          tagline: d.tagline || '100% Pure & Stone-Ground Groceries',
          contactPhone: d.contactPhone || '+91 98260 12345',
          contactEmail: d.contactEmail || 'support@khushboofood.com',
          address: d.address || '123 MG Road, Geeta Bhawan, Indore, Madhya Pradesh 452001',
          serviceCity: d.serviceCity || 'Indore',
          servicePincode: d.servicePincode || '452001',
          centralHub: hub || 'Geeta Bhawan, MG Road',
          isOpen: d.isOpen ?? true,
          announcementNotice: d.announcementNotice || '',
          minOrderAmountPaise: minPaise,
          minOrderAmountRupees: Math.round(minPaise / 100),
          freeDeliveryThresholdPaise: freePaise,
          freeDeliveryThresholdRupees: Math.round(freePaise / 100),
          deliveryFeeBasePaise: feePaise,
          deliveryFeeBaseRupees: Math.round(feePaise / 100),
          maxDeliveryDistanceKm: d.maxDeliveryDistanceKm || 15,
          estimatedDeliveryWindow: windowText,
          primaryZone: d.primaryZone || null,
          activeZones: d.activeZones || [],
          paymentSettings: {
            codEnabled: d.paymentSettings?.codEnabled ?? true,
            onlinePaymentEnabled: d.paymentSettings?.onlinePaymentEnabled ?? true,
          },
          notificationSettings: {
            soundEnabled: d.notificationSettings?.soundEnabled ?? true,
            soundCooldownSeconds: d.notificationSettings?.soundCooldownSeconds ?? 3,
          },
          distanceBasedPricing: {
            enabled: d.distanceBasedPricing?.enabled ?? false,
            rules: d.distanceBasedPricing?.rules || [],
          },
          loading: false,
        };

        setSettings(updated);
        try {
          localStorage.setItem('khushboo_store_settings', JSON.stringify(updated));
        } catch {
          // Ignore quota errors
        }
      }
    } catch (err) {
      // If error occurs, keep current settings but stop loading spinner
      setSettings((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => {
    refreshSettings();

    // Listen for custom cross-component update events
    const handleUpdate = () => {
      refreshSettings();
    };

    window.addEventListener('khushboo:settings_updated', handleUpdate);
    window.addEventListener('focus', handleUpdate);

    if (socket) {
      socket.on('settings:updated', handleUpdate);
    }

    return () => {
      window.removeEventListener('khushboo:settings_updated', handleUpdate);
      window.removeEventListener('focus', handleUpdate);
      if (socket) {
        socket.off('settings:updated', handleUpdate);
      }
    };
  }, [refreshSettings, socket]);

  return (
    <StoreSettingsContext.Provider value={{ settings, refreshSettings }}>
      {children}
    </StoreSettingsContext.Provider>
  );
}

export function useStoreSettings() {
  const context = useContext(StoreSettingsContext);
  if (!context) {
    // Graceful fallback if called outside provider
    return {
      settings: DEFAULT_SETTINGS,
      refreshSettings: () => {},
    };
  }
  return context;
}
