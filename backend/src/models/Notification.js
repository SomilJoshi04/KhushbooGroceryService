/**
 * Notification Model — Production Real-Time & Persistent Notifications.
 *
 * Implements:
 * - Scoped recipients: individual customer, specific admin, or broadcast groups (ALL_ADMINS, ALL_CUSTOMERS).
 * - Categorized events: ORDER, SUPPORT, CATALOG, PROMOTION, INVENTORY, SYSTEM.
 * - Idempotency deduplication key with unique sparse indexing to guarantee effectively-once creation.
 * - Granular read tracking (isRead, readAt) and soft deletion for audit preservation.
 * - Compound indexes optimized for low-latency pagination and unread counts.
 * - Configurable automated retention cleanup.
 *
 * @module models/Notification
 */

import mongoose from 'mongoose';

const NOTIFICATION_TYPES = [
  // Customer events (destined for Admins)
  'ORDER_CREATED',
  'ORDER_CANCEL_REQUESTED',
  'SUPPORT_TICKET_CREATED',
  'SUPPORT_MESSAGE_RECEIVED',
  'PAYMENT_VERIFIED',

  // Admin events (destined for Customers)
  'ORDER_STATUS_UPDATED',
  'ORDER_CANCELLED',
  'PAYMENT_REFUNDED',
  'SUPPORT_TICKET_REPLIED',
  'SUPPORT_TICKET_STATUS_UPDATED',
  'PRODUCT_PUBLISHED',
  'CATEGORY_PUBLISHED',
  'COUPON_PUBLISHED',
  'BANNER_PUBLISHED',

  // System & Inventory alerts (destined for Admins)
  'LOW_STOCK_ALERT',
  'OUT_OF_STOCK_ALERT',
  'SYSTEM_ALERT',
];

const NOTIFICATION_CATEGORIES = [
  'ORDER',
  'SUPPORT',
  'CATALOG',
  'PROMOTION',
  'INVENTORY',
  'SYSTEM',
];

const RECIPIENT_ROLES = [
  'CUSTOMER',
  'ADMIN',
  'SUPER_ADMIN',
  'STAFF',
  'ALL_ADMINS',
  'ALL_CUSTOMERS',
];

const notificationSchema = new mongoose.Schema(
  {
    // Specific recipient (null when targeted to broadcast groups like ALL_ADMINS or ALL_CUSTOMERS)
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    // Target audience role for broadcast filtering and RBAC isolation
    recipientRole: {
      type: String,
      enum: RECIPIENT_ROLES,
      required: true,
      default: 'CUSTOMER',
      index: true,
    },
    // Actionable business event identifier
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
      index: true,
    },
    // Functional category for UI grouping and icon display
    category: {
      type: String,
      enum: NOTIFICATION_CATEGORIES,
      default: 'SYSTEM',
      required: true,
      index: true,
    },
    // Concise notification heading
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    // Detailed customer/admin readable body text
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true,
      maxlength: [500, 'Message cannot exceed 500 characters'],
    },
    // Referenced model entity
    entityType: {
      type: String,
      enum: ['Order', 'CustomerInquiry', 'Product', 'Category', 'Coupon', 'Banner', 'System'],
      default: 'System',
    },
    // ID or reference key of target entity (e.g. orderNumber, ticketNumber, product slug)
    entityId: {
      type: String,
      default: '',
      trim: true,
    },
    // Target frontend navigation path
    actionUrl: {
      type: String,
      default: '',
      trim: true,
      maxlength: [250, 'Action URL cannot exceed 250 characters'],
    },
    // Strictly sanitized, allowlisted metadata snapshot (no sensitive credentials or PII)
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Read status tracking
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    // Soft deletion tracking (allows user dismissal while preserving backend audit records)
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    // Idempotency key for deduplicating repeated business events
    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for high-speed chronological querying and unread count aggregation
notificationSchema.index({ recipientId: 1, isDeleted: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ recipientRole: 1, isDeleted: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, recipientRole: 1, createdAt: -1 });
notificationSchema.index({ createdAt: -1 });

/**
 * Sanitizes notification data before returning over API or Socket.IO.
 */
notificationSchema.methods.toSafeObject = function () {
  return {
    _id: this._id ? this._id.toString() : '',
    recipientId: this.recipientId ? this.recipientId.toString() : null,
    recipientRole: this.recipientRole,
    type: this.type,
    category: this.category,
    title: this.title,
    message: this.message,
    entityType: this.entityType,
    entityId: this.entityId,
    actionUrl: this.actionUrl,
    metadata: this.metadata || {},
    isRead: this.isRead,
    readAt: this.readAt,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

/**
 * Static cleanup utility: removes dismissed or expired notifications older than the retention period.
 * Does NOT touch financial, order, product, or inquiry collections.
 *
 * @param {number} [retentionDays=90] - Days to retain dismissed notifications
 * @returns {Promise<{deletedCount: number}>}
 */
notificationSchema.statics.cleanupOldNotifications = async function (retentionDays = 90) {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const result = await this.deleteMany({
    $or: [
      { isDeleted: true, updatedAt: { $lt: cutoff } },
      { isRead: true, createdAt: { $lt: cutoff } },
    ],
  });
  return { deletedCount: result.deletedCount || 0 };
};

export const Notification = mongoose.model('Notification', notificationSchema);

