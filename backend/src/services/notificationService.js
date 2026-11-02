/**
 * Notification Service — Business Event Notification Dispatcher & Persistence Manager.
 *
 * Implements:
 * - Durable persistence in MongoDB before real-time delivery attempt.
 * - Idempotency deduplication to prevent duplicate notifications for repeated business events.
 * - Targeted Socket.IO emission to customer rooms or administrative rooms.
 * - Zero token or sensitive PII exposure in socket emissions.
 * - Offline safety: recipients disconnected from WebSocket will receive all notifications upon reconnecting or querying REST APIs.
 *
 * @module services/notificationService
 */

import { Notification } from '../models/Notification.js';
import { emitToUser, emitToAdmins, emitToAll } from '../socket.js';

/**
 * Creates, persists, and delivers a notification.
 *
 * @param {Object} options
 * @param {string|import('mongoose').Types.ObjectId|null} [options.recipientId=null] - Specific target user
 * @param {string} [options.recipientRole='CUSTOMER'] - 'CUSTOMER', 'ADMIN', 'ALL_ADMINS', 'ALL_CUSTOMERS'
 * @param {string} options.type - Valid notification type
 * @param {string} options.category - 'ORDER', 'SUPPORT', 'CATALOG', 'PROMOTION', 'INVENTORY', 'SYSTEM'
 * @param {string} options.title - Notification title
 * @param {string} options.message - Notification body
 * @param {string} [options.entityType='System'] - 'Order', 'CustomerInquiry', 'Product', 'Category', 'Coupon', 'Banner', 'System'
 * @param {string} [options.entityId=''] - Reference identifier
 * @param {string} [options.actionUrl=''] - Target frontend route
 * @param {Object} [options.metadata={}] - Sanitized additional properties
 * @param {string} [options.idempotencyKey=null] - Unique deduplication key
 * @returns {Promise<import('../models/Notification.js').Notification>}
 */
export async function createNotification({
  recipientId = null,
  recipient = null,
  recipientRole = null,
  recipientGroup = null,
  type,
  category,
  title,
  message,
  entityType = 'System',
  entityId = '',
  actionUrl = '',
  metadata = {},
  idempotencyKey = null,
}) {
  const targetRecipientId = recipientId || recipient || null;
  const targetRecipientRole = recipientRole || recipientGroup || (targetRecipientId ? 'CUSTOMER' : 'ALL_ADMINS');
  let resolvedCategory = category;
  if (!resolvedCategory) {
    if (type?.startsWith('ORDER_') || type?.startsWith('PAYMENT_')) {
      resolvedCategory = 'ORDER';
    } else if (type?.startsWith('SUPPORT_')) {
      resolvedCategory = 'SUPPORT';
    } else if (type?.includes('PRODUCT') || type?.includes('CATEGORY')) {
      resolvedCategory = 'CATALOG';
    } else if (type?.includes('COUPON') || type?.includes('BANNER')) {
      resolvedCategory = 'PROMOTION';
    } else if (type?.includes('STOCK') || type?.includes('INVENTORY')) {
      resolvedCategory = 'INVENTORY';
    } else {
      resolvedCategory = 'SYSTEM';
    }
  }

  try {
    // 1. Idempotency Deduplication Check
    if (idempotencyKey) {
      const existing = await Notification.findOne({ idempotencyKey });
      if (existing) {
        return existing;
      }
    }

    // 2. Sanitize metadata (strictly allowlist safe fields)
    const sanitizedMetadata = {};
    const safeKeys = [
      'orderNumber',
      'ticketNumber',
      'slug',
      'code',
      'sku',
      'stock',
      'amountRupees',
      'status',
      'priority',
      'refundId',
    ];
    if (metadata && typeof metadata === 'object') {
      for (const k of safeKeys) {
        if (metadata[k] !== undefined) {
          sanitizedMetadata[k] = metadata[k];
        }
      }
    }

    // 3. Persist notification in MongoDB (Source of Truth)
    const notification = new Notification({
      recipientId: targetRecipientId,
      recipientRole: targetRecipientRole,
      type,
      category: resolvedCategory,
      title: title.trim(),
      message: message.trim(),
      entityType,
      entityId: entityId ? entityId.toString() : '',
      actionUrl: actionUrl.trim(),
      metadata: sanitizedMetadata,
      idempotencyKey: idempotencyKey || undefined,
    });

    try {
      await notification.save();
    } catch (saveErr) {
      // Handle race condition on unique idempotencyKey index
      if (saveErr.code === 11000 && idempotencyKey) {
        const existing = await Notification.findOne({ idempotencyKey });
        if (existing) return existing;
      }
      throw saveErr;
    }

    // 4. Deliver via Socket.IO after database persistence succeeds
    const safePayload = notification.toSafeObject();

    if (targetRecipientRole === 'ALL_ADMINS') {
      emitToAdmins('notification:new', safePayload);
    } else if (targetRecipientRole === 'ALL_CUSTOMERS') {
      emitToAll('notification:new', safePayload);
    } else if (targetRecipientId) {
      emitToUser(targetRecipientId.toString(), 'notification:new', safePayload);
    }

    return notification;
  } catch (err) {
    console.error(`[notificationService] Failed to create notification: ${err.message}`);
    // Non-blocking: Do not crash the parent business transaction if notification dispatch fails
    return null;
  }
}

/**
 * Calculates current unread count for an authenticated user.
 *
 * @param {Object} user - Authenticated user document
 * @returns {Promise<number>}
 */
export async function getUnreadNotificationCount(user) {
  const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'STAFF'].includes(user.role);

  if (isAdmin) {
    // Admin unread count: specific to admin OR broadcast to all admins
    return Notification.countDocuments({
      isDeleted: false,
      isRead: false,
      $or: [
        { recipientId: user._id },
        { recipientRole: 'ALL_ADMINS' },
      ],
    });
  }

  // Customer unread count: personal notifications OR broadcast customer announcements
  return Notification.countDocuments({
    isDeleted: false,
    isRead: false,
    $or: [
      { recipientId: user._id },
      { recipientRole: 'ALL_CUSTOMERS' },
    ],
  });
}

/**
 * Marks a specific notification as read with strict ownership validation.
 *
 * @param {string} notificationId
 * @param {Object} user
 * @returns {Promise<Object|null>}
 */
export async function markNotificationAsRead(notificationId, user) {
  const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'STAFF'].includes(user.role);

  const query = {
    _id: notificationId,
    isDeleted: false,
  };

  if (isAdmin) {
    query.$or = [{ recipientId: user._id }, { recipientRole: 'ALL_ADMINS' }];
  } else {
    query.$or = [{ recipientId: user._id }, { recipientRole: 'ALL_CUSTOMERS' }];
  }

  const notification = await Notification.findOne(query);
  if (!notification) return null;

  if (!notification.isRead) {
    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();
  }

  return notification.toSafeObject();
}

/**
 * Marks all notifications matching user's permissions as read.
 *
 * @param {Object} user
 * @returns {Promise<{modifiedCount: number}>}
 */
export async function markAllNotificationsAsRead(user) {
  const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'STAFF'].includes(user.role);

  const query = {
    isDeleted: false,
    isRead: false,
  };

  if (isAdmin) {
    query.$or = [{ recipientId: user._id }, { recipientRole: 'ALL_ADMINS' }];
  } else {
    query.$or = [{ recipientId: user._id }, { recipientRole: 'ALL_CUSTOMERS' }];
  }

  const res = await Notification.updateMany(query, {
    $set: { isRead: true, readAt: new Date() },
  });

  return { modifiedCount: res.modifiedCount || 0 };
}

