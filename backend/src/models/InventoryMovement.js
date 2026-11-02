/**
 * Inventory Movement Model — Immutable log of all stock adjustments.
 *
 * Tracks every quantity change (sales, cancellations, manual restocks, audits)
 * to maintain complete auditability and prevent stock drift.
 *
 * @module models/InventoryMovement
 */

import mongoose from 'mongoose';

const inventoryMovementSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    sku: {
      type: String,
      required: true,
      index: true,
      uppercase: true,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        'SALE_DEDUCTION',
        'ORDER_CANCELLED_RESTORE',
        'ADMIN_RESTOCK',
        'MANUAL_AUDIT_ADJUSTMENT',
        'EXPIRED_RESERVATION_RELEASE',
      ],
      index: true,
    },
    quantityDelta: {
      type: Number,
      required: true,
      validate: {
        validator: Number.isInteger,
        message: 'quantityDelta must be an integer count',
      },
    },
    previousStock: {
      type: Number,
      required: true,
      min: 0,
    },
    newStock: {
      type: Number,
      required: true,
      min: 0,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
      index: true,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reason: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Append-only audit log
  }
);

inventoryMovementSchema.index({ sku: 1, createdAt: -1 });

export const InventoryMovement = mongoose.model('InventoryMovement', inventoryMovementSchema);
