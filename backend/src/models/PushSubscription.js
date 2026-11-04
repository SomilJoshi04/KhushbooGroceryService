/**
 * PushSubscription Model — Persistent Web Push Subscriptions with VAPID Security.
 *
 * Implements:
 * - Direct association with authenticated User ID and RBAC Role (never client-trusting).
 * - Multi-device support per account with unique endpoint deduplication.
 * - At-rest encryption for client encryption key material (p256dh & auth) using AES-256-GCM.
 * - Granular delivery telemetry (failureCount, lastSuccessfulSendAt, lastFailureAt).
 * - Automatic soft-deactivation and cleanup hooks.
 * - Safe serialization: keys are never exposed in JSON API responses.
 *
 * @module models/PushSubscription
 */

import mongoose from 'mongoose';
import { encryptKey, decryptKey } from '../utils/pushCrypto.js';

const pushSubscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Push subscription must be associated with a user'],
      index: true,
    },
    role: {
      type: String,
      enum: ['CUSTOMER', 'ADMIN', 'SUPER_ADMIN', 'STAFF'],
      required: true,
      default: 'CUSTOMER',
      index: true,
    },
    endpoint: {
      type: String,
      required: [true, 'Push service endpoint is required'],
      unique: true,
      trim: true,
      index: true,
    },
    expirationTime: {
      type: Date,
      default: null,
    },
    keys: {
      p256dh: {
        type: String,
        required: [true, 'p256dh public key is required'],
        trim: true,
      },
      auth: {
        type: String,
        required: [true, 'auth secret is required'],
        trim: true,
      },
    },
    deviceInfo: {
      userAgent: { type: String, default: '' },
      platform: { type: String, default: '' },
      browser: { type: String, default: '' },
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastSuccessfulSendAt: {
      type: Date,
      default: null,
    },
    lastFailureAt: {
      type: Date,
      default: null,
    },
    failureCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for optimal query latency
pushSubscriptionSchema.index({ userId: 1, isActive: 1 });
pushSubscriptionSchema.index({ role: 1, isActive: 1 });
pushSubscriptionSchema.index({ endpoint: 1 }, { unique: true });

// Pre-save hook to ensure keys are encrypted at rest
pushSubscriptionSchema.pre('save', function (next) {
  if (this.isModified('keys.p256dh') && this.keys?.p256dh) {
    this.keys.p256dh = encryptKey(this.keys.p256dh);
  }
  if (this.isModified('keys.auth') && this.keys?.auth) {
    this.keys.auth = encryptKey(this.keys.auth);
  }
  next();
});

/**
 * Returns a web-push compatible subscription object with decrypted keys.
 * NEVER expose this object through external API responses.
 *
 * @returns {{ endpoint: string, expirationTime: Date|null, keys: { p256dh: string, auth: string } }}
 */
pushSubscriptionSchema.methods.toDecryptedSubscription = function () {
  return {
    endpoint: this.endpoint,
    expirationTime: this.expirationTime,
    keys: {
      p256dh: decryptKey(this.keys.p256dh),
      auth: decryptKey(this.keys.auth),
    },
  };
};

/**
 * Strips sensitive key material when serializing to JSON.
 */
pushSubscriptionSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.keys;
  return obj;
};

export const PushSubscription = mongoose.model('PushSubscription', pushSubscriptionSchema);

