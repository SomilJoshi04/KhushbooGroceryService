/**
 * Web Push Notification Service — Browser Push Dispatcher with VAPID Authentication.
 *
 * Implements:
 * - Direct VAPID signing via maintained Node.js `web-push` package.
 * - Automatic subscription lifecycle: deletes 404 / 410 Gone subscriptions.
 * - Non-blocking execution: push dispatch failure never throws or breaks upstream business flows.
 * - Multi-device dispatch per user and role-based broadcast to active admin sessions.
 * - Zero PII / secret payload construction with internal action deep-links.
 * - Deduplication via stable notificationId and tag.
 *
 * @module services/pushNotificationService
 */

import webpush from 'web-push';
import { env } from '../config/env.js';
import { PushSubscription } from '../models/PushSubscription.js';

// Initialize VAPID credentials strictly from validated environment variables
let isVapidConfigured = false;
try {
  if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT) {
    webpush.setVapidDetails(
      env.VAPID_SUBJECT,
      env.VAPID_PUBLIC_KEY,
      env.VAPID_PRIVATE_KEY
    );
    isVapidConfigured = true;
  } else {
    console.warn('[pushService] ⚠️ VAPID keys not fully configured in environment. Web Push will run in mock/inert mode.');
  }
} catch (err) {
  console.error('[pushService] ❌ Failed to configure VAPID details:', err.message);
}

/**
 * Normalizes an internal action URL to a safe relative path.
 * Disallows external open redirects (e.g. javascript:, http:, //).
 *
 * @param {string} rawUrl
 * @returns {string} Safe root-relative URL
 */
function sanitizeActionUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '/';
  const trimmed = rawUrl.trim();
  // If it starts with a single slash and not double slash (//evil.com), keep it
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }
  return '/';
}

/**
 * Formats a clean, safe payload for browser push delivery.
 *
 * @param {Object} options
 * @param {string} options.title - Notification title
 * @param {string} options.message - Notification message / body
 * @param {string} [options.actionUrl='/'] - Relative route to navigate on click
 * @param {string} [options.notificationId=''] - Stable database ID for deduplication
 * @param {string} [options.tag=''] - Collapsing tag
 * @param {string} [options.type='SYSTEM'] - Business event type
 * @param {string} [options.category='SYSTEM'] - Event category
 * @returns {string} JSON string payload
 */
export function buildPushPayload({
  title,
  message,
  actionUrl = '/',
  notificationId = '',
  tag = '',
  type = 'SYSTEM',
  category = 'SYSTEM',
}) {
  const safeUrl = sanitizeActionUrl(actionUrl);
  const stableTag = tag || (notificationId ? `khushboo-${notificationId}` : `khushboo-${Date.now()}`);

  const payload = {
    title: (title || 'Khushboo Food Service').trim(),
    body: (message || '').trim(),
    icon: '/websiteLogo.png',
    badge: '/favicon.svg',
    tag: stableTag,
    url: safeUrl,
    notificationId: notificationId ? notificationId.toString() : '',
    type,
    category,
    timestamp: Date.now(),
    data: {
      actionUrl: safeUrl,
      notificationId: notificationId ? notificationId.toString() : '',
      type,
      category,
    },
  };

  return JSON.stringify(payload);
}

/**
 * Sends a push notification to a single PushSubscription document.
 * Automatically cleans up expired or invalidated (404/410) subscriptions.
 *
 * @param {import('../models/PushSubscription.js').PushSubscription} subscriptionDoc
 * @param {string} jsonPayload
 * @returns {Promise<boolean>} Whether delivery succeeded
 */
export async function sendPushToSubscription(subscriptionDoc, jsonPayload) {
  if (!isVapidConfigured) {
    return false;
  }

  const sub = subscriptionDoc.toDecryptedSubscription();
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: sub.keys,
      },
      jsonPayload,
      {
        TTL: 60 * 60 * 24, // 24 hours TTL
        urgency: 'high',
      }
    );

    // Update delivery telemetry on success
    subscriptionDoc.lastSuccessfulSendAt = new Date();
    subscriptionDoc.failureCount = 0;
    await subscriptionDoc.save().catch(() => {});
    return true;
  } catch (err) {
    const statusCode = err.statusCode || err.status;
    const isGone = statusCode === 404 || statusCode === 410;

    if (isGone) {
      console.info(`[pushService] Subscription endpoint has expired or unsubscribed (${statusCode}). Removing: ${sub.endpoint.slice(0, 40)}...`);
      // Delete stale subscription permanently so we don't spam invalid endpoints
      await PushSubscription.deleteOne({ _id: subscriptionDoc._id }).catch(() => {});
    } else {
      console.warn(`[pushService] Push delivery warning (${statusCode || err.message}) for user ${subscriptionDoc.userId}`);
      subscriptionDoc.lastFailureAt = new Date();
      subscriptionDoc.failureCount = (subscriptionDoc.failureCount || 0) + 1;
      // If repeatedly failing (e.g. > 10 consecutive failures), mark inactive
      if (subscriptionDoc.failureCount >= 10) {
        subscriptionDoc.isActive = false;
      }
      await subscriptionDoc.save().catch(() => {});
    }
    return false;
  }
}

/**
 * Dispatches a push notification to all active devices for a specific user.
 * Non-blocking: will never reject or crash the caller.
 *
 * @param {string|import('mongoose').Types.ObjectId} userId
 * @param {Object} notificationData
 * @returns {Promise<number>} Number of successful deliveries
 */
export async function sendPushToUser(userId, notificationData) {
  if (!isVapidConfigured || !userId) return 0;

  try {
    const subscriptions = await PushSubscription.find({
      userId,
      isActive: true,
    });

    if (!subscriptions.length) return 0;

    const payload = typeof notificationData === 'string'
      ? notificationData
      : buildPushPayload(notificationData);

    let deliveredCount = 0;
    await Promise.all(
      subscriptions.map(async (sub) => {
        const ok = await sendPushToSubscription(sub, payload);
        if (ok) deliveredCount++;
      })
    );

    return deliveredCount;
  } catch (err) {
    console.error(`[pushService] sendPushToUser error: ${err.message}`);
    return 0;
  }
}

/**
 * Dispatches a push notification to all active administrative users (ADMIN, SUPER_ADMIN, STAFF).
 * Non-blocking.
 *
 * @param {Object} notificationData
 * @returns {Promise<number>} Number of successful deliveries
 */
export async function sendPushToAdmins(notificationData) {
  if (!isVapidConfigured) return 0;

  try {
    const subscriptions = await PushSubscription.find({
      role: { $in: ['ADMIN', 'SUPER_ADMIN', 'STAFF'] },
      isActive: true,
    });

    if (!subscriptions.length) return 0;

    const payload = typeof notificationData === 'string'
      ? notificationData
      : buildPushPayload(notificationData);

    let deliveredCount = 0;
    await Promise.all(
      subscriptions.map(async (sub) => {
        const ok = await sendPushToSubscription(sub, payload);
        if (ok) deliveredCount++;
      })
    );

    return deliveredCount;
  } catch (err) {
    console.error(`[pushService] sendPushToAdmins error: ${err.message}`);
    return 0;
  }
}

/**
 * Dispatches push notification based on a created in-app Notification model instance.
 * Automatically resolves recipient audience (user vs admins vs broadcast).
 *
 * @param {import('../models/Notification.js').Notification} notification
 * @returns {Promise<void>}
 */
export async function dispatchPushForNotification(notification) {
  if (!notification || !isVapidConfigured) return;

  const pushPayloadOptions = {
    title: notification.title,
    message: notification.message,
    actionUrl: notification.actionUrl || '/',
    notificationId: notification._id.toString(),
    tag: `khushboo-${notification._id.toString()}`,
    type: notification.type,
    category: notification.category,
  };

  try {
    if (notification.recipientRole === 'ALL_ADMINS') {
      await sendPushToAdmins(pushPayloadOptions);
    } else if (notification.recipientId) {
      await sendPushToUser(notification.recipientId, pushPayloadOptions);
    }
  } catch (err) {
    console.warn(`[pushService] dispatchPushForNotification warning: ${err.message}`);
  }
}

