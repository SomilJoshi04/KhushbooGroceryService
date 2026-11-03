/**
 * Sound Manager — Production Real-Time Notification Sound Controls.
 *
 * Implements:
 * - Single verified audio asset reuse (`/notificationSound.mp3`).
 * - Role-specific event eligibility filter (Admin vs Customer).
 * - Master global admin control + personal opt-out evaluation.
 * - Cooldown enforcement (configurable, default 3s).
 * - Multi-tab deduplication via BroadcastChannel (with localStorage fallback).
 * - Graceful browser autoplay policy handling (NotAllowedError catching & user unlock).
 *
 * @module utils/soundManager
 */

const AUDIO_SRC = '/notificationSound.mp3';

let audioInstance = null;
let lastPlayedCustomerTimestamp = 0;
let lastPlayedAdminTimestamp = 0;
const playedNotificationIds = new Set();
let isAudioUnlocked = false;

// Multi-tab coordination channel with role-based scope isolation
let soundBroadcastChannel = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    soundBroadcastChannel = new BroadcastChannel('khushboo_sound_sync');
    soundBroadcastChannel.onmessage = (event) => {
      if (event?.data?.type === 'SOUND_PLAYED') {
        const { id, timestamp, scope } = event.data;
        if (id) playedNotificationIds.add(id);

        const isCurrentAdmin =
          typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');

        // Only synchronize cooldown if the broadcast originated from the same role scope
        if (scope === 'ADMIN') {
          if (typeof timestamp === 'number' && timestamp > lastPlayedAdminTimestamp) {
            lastPlayedAdminTimestamp = timestamp;
          }
        } else {
          // Scope is CUSTOMER
          if (typeof timestamp === 'number' && timestamp > lastPlayedCustomerTimestamp) {
            lastPlayedCustomerTimestamp = timestamp;
          }
        }
      }
    };
  } catch (err) {
    console.warn('[soundManager] BroadcastChannel initialization skipped:', err.message);
  }
} else if (typeof window !== 'undefined') {
  // Fallback for browsers without BroadcastChannel
  window.addEventListener('storage', (event) => {
    if (event.key === 'khushboo_sound_sync' && event.newValue) {
      try {
        const parsed = JSON.parse(event.newValue);
        if (parsed.id) playedNotificationIds.add(parsed.id);
        if (parsed.scope === 'ADMIN') {
          if (typeof parsed.timestamp === 'number' && parsed.timestamp > lastPlayedAdminTimestamp) {
            lastPlayedAdminTimestamp = parsed.timestamp;
          }
        } else {
          if (typeof parsed.timestamp === 'number' && parsed.timestamp > lastPlayedCustomerTimestamp) {
            lastPlayedCustomerTimestamp = parsed.timestamp;
          }
        }
      } catch {}
    }
  });
}

/**
 * Initializes or retrieves the singleton Audio object.
 */
function getAudioInstance() {
  if (!audioInstance && typeof window !== 'undefined') {
    try {
      audioInstance = new Audio(AUDIO_SRC);
      audioInstance.preload = 'auto';
    } catch (err) {
      console.warn('[soundManager] Failed to initialize Audio object:', err.message);
    }
  }
  return audioInstance;
}

// Attaches user interaction listeners to unlock audio playback.
let audioCtx = null;
let autoplayBlocked = false;

function unlockWebAudioEngine() {
  if (typeof window === 'undefined') return;

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      if (!audioCtx) {
        audioCtx = new AudioContextClass();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
    }
  } catch {}

  try {
    const audio = getAudioInstance();
    if (audio) {
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            audio.pause();
            audio.currentTime = 0;
            isAudioUnlocked = true;
            if (autoplayBlocked) {
              autoplayBlocked = false;
              window.dispatchEvent(new CustomEvent('khushboo:audio_blocked', { detail: { blocked: false } }));
            }
          })
          .catch(() => {
            // Still locked
          });
      }
    }
  } catch {}
}

/**
 * Attaches user interaction listeners to unlock audio playback.
 */
export function initializeAudioUnlock() {
  if (typeof window === 'undefined' || isAudioUnlocked) return;

  const unlock = () => {
    isAudioUnlocked = true;
    unlockWebAudioEngine();
    window.removeEventListener('click', unlock);
    window.removeEventListener('keydown', unlock);
    window.removeEventListener('touchstart', unlock);
    window.removeEventListener('pointerdown', unlock);
  };

  window.addEventListener('click', unlock, { once: true, passive: true });
  window.addEventListener('keydown', unlock, { once: true, passive: true });
  window.addEventListener('touchstart', unlock, { once: true, passive: true });
  window.addEventListener('pointerdown', unlock, { once: true, passive: true });
}

/**
 * Programmatically unlocks audio via direct user interaction button/pill.
 */
export async function unlockAudioWithInteraction() {
  isAudioUnlocked = true;
  unlockWebAudioEngine();
  try {
    const audio = getAudioInstance();
    if (audio) {
      audio.currentTime = 0;
      audio.volume = 1.0;
      await audio.play();
      autoplayBlocked = false;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('khushboo:audio_blocked', { detail: { blocked: false } }));
      }
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Determines if a notification is eligible to produce sound based on recipient role.
 *
 * @param {Object} notification
 * @param {string} userRole - 'ADMIN', 'SUPER_ADMIN', 'STAFF', 'CUSTOMER'
 * @returns {boolean}
 */
export function isNotificationSoundEligible(notification, userRole = 'CUSTOMER') {
  if (!notification || !notification.type) return false;

  const type = String(notification.type).toUpperCase();
  const category = String(notification.category || '').toUpperCase();
  const recipientRole = String(notification.recipientRole || '').toUpperCase();

  // Promotional or catalog announcements are strictly silent
  if (category === 'PROMOTION' || category === 'CATALOG') {
    return false;
  }
  if (
    type === 'PRODUCT_PUBLISHED' ||
    type === 'CATEGORY_PUBLISHED' ||
    type === 'BANNER_PUBLISHED' ||
    type === 'COUPON_PUBLISHED'
  ) {
    return false;
  }

  const roleUpper = String(userRole || '').toUpperCase();
  const isOnAdminPath = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');
  const isAdmin =
    ['ADMIN', 'SUPER_ADMIN', 'STAFF'].includes(roleUpper) ||
    recipientRole === 'ALL_ADMINS' ||
    isOnAdminPath;

  if (isAdmin) {
    // Admin sound events: incoming customer orders, inquiries, cancellations, verified payments, low stock alerts
    const eligibleAdminTypes = [
      'ORDER_CREATED',
      'ORDER_CANCEL_REQUESTED',
      'SUPPORT_TICKET_CREATED',
      'SUPPORT_MESSAGE_RECEIVED',
      'PAYMENT_VERIFIED',
      'LOW_STOCK_ALERT',
      'OUT_OF_STOCK_ALERT',
    ];
    return eligibleAdminTypes.includes(type);
  }

  // Customer sound events: order status updates (CONFIRMED, PROCESSING, OUT_FOR_DELIVERY, DELIVERED),
  // cancellations, refunds, support replies. ORDER_CREATED is silent for the placing customer
  // because checkout already displays success UI, preventing annoying self-alerts.
  const eligibleCustomerTypes = [
    'ORDER_STATUS_UPDATED',
    'ORDER_CANCELLED',
    'PAYMENT_REFUNDED',
    'SUPPORT_TICKET_REPLIED',
    'SUPPORT_TICKET_STATUS_UPDATED',
  ];

  return eligibleCustomerTypes.includes(type);
}

/**
 * Plays the notification sound with full cooldown, deduplication, and permissions enforcement.
 *
 * @param {Object} options
 * @param {Object} options.notification - Incoming notification payload
 * @param {string} options.userRole - Recipient role
 * @param {boolean} [options.globalSoundEnabled=true] - Master admin setting
 * @param {boolean} [options.userSoundEnabled=true] - Personal opt-out preference
 * @param {number} [options.cooldownSeconds=3] - Minimum cooldown between audio plays
 * @returns {Promise<boolean>} True if sound was played, false otherwise
 */
export async function playNotificationSound({
  notification,
  userRole = 'CUSTOMER',
  globalSoundEnabled = true,
  userSoundEnabled = true,
  cooldownSeconds = 3,
} = {}) {
  // 1. Master global setting & personal user preference check
  if (!globalSoundEnabled || userSoundEnabled === false) {
    return false;
  }

  // 2. Event eligibility check
  if (!isNotificationSoundEligible(notification, userRole)) {
    return false;
  }

  // 3. Deduplication check: do not play sound for the same notification ID twice
  const notifId = notification._id || notification.id;
  if (notifId && playedNotificationIds.has(String(notifId))) {
    return false;
  }

  const roleUpper = String(userRole || '').toUpperCase();
  const recipientRole = String(notification?.recipientRole || '').toUpperCase();
  const isOnAdminPath = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');
  const isAdmin =
    ['ADMIN', 'SUPER_ADMIN', 'STAFF'].includes(roleUpper) ||
    recipientRole === 'ALL_ADMINS' ||
    isOnAdminPath;

  const currentScope = isAdmin ? 'ADMIN' : 'CUSTOMER';
  const relevantLastTimestamp = isAdmin ? lastPlayedAdminTimestamp : lastPlayedCustomerTimestamp;

  // 4. Cooldown check: prevent rapid repeated sound spamming within the same scope
  const now = Date.now();
  const cooldownMs = (Math.max(1, cooldownSeconds) || 3) * 1000;
  if (now - relevantLastTimestamp < cooldownMs) {
    // Register ID so this notification is marked accounted for, without playing sound
    if (notifId) playedNotificationIds.add(String(notifId));
    return false;
  }

  // 5. Play audio safely with fallback recovery
  try {
    const audio = getAudioInstance();
    if (!audio) return false;

    try {
      audio.currentTime = 0;
      audio.volume = 1.0;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        await playPromise;
      }
    } catch (playErr) {
      if (playErr.name === 'NotAllowedError') {
        throw playErr;
      }
      // On interrupted or stalled element, attempt recovery via fresh instance
      const freshAudio = new Audio(AUDIO_SRC);
      freshAudio.volume = 1.0;
      await freshAudio.play();
    }

    if (isAdmin) {
      lastPlayedAdminTimestamp = now;
    } else {
      lastPlayedCustomerTimestamp = now;
    }

    if (notifId) {
      playedNotificationIds.add(String(notifId));
      // Cap memory size
      if (playedNotificationIds.size > 200) {
        const oldestKeys = Array.from(playedNotificationIds).slice(0, 50);
        oldestKeys.forEach((k) => playedNotificationIds.delete(k));
      }
    }

    // 6. Broadcast to peer tabs with role scope to prevent cross-role muting
    try {
      const syncPayload = { type: 'SOUND_PLAYED', id: notifId, timestamp: now, scope: currentScope };
      if (soundBroadcastChannel) {
        soundBroadcastChannel.postMessage(syncPayload);
      } else if (typeof window !== 'undefined') {
        localStorage.setItem('khushboo_sound_sync', JSON.stringify(syncPayload));
      }
    } catch {}

    return true;
  } catch (err) {
    if (err.name === 'NotAllowedError') {
      autoplayBlocked = true;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('khushboo:audio_blocked', { detail: { blocked: true } }));
      }
      console.warn('[soundManager] Autoplay was prevented by browser policy. User interaction required to unlock audio.');
    } else {
      console.warn('[soundManager] Audio playback error:', err.message);
    }
    return false;
  }
}

/**
 * Manually tests sound playback (used by Admin Settings "Test Sound" button).
 * Always bypasses cooldown and eligibility checks.
 *
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function testNotificationSound() {
  try {
    const audio = getAudioInstance();
    if (!audio) {
      return { success: false, message: 'Audio API unavailable in this browser environment.' };
    }

    audio.currentTime = 0;
    await audio.play();
    isAudioUnlocked = true;
    return { success: true, message: 'Notification sound played successfully.' };
  } catch (err) {
    if (err.name === 'NotAllowedError') {
      return {
        success: false,
        message: 'Browser autoplay blocked. Please click anywhere on the page to grant audio permission and retry.',
      };
    }
    return { success: false, message: err.message || 'Failed to play audio.' };
  }
}

