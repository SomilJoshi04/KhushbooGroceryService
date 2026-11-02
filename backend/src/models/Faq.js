/**
 * Faq Model — Frequently Asked Questions.
 *
 * Supports:
 * - Categorized customer Q&A (Orders, Delivery, Payments, Returns, Account, General)
 * - Order weighting for custom sorting
 * - Published / Hidden toggle
 * - Audit fields
 *
 * @module models/Faq
 */

import mongoose from 'mongoose';

const faqSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: [true, 'Question is required'],
      trim: true,
      maxlength: [300, 'Question cannot exceed 300 characters'],
    },
    answer: {
      type: String,
      required: [true, 'Answer is required'],
      trim: true,
    },
    category: {
      type: String,
      required: true,
      enum: ['Orders', 'Delivery', 'Payments', 'Returns', 'Account', 'General'],
      default: 'General',
      index: true,
    },
    order: {
      type: Number,
      default: 0,
      index: true,
    },
    isPublished: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

faqSchema.index({ category: 1, order: 1, isPublished: 1 });

export const Faq = mongoose.model('Faq', faqSchema);
