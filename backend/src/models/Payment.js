/**
 * Payment Model — Complete Financial Audit Log for Transactions.
 *
 * Implements:
 * - Tracking of payment intents, attempts, provider order IDs, and statuses.
 * - Integer paise financial representation.
 * - Razorpay signature and transaction references.
 * - Refund tracking with operator ID and reason.
 *
 * @module models/Payment
 */

import mongoose from 'mongoose';

const refundItemSchema = new mongoose.Schema(
  {
    refundId: {
      type: String,
      required: true,
    },
    amountPaise: {
      type: Number,
      required: true,
      min: 100,
    },
    reason: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['PENDING', 'PROCESSED', 'FAILED'],
      default: 'PROCESSED',
    },
    initiatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const paymentSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    orderNumber: {
      type: String,
      required: true,
      index: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    method: {
      type: String,
      enum: ['COD', 'ONLINE'],
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: ['cod', 'razorpay'],
      required: true,
      default: 'cod',
    },
    amountPaise: {
      type: Number,
      required: true,
      min: 100,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    status: {
      type: String,
      enum: ['PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED'],
      default: 'PENDING',
      index: true,
    },
    razorpayOrderId: {
      type: String,
      sparse: true,
      index: true,
    },
    razorpayPaymentId: {
      type: String,
      sparse: true,
      index: true,
    },
    razorpaySignature: {
      type: String,
      default: '',
    },
    failureReason: {
      type: String,
      default: '',
    },
    refunds: [refundItemSchema],
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

paymentSchema.index({ customer: 1, createdAt: -1 });

export const Payment = mongoose.model('Payment', paymentSchema);
