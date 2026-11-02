/**
 * AuditLog Model — immutable audit records for sensitive administrative
 * and financial operations.
 *
 * Captures who performed what action, when, from which IP, and what changed.
 *
 * @module models/AuditLog
 */

import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      index: true,
      // Examples: 'ADMIN_LOGIN', 'STOCK_ADJUSTMENT', 'ORDER_STATUS_UPDATE', 'SETTINGS_CHANGE'
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    performerRole: {
      type: String,
      default: 'SYSTEM',
    },
    targetType: {
      type: String,
      required: true,
      index: true,
      // Examples: 'User', 'Product', 'Variant', 'Order', 'Settings'
    },
    targetId: {
      type: String,
      default: '',
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ipAddress: {
      type: String,
      default: '',
    },
    requestId: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Audit logs are append-only
  }
);

auditLogSchema.index({ createdAt: -1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
