/**
 * Order Success Sound Manager — Khushboo Food Service.
 *
 * Requirements:
 * - Uses public asset `/zomato_sms.mp3` directly.
 * - Idempotency by order identifier (`order-success-sound:<orderId>`).
 * - Prevents duplicate playback caused by React StrictMode, remounts, route changes, refresh, back/forward.
 * - Gracefully handles browser autoplay restrictions (NotAllowedError).
 * - Independent: audio failures never affect order placement or confirmation.
 *
 * @module utils/orderSuccessSound
 */

export const ORDER_SUCCESS_AUDIO_SRC = '/zomato_sms.mp3';
const IDEMPOTENCY_PREFIX = 'order-success-sound:';

// In-memory sets to guard synchronously against React StrictMode instant re-mounts
const inMemoryPlayedOrders = new Set();
const inMemoryClaimedOrders = new Set();

let audioInstance = null;

/**
 * Normalizes an order reference into a string ID (orderNumber or _id).
 * @param {string|object} order
 * @returns {string|null}
 */
export function extractOrderId(order) {
  if (!order) return null;
  if (typeof order === 'string') {
    const trimmed = order.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof order === 'object') {
    const id = order.orderNumber || order._id || order.id;
    if (id && typeof id === 'string') return id.trim();
  }
  return null;
}

/**
 * Checks whether the confirmed order is genuinely eligible for sound playback.
 * - Valid order identifier required.
 * - Status must NOT be CANCELLED or FAILED.
 * @param {string|object} order
 * @returns {boolean}
 */
export function isValidSuccessfulOrder(order) {
  const orderId = extractOrderId(order);
  if (!orderId) return false;

  if (typeof order === 'object') {
    const status = String(order.orderStatus || order.status || '').toUpperCase();
    if (status === 'CANCELLED' || status === 'FAILED') {
      return false;
    }
  }

  return true;
}

/**
 * Checks whether the sound for this order ID has already been played.
 * Checks both in-memory cache and localStorage persistence.
 * @param {string} orderId
 * @returns {boolean}
 */
export function hasOrderSoundPlayed(orderId) {
  if (!orderId) return false;

  // 1. In-memory check (instant)
  if (inMemoryPlayedOrders.has(orderId)) {
    return true;
  }

  // 2. LocalStorage persistence check (catches refresh & back/forward)
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(`${IDEMPOTENCY_PREFIX}${orderId}`);
      if (stored) {
        inMemoryPlayedOrders.add(orderId);
        return true;
      }
    }
  } catch (_e) {
    // Graceful fallback if localStorage is blocked (e.g. private browsing restrictions)
  }

  return false;
}

/**
 * Synchronously marks an order ID as claimed before async playback completes.
 * Shields against React StrictMode's rapid duplicate effect execution.
 * @param {string} orderId
 */
export function claimOrderSound(orderId) {
  if (orderId) inMemoryClaimedOrders.add(orderId);
}

/**
 * Releases in-memory claim if playback was blocked by browser policy,
 * allowing manual click-to-play fallback.
 * @param {string} orderId
 */
export function unclaimOrderSound(orderId) {
  if (orderId) inMemoryClaimedOrders.delete(orderId);
}

/**
 * Marks the sound for this order ID as successfully played in both memory and storage.
 * @param {string} orderId
 */
export function markOrderSoundPlayed(orderId) {
  if (!orderId) return;

  inMemoryClaimedOrders.delete(orderId);
  inMemoryPlayedOrders.add(orderId);

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(`${IDEMPOTENCY_PREFIX}${orderId}`, String(Date.now()));
    }
  } catch (_e) {
    // Ignore storage quota/permission errors
  }
}

/**
 * Initializes or retrieves the singleton Audio object.
 * Safe for SSR and avoids instantiating new Audio on every render.
 * @returns {HTMLAudioElement|null}
 */
export function getOrderSuccessAudio() {
  if (typeof window === 'undefined') return null;

  if (!audioInstance) {
    try {
      audioInstance = new Audio(ORDER_SUCCESS_AUDIO_SRC);
      audioInstance.preload = 'auto';
      audioInstance.volume = 1.0;

      // Handle loading/media error gracefully without crashing
      audioInstance.addEventListener('error', (e) => {
        if (import.meta.env?.DEV) {
          console.warn('[orderSuccessSound] Audio asset failed to load:', e);
        }
      });
    } catch (err) {
      if (import.meta.env?.DEV) {
        console.warn('[orderSuccessSound] Failed to create Audio instance:', err.message);
      }
      return null;
    }
  }

  return audioInstance;
}

/**
 * Primary function to play the order confirmation sound.
 * Performs full validation and idempotency checking.
 *
 * @param {string|object} order
 * @param {object} [options]
 * @param {boolean} [options.force=false] - Bypass idempotency if triggered manually by user click
 * @returns {Promise<{ success: boolean, reason?: string, error?: Error }>}
 */
export async function playOrderSuccessSound(order, options = {}) {
  const { force = false } = options;

  if (!isValidSuccessfulOrder(order)) {
    return { success: false, reason: 'INVALID_OR_UNCONFIRMED_ORDER' };
  }

  const orderId = extractOrderId(order);

  // Idempotency check: strictly skip if already played
  if (!force && hasOrderSoundPlayed(orderId)) {
    return { success: false, reason: 'ALREADY_PLAYED' };
  }

  // Concurrent execution guard: skip if another async call is actively in-flight
  if (!force && inMemoryClaimedOrders.has(orderId)) {
    return { success: false, reason: 'ALREADY_PLAYED' };
  }

  // Claim synchronously to prevent concurrent / StrictMode async races
  claimOrderSound(orderId);

  const audio = getOrderSuccessAudio();
  if (!audio) {
    unclaimOrderSound(orderId);
    return { success: false, reason: 'AUDIO_UNAVAILABLE' };
  }

  try {
    audio.currentTime = 0;
    const playPromise = audio.play();

    if (playPromise !== undefined) {
      await playPromise;
      markOrderSoundPlayed(orderId);
      return { success: true };
    }

    markOrderSoundPlayed(orderId);
    return { success: true };
  } catch (err) {
    unclaimOrderSound(orderId);
    // Autoplay restrictions are expected on modern browsers
    if (err.name === 'NotAllowedError' || err.name === 'NotSupportedError') {
      return { success: false, reason: 'AUTOPLAY_BLOCKED', error: err };
    }

    if (import.meta.env?.DEV) {
      console.warn('[orderSuccessSound] Playback error:', err.message);
    }
    return { success: false, reason: 'PLAYBACK_ERROR', error: err };
  }
}

/**
 * Testing helper: resets the singleton audio instance and in-memory caches.
 */
export function _resetAudioInstanceForTesting() {
  audioInstance = null;
  inMemoryPlayedOrders.clear();
  inMemoryClaimedOrders.clear();
}
