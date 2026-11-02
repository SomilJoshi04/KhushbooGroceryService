/**
 * Authentication and User Controller.
 *
 * Implements:
 * - Customer Phone OTP login (single-use, hashed, attempt-limited, cooled down).
 * - Administrator credentials login with bcrypt and audit logging.
 * - Profile and delivery address management.
 * - Secure session invalidation (logout).
 *
 * @module controllers/authController
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { Product } from '../models/Product.js';
import { Category } from '../models/Category.js';
import { Banner } from '../models/Banner.js';
import { OtpSession } from '../models/OtpSession.js';
import { AuditLog } from '../models/AuditLog.js';
import { smsService } from '../services/smsAdapter.js';
import {
  deleteFile,
  getPublicFileUrl,
  STORAGE_SUBFOLDERS,
} from '../services/fileStorageService.js';
import {
  generateToken,
  setAuthCookie,
  clearAuthCookie,
  generateOtp,
  hashOtp,
} from '../utils/token.js';
import { env } from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

/**
 * POST /api/v1/auth/otp/request
 * Request a 6-digit OTP sent to an Indian mobile number.
 */
export async function requestOtp(req, res, next) {
  try {
    const { phone } = req.body;

    // Check if account already exists and whether it is active
    const existingUser = await User.findOne({ phone });
    if (existingUser && (existingUser.role === 'ADMIN' || existingUser.role === 'SUPER_ADMIN')) {
      return res.status(403).json({
        success: false,
        requestId: req.id,
        message: 'Administrative accounts must sign in through the administrative portal using email and password.',
      });
    }

    if (existingUser && (!existingUser.isActive || existingUser.isDeleted)) {
      return res.status(403).json({
        success: false,
        requestId: req.id,
        message: existingUser.suspendedReason
          ? `Your account is suspended: ${existingUser.suspendedReason}. Please contact customer support.`
          : 'Your account is deactivated or deleted. Please contact customer support.',
      });
    }

    // Check cooldown on the latest session for this phone
    const recentSession = await OtpSession.findOne({
      phone,
      isVerified: false,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (recentSession && recentSession.resendAvailableAt > new Date()) {
      const waitSeconds = Math.ceil(
        (recentSession.resendAvailableAt.getTime() - Date.now()) / 1000
      );
      return res.status(429).json({
        success: false,
        requestId: req.id,
        message: `Please wait ${waitSeconds} seconds before requesting a new OTP.`,
        cooldownRemainingSeconds: waitSeconds,
      });
    }

    const otp = generateOtp();
    const otpHash = hashOtp(phone, otp);

    const now = Date.now();
    const expiresAt = new Date(now + env.OTP_TTL_MINUTES * 60 * 1000);
    const resendAvailableAt = new Date(now + env.OTP_RESEND_COOLDOWN_SECONDS * 1000);

    // Save session before sending SMS so it's ready for verification
    await OtpSession.create({
      phone,
      otpHash,
      attempts: 0,
      maxAttempts: env.OTP_MAX_ATTEMPTS,
      isVerified: false,
      expiresAt,
      resendAvailableAt,
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
    });

    // Dispatch SMS via configured provider adapter
    await smsService.sendOtp(phone, otp);

    res.json({
      success: true,
      requestId: req.id,
      message: existingUser
        ? 'OTP sent successfully. Please sign in to your Khushboo Grocery account.'
        : 'OTP sent successfully. Welcome to Khushboo Grocery!',
      isExistingCustomer: Boolean(existingUser),
      otpLength: env.OTP_LENGTH || 4,
      ...(env.NODE_ENV !== 'production' && env.USE_DEV_OTP ? { devOtp: env.DEV_OTP } : {}),
      cooldownSeconds: env.OTP_RESEND_COOLDOWN_SECONDS,
      expiresInMinutes: env.OTP_TTL_MINUTES,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/auth/otp/verify
 * Verifies a single-use OTP and creates/authenticates the customer.
 */
export async function verifyOtp(req, res, next) {
  try {
    const {
      phone,
      otp,
      privacyConsent,
      marketingConsent,
      policyVersion = '1.0',
      termsVersion = '1.0',
    } = req.body;

    // Find latest unverified session that has not expired
    const session = await OtpSession.findOne({
      phone,
      isVerified: false,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!session) {
      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: 'OTP has expired or no active OTP request exists. Please request a new OTP.',
      });
    }

    // Check maximum attempt threshold
    if (session.attempts >= session.maxAttempts) {
      return res.status(429).json({
        success: false,
        requestId: req.id,
        message: 'Maximum verification attempts exceeded. Please request a new OTP.',
      });
    }

    const expectedHash = hashOtp(phone, otp);

    if (session.otpHash !== expectedHash) {
      session.attempts += 1;
      await session.save();

      const remaining = session.maxAttempts - session.attempts;
      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: remaining > 0
          ? `Invalid OTP. You have ${remaining} attempts remaining.`
          : 'Invalid OTP. Maximum attempts exceeded. Please request a new OTP.',
      });
    }

    // Find customer account
    let user = await User.findOne({ phone });
    let isNewCustomer = false;

    if (user && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN')) {
      return res.status(403).json({
        success: false,
        requestId: req.id,
        message: 'Administrative accounts must sign in through the administrative portal using email and password.',
      });
    }

    if (!user) {
      // Mandatory privacy consent required before account creation
      if (!privacyConsent) {
        return res.status(400).json({
          success: false,
          requestId: req.id,
          message:
            'You must read and agree to the Privacy Policy and Terms & Conditions to create an account.',
        });
      }

      // Mark session as verified (single-use)
      session.isVerified = true;
      await session.save();

      user = await User.create({
        phone,
        role: 'CUSTOMER',
        name: 'Grocery Customer',
        privacyConsent: {
          agreed: true,
          agreedAt: new Date(),
          policyVersion: String(policyVersion),
          termsVersion: String(termsVersion),
          ipAddress: req.ip || '',
          userAgent: req.headers['user-agent'] || '',
        },
        marketingConsent: {
          agreed: Boolean(marketingConsent),
          agreedAt: marketingConsent ? new Date() : null,
        },
      });
      isNewCustomer = true;
    } else {
      // Mark session as verified (single-use)
      session.isVerified = true;
      await session.save();

      // Existing user: if consent passed and not recorded yet, update it
      if (privacyConsent && !user.privacyConsent?.agreed) {
        user.privacyConsent = {
          agreed: true,
          agreedAt: new Date(),
          policyVersion: String(policyVersion),
          termsVersion: String(termsVersion),
          ipAddress: req.ip || '',
          userAgent: req.headers['user-agent'] || '',
        };
      }
      if (marketingConsent !== undefined) {
        user.marketingConsent = {
          agreed: Boolean(marketingConsent),
          agreedAt: marketingConsent ? new Date() : null,
        };
      }
    }

    if (!user.isActive || user.isDeleted) {
      return res.status(403).json({
        success: false,
        requestId: req.id,
        message: user.suspendedReason
          ? `Your account is suspended: ${user.suspendedReason}. Please contact customer support.`
          : 'Your account is deactivated or deleted. Please contact customer support.',
      });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const tokenPayload = {
      id: user._id.toString(),
      role: user.role,
      phone: user.phone,
      sessionVersion: user.sessionVersion || 1,
    };

    const token = generateToken(tokenPayload);
    setAuthCookie(res, token);

    res.json({
      success: true,
      requestId: req.id,
      message: isNewCustomer ? 'Welcome to Khushboo Food Service!' : 'Login successful.',
      isNewCustomer,
      user: user.toSafeObject(),
      token,
    });
  } catch (err) {
    next(err);
  }
}

// Timing-attack mitigation dummy hash
const TIMING_SAFE_DUMMY_HASH = '$2a$12$e8Y6BfH8Y8ZzQe9Y8.9QXe3.f3q3bQ3uU7H9O7O8K6Y5U4I3O2P1e';

/**
 * POST /api/v1/auth/admin/login
 * Authenticates an administrator or staff member using email and password.
 */
export async function adminLogin(req, res, next) {
  try {
    const { email, password } = req.body;
    const normalizedEmail = typeof email === 'string' ? email.toLowerCase().trim() : '';
    const rawPassword = typeof password === 'string' ? password : '';

    if (!normalizedEmail || !rawPassword) {
      await bcrypt.compare('dummy', TIMING_SAFE_DUMMY_HASH);
      return res.status(401).json({
        success: false,
        requestId: req.id,
        message: 'Invalid administrative credentials.',
      });
    }

    const user = await User.findOne({
      email: normalizedEmail,
      role: { $in: ['ADMIN', 'SUPER_ADMIN', 'STAFF'] },
    }).select('+password');

    if (!user || !user.isActive || !user.password) {
      // Execute timing-safe bcrypt compare even if user not found
      await bcrypt.compare(rawPassword, TIMING_SAFE_DUMMY_HASH);

      // Record failed audit attempt
      await AuditLog.create({
        action: 'ADMIN_LOGIN_FAILED',
        performedBy: null,
        performerRole: 'ANONYMOUS',
        targetType: 'User',
        targetId: normalizedEmail.slice(0, 100),
        details: { reason: 'Account not found, inactive, or unconfigured' },
        ipAddress: req.ip || '',
        requestId: req.id,
      });

      return res.status(401).json({
        success: false,
        requestId: req.id,
        message: 'Invalid administrative credentials.',
      });
    }

    const isMatch = await bcrypt.compare(rawPassword, user.password);

    if (!isMatch) {
      await AuditLog.create({
        action: 'ADMIN_LOGIN_FAILED',
        performedBy: user._id,
        performerRole: user.role,
        targetType: 'User',
        targetId: user._id.toString(),
        details: { reason: 'Incorrect credentials' },
        ipAddress: req.ip || '',
        requestId: req.id,
      });

      return res.status(401).json({
        success: false,
        requestId: req.id,
        message: 'Invalid administrative credentials.',
      });
    }

    user.lastLoginAt = new Date();
    await user.save();

    await AuditLog.create({
      action: 'ADMIN_LOGIN_SUCCESS',
      performedBy: user._id,
      performerRole: user.role,
      targetType: 'User',
      targetId: user._id.toString(),
      ipAddress: req.ip || '',
      requestId: req.id,
    });

    const tokenPayload = {
      id: user._id.toString(),
      role: user.role,
      phone: user.phone,
      sessionVersion: user.sessionVersion || 1,
    };

    const token = generateToken(tokenPayload);
    setAuthCookie(res, token);

    res.json({
      success: true,
      requestId: req.id,
      message: 'Admin authentication successful.',
      user: user.toSafeObject(),
      token,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/auth/me
 * Retrieves current authenticated user profile.
 */
export async function getCurrentUser(req, res) {
  res.json({
    success: true,
    requestId: req.id,
    user: req.user.toSafeObject(),
  });
}

/**
 * PATCH /api/v1/auth/profile
 * Updates customer profile details (name, email, avatar).
 */
export async function updateProfile(req, res, next) {
  try {
    const { name, email, avatar, soundEnabled } = req.body;

    if (name !== undefined) {
      req.user.name = name;
    }
    if (email !== undefined) {
      req.user.email = email || undefined;
    }
    if (avatar !== undefined) {
      req.user.avatar = avatar;
    }
    if (soundEnabled !== undefined) {
      req.user.soundEnabled = Boolean(soundEnabled);
    }

    await req.user.save();

    res.json({
      success: true,
      requestId: req.id,
      message: 'Profile updated successfully.',
      user: req.user.toSafeObject(),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/auth/profile/avatar
 * Uploads a customer profile picture via multipart file.
 */
export async function uploadAvatar(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: 'No image file was uploaded.',
      });
    }

    const previousAvatar = req.user.avatar;
    const subfolder =
      req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN'
        ? STORAGE_SUBFOLDERS.ADMIN
        : STORAGE_SUBFOLDERS.CUSTOMERS;
    const newAvatarUrl = getPublicFileUrl(subfolder, req.file.filename);

    req.user.avatar = newAvatarUrl;
    await req.user.save();

    // Clean up previous locally uploaded avatar file if different and unshared
    if (previousAvatar && previousAvatar !== newAvatarUrl && previousAvatar.startsWith('/uploads/')) {
      deleteFile(previousAvatar, { force: false, models: { Product, Category, Banner, User } }).catch(() => {});
    }

    res.json({
      success: true,
      requestId: req.id,
      message: 'Profile photo updated successfully.',
      avatar: newAvatarUrl,
      user: req.user.toSafeObject(),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/auth/profile/avatar
 * Removes the customer profile picture.
 */
export async function deleteAvatar(req, res, next) {
  try {
    const previousAvatar = req.user.avatar;

    req.user.avatar = '';
    await req.user.save();

    if (previousAvatar && previousAvatar.startsWith('/uploads/')) {
      deleteFile(previousAvatar, { force: false, models: { Product, Category, Banner, User } }).catch(() => {});
    }

    res.json({
      success: true,
      requestId: req.id,
      message: 'Profile photo removed successfully.',
      user: req.user.toSafeObject(),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/auth/addresses
 * Adds a new delivery address for the customer.
 */
export async function addAddress(req, res, next) {
  try {
    const addressData = req.body;

    // Validate PIN code format if provided
    if (addressData.pincode && !/^\d{6}$/.test(String(addressData.pincode).trim())) {
      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: 'Invalid postal PIN code. Must be exactly 6 digits.',
      });
    }

    // Validate coordinate range if provided
    if (addressData.coordinates) {
      const { lat, lng } = addressData.coordinates;
      if (typeof lat === 'number' && typeof lng === 'number') {
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          return res.status(400).json({
            success: false,
            requestId: req.id,
            message: 'Invalid geographic coordinate range.',
          });
        }
      }
    }

    // If this is the customer's first address or marked default, reset other defaults
    if (req.user.addresses.length === 0 || addressData.isDefault) {
      req.user.addresses.forEach((addr) => {
        addr.isDefault = false;
      });
      addressData.isDefault = true;
    }

    req.user.addresses.push(addressData);
    await req.user.save();

    res.status(201).json({
      success: true,
      requestId: req.id,
      message: 'Address added successfully.',
      addresses: req.user.addresses,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/v1/auth/addresses/:id
 * Updates an existing delivery address.
 */
export async function updateAddress(req, res, next) {
  try {
    const { id } = req.params;
    const addressUpdates = req.body;

    // Validate PIN code format if provided
    if (addressUpdates.pincode && !/^\d{6}$/.test(String(addressUpdates.pincode).trim())) {
      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: 'Invalid postal PIN code. Must be exactly 6 digits.',
      });
    }

    // Validate coordinate range if provided
    if (addressUpdates.coordinates) {
      const { lat, lng } = addressUpdates.coordinates;
      if (typeof lat === 'number' && typeof lng === 'number') {
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          return res.status(400).json({
            success: false,
            requestId: req.id,
            message: 'Invalid geographic coordinate range.',
          });
        }
      }
    }

    const address = req.user.addresses.id(id);
    if (!address) {
      return res.status(404).json({
        success: false,
        requestId: req.id,
        message: 'Address not found.',
      });
    }

    if (addressUpdates.isDefault) {
      req.user.addresses.forEach((addr) => {
        addr.isDefault = false;
      });
    }

    Object.assign(address, addressUpdates);
    await req.user.save();

    res.json({
      success: true,
      requestId: req.id,
      message: 'Address updated successfully.',
      addresses: req.user.addresses,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/auth/addresses/:id/default
 * Sets an address as the default delivery address.
 */
export async function setDefaultAddress(req, res, next) {
  try {
    const { id } = req.params;

    const address = req.user.addresses.id(id);
    if (!address) {
      return res.status(404).json({
        success: false,
        requestId: req.id,
        message: 'Address not found.',
      });
    }

    req.user.addresses.forEach((addr) => {
      addr.isDefault = addr._id.toString() === id;
    });

    await req.user.save();

    res.json({
      success: true,
      requestId: req.id,
      message: 'Default address updated successfully.',
      addresses: req.user.addresses,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/auth/addresses/:id
 * Removes a delivery address.
 */
export async function deleteAddress(req, res, next) {
  try {
    const { id } = req.params;

    const initialCount = req.user.addresses.length;
    req.user.addresses = req.user.addresses.filter(
      (addr) => addr._id.toString() !== id
    );

    if (req.user.addresses.length === initialCount) {
      return res.status(404).json({
        success: false,
        requestId: req.id,
        message: 'Address not found.',
      });
    }

    // If default was deleted, promote first remaining address to default
    if (req.user.addresses.length > 0 && !req.user.addresses.some((a) => a.isDefault)) {
      req.user.addresses[0].isDefault = true;
    }

    await req.user.save();

    res.json({
      success: true,
      requestId: req.id,
      message: 'Address deleted successfully.',
      addresses: req.user.addresses,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/auth/logout
 * Clears the auth cookie.
 */
export function logout(req, res) {
  clearAuthCookie(res);
  res.json({
    success: true,
    requestId: req.id,
    message: 'Logged out successfully.',
  });
}

/**
 * POST /api/v1/auth/deletion-request
 * Allows an authenticated customer to request account deletion and data anonymization.
 */
export async function submitDeletionRequest(req, res, next) {
  try {
    const { reason = '' } = req.body;
    const user = req.user;

    if (user.deletionRequest?.requested && user.deletionRequest?.status === 'PENDING') {
      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: 'You already have a pending account deletion request under review.',
        deletionRequest: user.deletionRequest,
      });
    }

    user.deletionRequest = {
      requested: true,
      requestedAt: new Date(),
      reason: reason.trim(),
      status: 'PENDING',
      reviewedBy: null,
      reviewedAt: null,
      adminNotes: '',
    };

    await user.save();

    await AuditLog.create({
      action: 'CUSTOMER_DELETION_REQUESTED',
      performedBy: user._id,
      performerRole: user.role,
      targetType: 'User',
      targetId: user._id.toString(),
      details: { phone: user.phone, reason },
      ipAddress: req.ip || '',
      requestId: req.id,
    });

    res.json({
      success: true,
      requestId: req.id,
      message:
        'Your account deletion request has been submitted. Our compliance officer will process your request in accordance with statutory retention regulations.',
      deletionRequest: user.deletionRequest,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/auth/deletion-request
 * Retrieves the current status of the customer's account deletion request.
 */
export async function getDeletionRequestStatus(req, res, next) {
  try {
    res.json({
      success: true,
      requestId: req.id,
      deletionRequest: req.user.deletionRequest || {
        requested: false,
        status: 'NONE',
      },
    });
  } catch (err) {
    next(err);
  }
}

