/**
 * CustomerInquiry Model — Support Tickets & Customer Inquiries.
 *
 * Implements:
 * - Real support ticket lifecycle: OPEN, IN_PROGRESS, RESOLVED, CLOSED, REJECTED.
 * - Rejection tracking with mandatory audit reasons.
 * - Soft deletion with reversible archiving and audit trail.
 * - Comprehensive internal notes and timeline activity history.
 *
 * @module models/CustomerInquiry
 */

import mongoose from 'mongoose';

const customerInquirySchema = new mongoose.Schema(
  {
    ticketNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      default: '',
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
      trim: true,
    },
    orderNumber: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REJECTED'],
      default: 'OPEN',
      index: true,
    },
    responseNotes: {
      type: String,
      default: '',
      trim: true,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    // Rejection metadata
    rejectionReason: {
      type: String,
      default: '',
      trim: true,
    },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    rejectedAt: {
      type: Date,
      default: null,
    },
    // Soft Deletion metadata
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    // Internal administrative notes
    internalNotes: [
      {
        note: { type: String, required: true, trim: true },
        addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        addedAt: { type: Date, default: Date.now },
      },
    ],
    // Audit timeline history
    activityHistory: [
      {
        action: { type: String, required: true },
        status: { type: String, default: '' },
        note: { type: String, default: '' },
        performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
  }
);

customerInquirySchema.index({ createdAt: -1 });
customerInquirySchema.index({ isDeleted: 1, status: 1 });

export const CustomerInquiry = mongoose.model('CustomerInquiry', customerInquirySchema);
