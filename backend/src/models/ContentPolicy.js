/**
 * ContentPolicy Model — Versioned Legal & Compliance Documents.
 *
 * Supports:
 * - Types: PRIVACY_POLICY, TERMS_OF_SERVICE, RETURN_POLICY
 * - Version tracking (e.g. 1.0, 1.1)
 * - Revision history for audit and rollback
 * - Draft vs. Published states
 * - Effective and published dates
 *
 * @module models/ContentPolicy
 */

import mongoose from 'mongoose';

const policyRevisionSchema = new mongoose.Schema(
  {
    version: { type: String, required: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changeSummary: { type: String, default: '' },
  },
  { _id: true }
);

const contentPolicySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      unique: true,
      enum: ['PRIVACY_POLICY', 'TERMS_OF_SERVICE', 'RETURN_POLICY'],
      default: 'PRIVACY_POLICY',
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      default: 'Privacy Policy',
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    draftContent: {
      type: String,
      default: '',
    },
    hasUnpublishedChanges: {
      type: Boolean,
      default: false,
    },
    version: {
      type: String,
      required: true,
      default: '1.0',
    },
    effectiveDate: {
      type: Date,
      default: Date.now,
    },
    isPublished: {
      type: Boolean,
      default: true,
      index: true,
    },
    publishedAt: {
      type: Date,
      default: Date.now,
    },
    history: [policyRevisionSchema],
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

export const ContentPolicy = mongoose.model('ContentPolicy', contentPolicySchema);
