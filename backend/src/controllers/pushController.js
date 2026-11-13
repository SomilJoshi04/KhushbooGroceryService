/**
 * Push Controller — Browser Web Push Subscriptions & VAPID Key Endpoints.
 *
 * Implements:
 * - Public VAPID public-key retrieval (never exposing private keys).
 * - Authenticated push subscription upsert (bound to authenticated user & role).
 * - Explicit unsubscribe handler.
 * - Current subscription status check.
 * - Test push delivery handler for user verification.
 *
 * @module controllers/pushController
 */

import { env } from '../config/env.js';
import { PushSubscription } from '../models/PushSubscription.js';
import { sendPushToUser, buildPushPayload } from '../services/pushNotificationService.js';
import { encryptKey } from '../utils/pushCrypto.js';

/**
 * Validates endpoint URL strictly to ensure it is HTTPS and from valid push services.
 * @param {string} endpoint
 * @returns {boolean}
 */
function isValidPushEndpoint(endpoint) {
  if (!endpoint || typeof endpoint !== 'string') return false;
  try {
    const url = new URL(endpoint);
    // Allow https and in development http for localhost
    if (url.protocol === 'https:') return true;
    if (env.NODE_ENV === 'development' && url.hostname === 'localhost') return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * GET /api/v1/push/vapid-public-key
 * Returns the VAPID public key for frontend subscription initialization.
 * Cache-Control: no-store prevents 304 Not Modified responses that would return
 * an empty body — the frontend must always receive the full JSON payload.
 */
export async function getVapidPublicKey(req, res) {
  if (!env.VAPID_PUBLIC_KEY) {
    return res.status(503).json({
      success: false,
      message: 'Web push is currently unavailable: VAPID public key not configured.',
    });
  }

  // Prevent browser/proxy caching — the VAPID key must always be returned as a full response.
  // A cached 304 would result in an empty body, breaking key derivation on the client.
  if (typeof res.set === 'function') {
    res.set('Cache-Control', 'no-store');
  } else if (typeof res.setHeader === 'function') {
    res.setHeader('Cache-Control', 'no-store');
  }

  return res.status(200).json({
    success: true,
    publicKey: env.VAPID_PUBLIC_KEY,
  });
}

/**
 * POST /api/v1/push/subscribe
 * Registers or updates a browser push subscription for the authenticated user.
 */
export async function subscribe(req, res) {
  try {
    const { endpoint, keys, expirationTime, deviceInfo } = req.body || {};

    if (!endpoint || !isValidPushEndpoint(endpoint)) {
      return res.status(400).json({
        success: false,
        message: 'A valid HTTPS push service endpoint URL is required.',
      });
    }

    if (!keys || !keys.p256dh || !keys.auth) {
      return res.status(400).json({
        success: false,
        message: 'Push subscription encryption keys (p256dh and auth) are required.',
      });
    }

    if (typeof keys.p256dh !== 'string' || keys.p256dh.length < 10 || keys.p256dh.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Invalid p256dh public key format.',
      });
    }

    if (typeof keys.auth !== 'string' || keys.auth.length < 10 || keys.auth.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Invalid auth secret format.',
      });
    }

    const userId = req.user._id;
    const userRole = req.user.role || 'CUSTOMER';

    const safeDeviceInfo = {
      userAgent: (deviceInfo?.userAgent || req.headers['user-agent'] || '').slice(0, 300),
      platform: (deviceInfo?.platform || '').slice(0, 50),
      browser: (deviceInfo?.browser || '').slice(0, 50),
    };

    let safeExpirationTime = null;
    if (expirationTime) {
      const parsedDate = new Date(expirationTime);
      if (!isNaN(parsedDate.getTime())) {
        safeExpirationTime = parsedDate;
      }
    }

    const encP256dh = encryptKey(keys.p256dh);
    const encAuth = encryptKey(keys.auth);

    // Atomic upsert by endpoint: ensures zero race conditions and robust handling of device re-registration
    await PushSubscription.findOneAndUpdate(
      { endpoint },
      {
        $set: {
          userId,
          role: userRole,
          endpoint,
          keys: {
            p256dh: encP256dh,
            auth: encAuth,
          },
          expirationTime: safeExpirationTime,
          deviceInfo: safeDeviceInfo,
          isActive: true,
          failureCount: 0,
        },
      },
      { upsert: true, new: true, runValidators: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Browser push notifications enabled successfully.',
    });
  } catch (err) {
    console.error('[pushController] subscribe error:', err);
    return res.status(500).json({
      success: false,
      message: `Failed to save push notification subscription: ${err.message}`,
      error: err.message,
    });
  }
}

/**
 * POST /api/v1/push/unsubscribe
 * Deactivates or removes a push subscription for the authenticated user.
 */
export async function unsubscribe(req, res) {
  try {
    const { endpoint } = req.body || {};

    if (!endpoint) {
      return res.status(400).json({
        success: false,
        message: 'Subscription endpoint is required to unsubscribe.',
      });
    }

    const userId = req.user._id;

    // Delete or mark inactive for this user
    await PushSubscription.deleteOne({
      endpoint,
      userId,
    });

    return res.status(200).json({
      success: true,
      message: 'Browser push notifications disabled successfully.',
    });
  } catch (err) {
    console.error('[pushController] unsubscribe error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to disable push notification subscription.',
    });
  }
}

/**
 * GET /api/v1/push/status
 * Checks if the current user has any active push subscriptions.
 */
export async function getSubscriptionStatus(req, res) {
  try {
    const userId = req.user._id;
    const { endpoint } = req.query;

    const filter = { userId, isActive: true };
    if (endpoint) {
      filter.endpoint = endpoint;
    }

    const count = await PushSubscription.countDocuments(filter);

    return res.status(200).json({
      success: true,
      isSubscribed: count > 0,
      activeSubscriptionsCount: count,
    });
  } catch (err) {
    console.error('[pushController] getSubscriptionStatus error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to query push subscription status.',
    });
  }
}

/**
 * POST /api/v1/push/test
 * Sends an immediate test push notification to the authenticated user's registered devices.
 */
export async function sendTestPush(req, res) {
  try {
    const userId = req.user._id;
    const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'STAFF'].includes(req.user.role);

    const testPayload = buildPushPayload({
      title: 'Khushboo Food Service',
      message: isAdmin
        ? '🔔 Admin Web Push is active! You will receive instant order notifications.'
        : '🛒 Web Push is active! You will receive real-time updates for your grocery orders.',
      actionUrl: isAdmin ? '/admin/orders' : '/orders',
      type: 'SYSTEM_ALERT',
      category: 'SYSTEM',
    });

    const delivered = await sendPushToUser(userId, testPayload);

    return res.status(200).json({
      success: true,
      delivered,
      message: delivered > 0
        ? `Test notification delivered to ${delivered} device(s).`
        : 'No active push subscriptions found or delivery pending.',
    });
  } catch (err) {
    console.error('[pushController] sendTestPush error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to send test push notification.',
    });
  }
}

