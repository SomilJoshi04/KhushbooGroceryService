/**
 * Push Manager — Browser Web Push Subscription & Permission Management.
 *
 * Implements:
 * - Service worker registration and lifecycle binding.
 * - Public VAPID key discovery from backend API (with env fallback).
 * - Base64URL to Uint8Array key converter for pushManager.subscribe().
 * - Multi-browser compatibility checks (Desktop Chrome, Firefox, Edge, Safari 16+, Android Chrome).
 * - Safe subscription and unsubscription synchronization with backend REST endpoints.
 * - Test notification dispatch for immediate end-to-end verification.
 *
 * @module utils/pushManager
 */

import { apiClient } from '../config/api';

/**
 * Converts a base64url string to a Uint8Array for the Push API.
 * @param {string} base64String
 * @returns {Uint8Array}
 */
export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Checks whether the current browser supports Web Push & Service Workers.
 * @returns {boolean}
 */
export function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Provides granular device compatibility metadata, including iOS Home Screen guidance.
 * @returns {{ supported: boolean, isIOS: boolean, needsHomeScreenPwa: boolean, message: string }}
 */
export function getPushSupportDetails() {
  if (typeof window === 'undefined') {
    return { supported: false, isIOS: false, needsHomeScreenPwa: false, message: 'Server environment' };
  }

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;

  if (isIOS && !isStandalone && !('PushManager' in window)) {
    return {
      supported: false,
      isIOS: true,
      needsHomeScreenPwa: true,
      message: 'On iOS devices, Web Push requires adding Khushboo Food Service to your Home Screen: tap Share then "Add to Home Screen".',
    };
  }

  const supported = isPushSupported();
  return {
    supported,
    isIOS,
    needsHomeScreenPwa: false,
    message: supported ? '' : 'Web Push notifications are not supported by this browser.',
  };
}

/**
 * Returns current browser permission state ('granted' | 'denied' | 'default' | 'unsupported').
 * @returns {string}
 */
export function getPermissionState() {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * Registers the root service worker if not already registered.
 * @returns {Promise<ServiceWorkerRegistration>}
 */
export async function registerServiceWorker() {
  if (!isPushSupported()) {
    throw new Error('Web Push notifications are not supported by this browser.');
  }

  const registration = await navigator.serviceWorker.register('/sw.js', {
    scope: '/',
  });

  // Ensure active worker is ready
  await navigator.serviceWorker.ready;
  return registration;
}

/**
 * Retrieves the VAPID public key from backend or environment fallback.
 * @returns {Promise<string>}
 */
export async function getVapidPublicKey() {
  try {
    const res = await apiClient.get('/push/vapid-public-key');
    if (res.data?.success && res.data?.publicKey) {
      return res.data.publicKey;
    }
  } catch (err) {
    console.warn('[pushManager] Could not fetch VAPID key from API, checking env fallback:', err.message);
  }

  const envKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (envKey) return envKey;

  throw new Error('VAPID public key is not available on server or client.');
}

/**
 * Gets the current active PushSubscription on this device, if any.
 * @returns {Promise<PushSubscription|null>}
 */
export async function getCurrentSubscription() {
  if (!isPushSupported()) return null;

  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch (err) {
    console.warn('[pushManager] Failed to get existing subscription:', err.message);
    return null;
  }
}

/**
 * Subscribes the current device to Web Push notifications.
 *
 * 1. Prompts user for browser notification permission if not yet granted.
 * 2. Registers service worker.
 * 3. Forces unsubscribe of any stale subscription (VAPID key mismatch protection).
 * 4. Subscribes device via pushManager with VAPID applicationServerKey.
 * 5. Sends serialized subscription payload to backend /api/push/subscribe.
 *
 * @returns {Promise<PushSubscription>}
 */
export async function subscribeToPush() {
  if (!isPushSupported()) {
    throw new Error('Web Push is not supported in this browser.');
  }

  // 1. Request explicit browser notification permission
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(
      permission === 'denied'
        ? 'Notification permission was denied in your browser settings. Please allow notifications in site settings to receive order alerts.'
        : 'Notification permission was not granted.'
    );
  }

  // 2. Ensure Service Worker is registered and active
  const registration = await registerServiceWorker();

  // 3. Obtain VAPID public key
  const vapidKey = await getVapidPublicKey();
  const applicationServerKey = urlBase64ToUint8Array(vapidKey);

  // 4. Force-clear any existing stale subscription.
  //    If a subscription was created with a different VAPID key (e.g. after key rotation or
  //    switching environments), re-using the stale endpoint causes a "Registration failed -
  //    push service error" on subscribe and 410 Gone on send. Unsubscribing first ensures
  //    the browser requests a fresh endpoint from the push service with the correct VAPID key.
  const existingSubscription = await registration.pushManager.getSubscription();
  if (existingSubscription) {
    try {
      await existingSubscription.unsubscribe();
    } catch (unsubErr) {
      // Non-fatal: if stale unsubscribe fails, attempt fresh subscribe anyway.
      console.warn('[pushManager] Stale subscription unsubscribe failed (non-fatal):', unsubErr.message);
    }
  }

  // 5. Create a fresh push subscription with the current VAPID key
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey,
  });

  // 6. Serialize subscription data
  const rawSub = subscription.toJSON();
  const payload = {
    endpoint: subscription.endpoint,
    expirationTime: subscription.expirationTime,
    keys: {
      p256dh: rawSub.keys?.p256dh,
      auth: rawSub.keys?.auth,
    },
    deviceInfo: {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
    },
  };

  // 7. Synchronize with backend API
  await apiClient.post('/push/subscribe', payload);

  return subscription;
}

/**
 * Unsubscribes the current device from Web Push notifications.
 *
 * 1. Unregisters subscription with browser PushManager.
 * 2. Informs backend to delete/deactivate subscription record.
 *
 * @returns {Promise<boolean>}
 */
export async function unsubscribeFromPush() {
  if (!isPushSupported()) return true;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();

      // Notify backend to remove record
      try {
        await apiClient.post('/push/unsubscribe', { endpoint });
      } catch (err) {
        console.warn('[pushManager] Backend unsubscribe notification failed:', err.message);
      }
    }

    return true;
  } catch (err) {
    console.error('[pushManager] Unsubscribe failed:', err.message);
    throw err;
  }
}

/**
 * Sends a test push notification to verify delivery on this device.
 * @returns {Promise<any>}
 */
export async function sendTestPushNotification() {
  const res = await apiClient.post('/push/test');
  return res.data;
}
