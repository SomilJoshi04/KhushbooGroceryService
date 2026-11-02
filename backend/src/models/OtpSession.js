/**
 * OtpSession Model — manages one-time passwords securely.
 *
 * Security rules:
 * - The raw OTP is NEVER saved in plaintext. A cryptographic SHA-256 HMAC hash is stored.
 * - Single-use: once verified, isVerified=true and the session cannot be re-used.
 * - Attempt capping: after maxAttempts (default 5), the session is locked.
 * - Auto-expiration: MongoDB TTL index removes expired documents automatically.
 * - Cooldown enforcement: resendAvailableAt prevents SMS flooding.
 *
 * @module models/OtpSession
 */

import mongoose from 'mongoose';

const otpSessionSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      index: true,
    },
    // Cryptographic hash of the OTP + salt/secret
    otpHash: {
      type: String,
      required: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 5,
    },
    isVerified: {
      type: Boolean,
      default: false,
      index: true,
    },
    resendAvailableAt: {
      type: Date,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // MongoDB TTL index: document is automatically deleted when expiresAt arrives
    },
    ipAddress: {
      type: String,
      default: '',
    },
    userAgent: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for finding the latest unverified session for a phone number
otpSessionSchema.index({ phone: 1, isVerified: 1, expiresAt: -1 });

export const OtpSession = mongoose.model('OtpSession', otpSessionSchema);
