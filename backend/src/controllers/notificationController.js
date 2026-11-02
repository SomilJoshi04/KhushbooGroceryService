/**
 * Notification Controller — Production REST API for Notifications.
 *
 * Implements:
 * - Backend-driven pagination with skip/limit and count queries.
 * - Strict RBAC and IDOR protection (Customer cannot access Admin or another Customer's data).
 * - Real-time unread count caching and aggregation.
 * - Reversible soft deletion / dismissal.
 *
 * @module controllers/notificationController
 */

import mongoose from 'mongoose';
import { Notification } from '../models/Notification.js';
import {
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../services/notificationService.js';

/**
 * Builds base MongoDB query filter based on authenticated user's role and requested filters.
 *
 * @param {Object} user - Authenticated user from requireAuth middleware
 * @param {Object} queryParams - Query parameters from request
 * @returns {Object} MongoDB filter object
 */
function buildNotificationFilter(user, queryParams = {}) {
  const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'STAFF'].includes(user.role);
  const { filter = 'all', category } = queryParams;

  const baseFilter = {
    isDeleted: false,
  };

  // Enforce role isolation
  if (isAdmin) {
    baseFilter.$or = [
      { recipientId: user._id },
      { recipientRole: 'ALL_ADMINS' },
    ];
  } else {
    baseFilter.$or = [
      { recipientId: user._id },
      { recipientRole: 'ALL_CUSTOMERS' },
    ];
  }

  // Filter by read/unread status
  if (filter === 'unread') {
    baseFilter.isRead = false;
  } else if (filter === 'read') {
    baseFilter.isRead = true;
  }

  // Filter by functional category
  if (category && category !== 'ALL') {
    baseFilter.category = category.toUpperCase().trim();
  }

  return baseFilter;
}

/**
 * GET /api/v1/notifications
 * Retrieves paginated notifications for the authenticated user/admin.
 */
export async function getNotifications(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const filter = buildNotificationFilter(req.user, req.query);

    const [notifications, totalRecords, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments(filter),
      getUnreadNotificationCount(req.user),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalRecords / limit));

    res.json({
      success: true,
      requestId: req.id,
      data: {
        notifications,
        pagination: {
          currentPage: page,
          pageSize: limit,
          totalRecords,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
        unreadCount,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/notifications/unread-count
 * Returns the live count of unread notifications for the authenticated user.
 */
export async function getUnreadCount(req, res, next) {
  try {
    const unreadCount = await getUnreadNotificationCount(req.user);

    res.json({
      success: true,
      requestId: req.id,
      data: {
        unreadCount,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/notifications/:id/read
 * Marks a single notification as read with strict ownership verification.
 */
export async function markAsRead(req, res, next) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: 'Invalid notification identifier.',
      });
    }

    const updated = await markNotificationAsRead(id, req.user);

    if (!updated) {
      return res.status(404).json({
        success: false,
        requestId: req.id,
        message: 'Notification not found or access denied.',
      });
    }

    const unreadCount = await getUnreadNotificationCount(req.user);

    res.json({
      success: true,
      requestId: req.id,
      message: 'Notification marked as read.',
      data: {
        notification: updated,
        unreadCount,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/notifications/mark-all-read
 * Marks all notifications matching user's permissions as read.
 */
export async function markAllRead(req, res, next) {
  try {
    const result = await markAllNotificationsAsRead(req.user);

    res.json({
      success: true,
      requestId: req.id,
      message: `${result.modifiedCount} notification(s) marked as read.`,
      data: {
        modifiedCount: result.modifiedCount,
        unreadCount: 0,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/notifications/:id
 * Dismisses / soft-deletes a notification with strict ownership verification.
 */
export async function deleteNotification(req, res, next) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: 'Invalid notification identifier.',
      });
    }

    const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'STAFF'].includes(req.user.role);
    const query = { _id: id, isDeleted: false };

    if (isAdmin) {
      query.$or = [{ recipientId: req.user._id }, { recipientRole: 'ALL_ADMINS' }];
    } else {
      query.$or = [{ recipientId: req.user._id }, { recipientRole: 'ALL_CUSTOMERS' }];
    }

    const notification = await Notification.findOne(query);
    if (!notification) {
      return res.status(404).json({
        success: false,
        requestId: req.id,
        message: 'Notification not found or access denied.',
      });
    }

    notification.isDeleted = true;
    notification.deletedAt = new Date();
    await notification.save();

    const unreadCount = await getUnreadNotificationCount(req.user);

    res.json({
      success: true,
      requestId: req.id,
      message: 'Notification dismissed successfully.',
      data: {
        unreadCount,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/notifications/clear-all
 * Dismisses all read notifications for the current authenticated user.
 */
export async function clearReadNotifications(req, res, next) {
  try {
    const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'STAFF'].includes(req.user.role);
    const query = { isDeleted: false, isRead: true };

    if (isAdmin) {
      query.$or = [{ recipientId: req.user._id }, { recipientRole: 'ALL_ADMINS' }];
    } else {
      query.$or = [{ recipientId: req.user._id }, { recipientRole: 'ALL_CUSTOMERS' }];
    }

    const result = await Notification.updateMany(query, {
      $set: { isDeleted: true, deletedAt: new Date() },
    });

    const unreadCount = await getUnreadNotificationCount(req.user);

    res.json({
      success: true,
      requestId: req.id,
      message: `${result.modifiedCount || 0} read notification(s) cleared.`,
      data: {
        modifiedCount: result.modifiedCount || 0,
        unreadCount,
      },
    });
  } catch (err) {
    next(err);
  }
}

export const clearAllRead = clearReadNotifications;
export const markRead = markAsRead;

