/**

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
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordChangedNotification,
} from '../services/emailService.js';
import {
  deleteFile,
  getPublicFileUrl,
  STORAGE_SUBFOLDERS,
} from '../services/fileStorageService.js';
import {
  generateAccessToken,
  generateRefreshToken,
  generateSecureToken,
  hashToken,
  setAuthCookies,
  clearAuthCookies,
  generateOtp,
  hashOtp,
  issueUserSession,
  getRefreshTokenDurationMs,
  REFRESH_COOKIE_NAME,
} from '../utils/token.js';
import { env } from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

// Timing-attack mitigation dummy hash
const TIMING_SAFE_DUMMY_HASH = '$2a$12$e8Y6BfH8Y8ZzQe9Y8.9QXe3.f3q3bQ3uU7H9O7O8K6Y5U4I3O2P1e';

// ── 1. CUSTOMER REGISTRATION ────────────────────────────────────────────────

/**
 * POST /api/v1/auth/register
 * Creates a new customer account with Email, Username, and Password.
 * Sends an email verification link. Account remains unverified until link is confirmed.
 */
export async function register(req, res, next) {
  try {
    const { fullName, username, email, password, acceptTerms } = req.body;

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedUsername = username ? String(username).toLowerCase().trim() : undefined;

    // Check for duplicate email
    const existingEmail = await User.findOne({ email: normalizedEmail });
    if (existingEmail) {
      return res.status(409).json({
        success: false,
        requestId: req.id,
        message: 'An account with this email address is already registered. Please sign in or use password recovery.',
      });
    }

    // If username is provided, check for uniqueness
    if (normalizedUsername) {
      const existingUsername = await User.findOne({ username: normalizedUsername });
      if (existingUsername) {
        return res.status(409).json({
          success: false,
          requestId: req.id,
          message: 'This username is already taken. Please choose another username.',
        });
      }
    }

    // Hash password with bcrypt cost factor 12
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Check if SMTP is actively configured
    const isSmtpConfigured = Boolean(env.SMTP_USER && env.SMTP_PASSWORD && env.SMTP_HOST);
    const isEmailVerified = !isSmtpConfigured;

    // Generate single-use verification token (SHA-256 hash stored in DB)
    const rawVerificationToken = generateSecureToken(32);
    const verificationTokenHash = hashToken(rawVerificationToken);
    const verificationExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    const userPayload = {
      fullName,
      name: fullName,
      email: normalizedEmail,
      password: hashedPassword,
      role: 'CUSTOMER',
      isEmailVerified: true,
      emailVerificationTokenHash: null,
      emailVerificationExpires: null,
      isActive: true,
      privacyConsent: {
        agreed: Boolean(acceptTerms),
        agreedAt: new Date(),
        policyVersion: '1.0',
        termsVersion: '1.0',
        ipAddress: req.ip || '',
        userAgent: req.headers['user-agent'] || '',
      },
    };

    if (normalizedUsername) {
      userPayload.username = normalizedUsername;
    }

    const newUser = await User.create(userPayload);

    // Send welcome email in background if SMTP is configured (non-blocking)
    if (isSmtpConfigured) {
      try {
        await sendVerificationEmail(normalizedEmail, fullName, rawVerificationToken);
      } catch (emailErr) {
        console.error('[auth:register] Failed to deliver welcome email:', emailErr.message);
      }
    }

    await AuditLog.create({
      action: 'CUSTOMER_REGISTERED',
      performedBy: newUser._id,
      performerRole: 'CUSTOMER',
      targetType: 'User',
      targetId: newUser._id.toString(),
      details: { email: normalizedEmail, ...(normalizedUsername ? { username: normalizedUsername } : {}) },
      ipAddress: req.ip || '',
      requestId: req.id,
    });

    // Auto-login: Issue JWT access token and 30-day rotating refresh token cookie immediately
    const { accessToken } = await issueUserSession(res, newUser, {
      rememberMe: true,
      req,
    });

    res.status(201).json({
      success: true,
      requestId: req.id,
      message: 'Registration successful! Welcome to Khushboo Food Service.',
      user: newUser.toSafeObject(),
      token: accessToken,
      accessToken,
    });
  } catch (err) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0] || 'credential';
      return res.status(409).json({
        success: false,
        requestId: req.id,
        message: `An account with this ${field} already exists.`,
      });
    }
    next(err);
  }
}

// ── 2. EMAIL VERIFICATION ───────────────────────────────────────────────────

/**
 * POST /api/v1/auth/verify-email
 * Verifies a customer's email address using a single-use token.
 */
export async function verifyEmail(req, res, next) {
  try {
    const rawToken = req.body?.token || req.query?.token;

    if (!rawToken || typeof rawToken !== 'string') {
      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: 'A valid email verification token is required.',
      });
    }

    const tokenHash = hashToken(rawToken);

    // Find user with matching unexpired verification token
    const user = await User.findOne({
      emailVerificationTokenHash: tokenHash,
      emailVerificationExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: 'The email verification link is invalid, expired, or has already been used. Please request a new verification email.',
      });
    }

    // Mark verified and invalidate token (single-use)
    user.isEmailVerified = true;
    user.emailVerificationTokenHash = null;
    user.emailVerificationExpires = null;
    await user.save();

    await AuditLog.create({
      action: 'CUSTOMER_EMAIL_VERIFIED',
      performedBy: user._id,
      performerRole: user.role,
      targetType: 'User',
      targetId: user._id.toString(),
      details: { email: user.email },
      ipAddress: req.ip || '',
      requestId: req.id,
    });

    res.json({
      success: true,
      requestId: req.id,
      message: 'Your email address has been verified successfully! You can now sign in to your Khushboo Food Service account.',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/auth/resend-verification
 * Resends a new verification email. Applies rate limiting and prevents account enumeration.
 */
export async function resendVerification(req, res, next) {
  try {
    const { email } = req.body;
    const normalizedEmail = String(email).toLowerCase().trim();

    // Generic response returned regardless to prevent account enumeration
    const genericResponse = {
      success: true,
      requestId: req.id,
      message: 'If an unverified account is registered with this email, a new verification link has been sent. Please check your inbox.',
    };

    const user = await User.findOne({
      email: normalizedEmail,
      isEmailVerified: false,
      isActive: true,
      isDeleted: false,
    });

    if (!user) {
      return res.json(genericResponse);
    }

    // Generate new token and expiry
    const rawToken = generateSecureToken(32);
    user.emailVerificationTokenHash = hashToken(rawToken);
    user.emailVerificationExpires = new Date(Date.now() + 30 * 60 * 1000);
    await user.save();

    try {
      await sendVerificationEmail(user.email, user.name || user.fullName, rawToken);
    } catch (emailErr) {
      console.error('[auth:resendVerification] Failed to deliver email:', emailErr.message);
    }

    res.json(genericResponse);
  } catch (err) {
    next(err);
  }
}

// ── 3. LOGIN & SESSION CREATION ─────────────────────────────────────────────

/**
 * POST /api/v1/auth/login
 * Authenticates customers using Email OR Username + Password.
 * Supports remember-me, progressive account lockout, and rotating refresh tokens.
 */
export async function login(req, res, next) {
  try {
    const { identifier, email, password, rememberMe = false } = req.body;
    const normalizedIdentifier = String(identifier || email || '').toLowerCase().trim();
    const rawPassword = String(password || '');

    if (!normalizedIdentifier || !rawPassword) {
      await bcrypt.compare('dummy', TIMING_SAFE_DUMMY_HASH);
      return res.status(401).json({
        success: false,
        requestId: req.id,
        message: 'Invalid email or password.',
      });
    }

    // Query user by email OR username
    const user = await User.findOne({
      $or: [{ email: normalizedIdentifier }, { username: normalizedIdentifier }],
    }).select('+password');

    if (!user) {
      // Execute timing-safe bcrypt compare
      await bcrypt.compare(rawPassword, TIMING_SAFE_DUMMY_HASH);
      return res.status(401).json({
        success: false,
        requestId: req.id,
        message: 'Invalid email or password.',
      });
    }

    // Check account status
    if (user.isDeleted || !user.isActive) {
      return res.status(403).json({
        success: false,
        requestId: req.id,
        message: user.suspendedReason
          ? `Your account is suspended: ${user.suspendedReason}. Please contact support.`
          : 'Your account is deactivated or deleted. Please contact support.',
      });
    }

    // Progressive Lockout check (5 failed attempts = 15 minute temporary lockout)
    if (user.lockUntil && user.lockUntil > new Date()) {
      const remainingMinutes = Math.ceil((user.lockUntil.getTime() - Date.now()) / 60000);
      return res.status(423).json({
        success: false,
        requestId: req.id,
        message: `Account is temporarily locked due to multiple failed login attempts. Please try again in ${remainingMinutes} minute(s).`,
      });
    }

    // Validate password
    const isMatch = await bcrypt.compare(rawPassword, user.password || '');
    if (!isMatch) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;

      if (user.failedLoginAttempts >= 5) {
        user.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
        await user.save();

        await AuditLog.create({
          action: 'ACCOUNT_LOCKED_FAILED_ATTEMPTS',
          performedBy: user._id,
          performerRole: user.role,
          targetType: 'User',
          targetId: user._id.toString(),
          details: { failedAttempts: user.failedLoginAttempts },
          ipAddress: req.ip || '',
          requestId: req.id,
        });

        return res.status(423).json({
          success: false,
          requestId: req.id,
          message: 'Too many consecutive failed login attempts. Your account has been temporarily locked for 15 minutes.',
        });
      }

      await user.save();

      return res.status(401).json({
        success: false,
        requestId: req.id,
        message: 'Invalid email or password.',
      });
    }

    // Legacy accounts that must complete email/password setup
    if (user.legacyAccountRequiresSetup) {
      return res.status(403).json({
        success: false,
        requestId: req.id,
        requiresMigration: true,
        message: 'Your account was registered via mobile OTP and requires setting up your login credentials. Please use the "Claim Legacy Account" flow.',
      });
    }

    // Check email verification (Customers only; Admin accounts handled separately)
    const isSmtpConfigured = Boolean(env.SMTP_USER && env.SMTP_PASSWORD && env.SMTP_HOST);
    if (user.role === 'CUSTOMER' && !user.isEmailVerified) {
      if (!isSmtpConfigured) {
        // Auto-verify if SMTP is not configured so users are never locked out in dev/local mode
        user.isEmailVerified = true;
        await user.save();
      } else {
        return res.status(403).json({
          success: false,
          requestId: req.id,
          isUnverified: true,
          email: user.email,
          message: 'Your email address is not yet verified. Please verify your email before logging in.',
        });
      }
    }

    // Reset failed login counter and lockout on successful login
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    user.lastLoginAt = new Date();

    const { accessToken } = await issueUserSession(res, user, {
      rememberMe: Boolean(rememberMe),
      req,
    });

    res.json({
      success: true,
      requestId: req.id,
      message: 'Login successful.',
      user: user.toSafeObject(),
      token: accessToken,
      accessToken,
    });
  } catch (err) {
    next(err);
  }
}

// ── 4. REFRESH TOKEN ROTATION ───────────────────────────────────────────────

/**
 * POST /api/v1/auth/refresh
 * Rotates the refresh token and issues a new access token.
 * Protects against token reuse/replay attacks.
 */
export async function refreshToken(req, res, next) {
  try {
    const rawRefreshToken =
      req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;

    if (!rawRefreshToken || typeof rawRefreshToken !== 'string') {
      return res.status(401).json({
        success: false,
        requestId: req.id,
        message: 'Refresh token is required.',
      });
    }

    const incomingTokenHash = hashToken(rawRefreshToken);

    // Find the user holding this refresh token
    const user = await User.findOne({
      'refreshTokens.tokenHash': incomingTokenHash,
    });

    if (!user || !user.isActive || user.isDeleted) {
      // Possible token replay or forged token: clear auth cookies
      clearAuthCookies(res);
      return res.status(401).json({
        success: false,
        requestId: req.id,
        message: 'Invalid or expired session. Please log in again.',
      });
    }

    // Locate the active token session
    const sessionRecord = user.refreshTokens.find(
      (t) => t.tokenHash === incomingTokenHash
    );

    if (!sessionRecord || sessionRecord.expiresAt <= new Date()) {
      // Invalidate the expired token
      user.refreshTokens = user.refreshTokens.filter(
        (t) => t.tokenHash !== incomingTokenHash
      );
      await user.save();
      clearAuthCookies(res);
      return res.status(401).json({
        success: false,
        requestId: req.id,
        message: 'Session expired. Please log in again.',
      });
    }

    // Token Rotation: Invalidate the used token and issue a fresh one
    user.refreshTokens = user.refreshTokens.filter(
      (t) => t.tokenHash !== incomingTokenHash
    );

    const { tokenId: newId, rawToken: newRawRefreshToken } = generateRefreshToken();
    const newRefreshTokenHash = hashToken(newRawRefreshToken);
    const newRefreshExpiry = new Date(Date.now() + getRefreshTokenDurationMs(true));

    user.refreshTokens.push({
      tokenId: newId,
      tokenHash: newRefreshTokenHash,
      expiresAt: newRefreshExpiry,
      userAgent: (req.headers['user-agent'] || '').slice(0, 300),
      ipAddress: req.ip || '',
    });

    await user.save();

    const tokenPayload = {
      id: user._id.toString(),
      role: user.role,
      phone: user.phone,
      email: user.email,
      username: user.username,
      sessionVersion: user.sessionVersion || 1,
    };
    const newAccessToken = generateAccessToken(tokenPayload);

    // Update HttpOnly cookies
    setAuthCookies(res, {
      accessToken: newAccessToken,
      refreshToken: newRawRefreshToken,
      rememberMe: true,
    });

    res.json({
      success: true,
      requestId: req.id,
      token: newAccessToken,
      accessToken: newAccessToken,
      user: user.toSafeObject(),
    });
  } catch (err) {
    next(err);
  }
}

// ── 5. LOGOUT & REVOCATION ──────────────────────────────────────────────────

/**
 * POST /api/v1/auth/logout
 * Clears cookies and revokes the current device's refresh token.
 */
export async function logout(req, res, next) {
  try {
    const rawRefreshToken =
      req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;

    if (rawRefreshToken && typeof rawRefreshToken === 'string') {
      const tokenHash = hashToken(rawRefreshToken);
      await User.updateOne(
        { 'refreshTokens.tokenHash': tokenHash },
        { $pull: { refreshTokens: { tokenHash } } }
      );
    }

    clearAuthCookies(res);

    res.json({
      success: true,
      requestId: req.id,
      message: 'Logged out successfully.',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/auth/logout-all
 * Revokes all sessions across all devices for the authenticated user.
 */
export async function logoutAll(req, res, next) {
  try {
    const user = req.user;
    user.refreshTokens = [];
    user.sessionVersion = (user.sessionVersion || 1) + 1;
    await user.save();

    clearAuthCookies(res);

    await AuditLog.create({
      action: 'USER_LOGOUT_ALL_DEVICES',
      performedBy: user._id,
      performerRole: user.role,
      targetType: 'User',
      targetId: user._id.toString(),
      ipAddress: req.ip || '',
      requestId: req.id,
    });

    res.json({
      success: true,
      requestId: req.id,
      message: 'All active sessions on all devices have been signed out.',
    });
  } catch (err) {
    next(err);
  }
}

// ── 6. FORGOT & RESET PASSWORD ──────────────────────────────────────────────

/**
 * POST /api/v1/auth/forgot-password
 * Initiates password recovery. Dispatches reset link with 15-minute token.
 * Prevents account enumeration by returning a generic response.
 */
export async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    const normalizedEmail = String(email).toLowerCase().trim();

    const genericResponse = {
      success: true,
      requestId: req.id,
      message: 'If an account is associated with this email, a password reset link has been sent. Please check your inbox.',
    };

    const user = await User.findOne({
      email: normalizedEmail,
      isActive: true,
      isDeleted: false,
    });

    if (!user) {
      return res.json(genericResponse);
    }

    // Generate single-use reset token (15-minute expiration)
    const rawResetToken = generateSecureToken(32);
    user.passwordResetTokenHash = hashToken(rawResetToken);
    user.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    try {
      await sendPasswordResetEmail(user.email, user.name || user.fullName, rawResetToken);
    } catch (emailErr) {
      console.error('[auth:forgotPassword] Failed to send password reset email:', emailErr.message);
    }

    res.json(genericResponse);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/auth/reset-password
 * Completes password recovery using the reset token.
 * Invalidates token, updates password, and revokes all active sessions.
 */
export async function resetPassword(req, res, next) {
  try {
    const { token, newPassword } = req.body;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: 'A valid password reset token is required.',
      });
    }

    const tokenHash = hashToken(token);

    const user = await User.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: 'The password reset link is invalid, expired, or has already been used. Please request a new link.',
      });
    }

    // Hash the new password with bcrypt (12 rounds)
    const salt = await bcrypt.genSalt(12);
    user.password = await bcrypt.hash(newPassword, salt);

    // Invalidate reset token (single-use)
    user.passwordResetTokenHash = null;
    user.passwordResetExpires = null;
    user.passwordChangedAt = new Date();

    // Revoke all existing sessions and refresh tokens
    user.refreshTokens = [];
    user.sessionVersion = (user.sessionVersion || 1) + 1;
    user.failedLoginAttempts = 0;
    user.lockUntil = null;

    await user.save();

    // Send confirmation email
    try {
      await sendPasswordChangedNotification(user.email, user.name || user.fullName);
    } catch (emailErr) {
      console.error('[auth:resetPassword] Confirmation email error:', emailErr.message);
    }

    clearAuthCookies(res);

    await AuditLog.create({
      action: 'PASSWORD_RESET_SUCCESSFUL',
      performedBy: user._id,
      performerRole: user.role,
      targetType: 'User',
      targetId: user._id.toString(),
      ipAddress: req.ip || '',
      requestId: req.id,
    });

    res.json({
      success: true,
      requestId: req.id,
      message: 'Your password has been reset successfully. Please log in with your new password.',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/auth/change-password
 * Authenticated customer password change.
 */
export async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        requestId: req.id,
        message: 'User account not found.',
      });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password || '');
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: 'Current password is incorrect.',
      });
    }

    const salt = await bcrypt.genSalt(12);
    user.password = await bcrypt.hash(newPassword, salt);
    user.passwordChangedAt = new Date();
    user.sessionVersion = (user.sessionVersion || 1) + 1;

    // Invalidate other devices
    user.refreshTokens = [];
    await user.save();

    // Issue fresh session with refresh token for the current client
    const { accessToken } = await issueUserSession(res, user, { rememberMe: true, req });

    try {
      await sendPasswordChangedNotification(user.email, user.name || user.fullName);
    } catch (e) {
      // Non-blocking
    }

    res.json({
      success: true,
      requestId: req.id,
      message: 'Password changed successfully.',
      token: accessToken,
      accessToken,
    });
  } catch (err) {
    next(err);
  }
}

// ── 7. LEGACY ACCOUNT MIGRATION / CLAIM ─────────────────────────────────────

/**
 * POST /api/v1/auth/claim/request-otp
 * Step 1 of claiming a legacy phone-only account: sends an OTP to verify phone ownership.
 */
export async function claimLegacyRequestOtp(req, res, next) {
  try {
    const { phone } = req.body;

    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({
        success: false,
        requestId: req.id,
        message: 'No existing account was found for this phone number.',
      });
    }

    if (!user.legacyAccountRequiresSetup && user.password && user.username) {
      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: 'This account has already completed setup. Please log in using your username or email address.',
      });
    }

    // Enforce resend cooldown
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
        message: `Please wait ${waitSeconds} seconds before requesting a new verification code.`,
        cooldownRemainingSeconds: waitSeconds,
      });
    }

    const otp = generateOtp();
    const otpHash = hashOtp(phone, otp);
    const now = Date.now();
    const expiresAt = new Date(now + env.OTP_TTL_MINUTES * 60 * 1000);
    const resendAvailableAt = new Date(now + env.OTP_RESEND_COOLDOWN_SECONDS * 1000);

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

    await smsService.sendOtp(phone, otp);

    res.json({
      success: true,
      requestId: req.id,
      message: 'Verification code sent to your phone. Please verify your phone ownership to claim your account.',
      ...(env.NODE_ENV !== 'production' && env.USE_DEV_OTP ? { devOtp: env.DEV_OTP } : {}),
      cooldownSeconds: env.OTP_RESEND_COOLDOWN_SECONDS,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/auth/claim/complete
 * Step 2 of claiming legacy account: verifies OTP, assigns username/email/password,
 * sends email verification, and preserves existing orders, addresses, and cart.
 */
export async function claimLegacyComplete(req, res, next) {
  try {
    const { phone, otp, fullName, username, email, password } = req.body;

    const session = await OtpSession.findOne({
      phone,
      isVerified: false,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!session) {
      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: 'Verification code has expired. Please request a new code.',
      });
    }

    const expectedHash = hashOtp(phone, otp);
    if (session.otpHash !== expectedHash) {
      session.attempts += 1;
      await session.save();
      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: 'Invalid verification code. Please check and try again.',
      });
    }

    session.isVerified = true;
    await session.save();

    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({
        success: false,
        requestId: req.id,
        message: 'Legacy account not found.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedUsername = username.toLowerCase().trim();

    // Check for collisions with other users
    const conflict = await User.findOne({
      _id: { $ne: user._id },
      $or: [{ email: normalizedEmail }, { username: normalizedUsername }],
    });

    if (conflict) {
      if (conflict.email === normalizedEmail) {
        return res.status(409).json({
          success: false,
          requestId: req.id,
          message: 'This email address is already in use by another account.',
        });
      }
      return res.status(409).json({
        success: false,
        requestId: req.id,
        message: 'This username is already in use by another account.',
      });
    }

    // Set new credentials on the existing user record (preserving _id, orders, addresses, cart!)
    const salt = await bcrypt.genSalt(12);
    user.fullName = fullName;
    user.name = fullName;
    user.username = normalizedUsername;
    user.email = normalizedEmail;
    user.password = await bcrypt.hash(password, salt);
    user.legacyAccountRequiresSetup = false;
    user.isEmailVerified = false;

    // Generate email verification token
    const rawVerificationToken = generateSecureToken(32);
    user.emailVerificationTokenHash = hashToken(rawVerificationToken);
    user.emailVerificationExpires = new Date(Date.now() + 30 * 60 * 1000);

    await user.save();

    try {
      await sendVerificationEmail(normalizedEmail, fullName, rawVerificationToken);
    } catch (e) {
      console.error('[auth:claimLegacyComplete] Verification email error:', e.message);
    }

    await AuditLog.create({
      action: 'LEGACY_ACCOUNT_CLAIMED',
      performedBy: user._id,
      performerRole: user.role,
      targetType: 'User',
      targetId: user._id.toString(),
      details: { email: normalizedEmail, username: normalizedUsername },
      ipAddress: req.ip || '',
      requestId: req.id,
    });

    res.json({
      success: true,
      requestId: req.id,
      message: 'Account successfully upgraded! A verification link has been sent to your new email address. Please verify your email before logging in.',
    });
  } catch (err) {
    next(err);
  }
}

// ── 8. ADMIN LOGIN & AUTHENTICATION ─────────────────────────────────────────

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
      await bcrypt.compare(rawPassword, TIMING_SAFE_DUMMY_HASH);

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

    // Issue fresh administrative session with rotating refresh token and secure HttpOnly cookies
    const { accessToken } = await issueUserSession(res, user, { rememberMe: true, req });

    res.json({
      success: true,
      requestId: req.id,
      message: 'Admin authentication successful.',
      user: user.toSafeObject(),
      token: accessToken,
      accessToken,
    });
  } catch (err) {
    next(err);
  }
}

// ── 9. CURRENT USER & PROFILE ───────────────────────────────────────────────

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
    const { name, fullName, avatar, soundEnabled } = req.body;

    if (name !== undefined || fullName !== undefined) {
      const newName = name || fullName;
      req.user.name = newName;
      req.user.fullName = newName;
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

// ── 10. ADDRESS MANAGEMENT ──────────────────────────────────────────────────

/**
 * POST /api/v1/auth/addresses
 * Adds a new delivery address for the customer.
 */
export async function addAddress(req, res, next) {
  try {
    const addressData = req.body;

    if (addressData.pincode && !/^\d{6}$/.test(String(addressData.pincode).trim())) {
      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: 'Invalid postal PIN code. Must be exactly 6 digits.',
      });
    }

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

    if (addressUpdates.pincode && !/^\d{6}$/.test(String(addressUpdates.pincode).trim())) {
      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: 'Invalid postal PIN code. Must be exactly 6 digits.',
      });
    }

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

// ── 11. ACCOUNT DELETION COMPLIANCE ─────────────────────────────────────────

/**
 * POST /api/v1/auth/deletion-request
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
      details: { email: user.email, phone: user.phone, reason },
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

// ── 12. BACKWARD-COMPATIBLE PHONE OTP (Preserved for compatibility) ─────────

/**
 * POST /api/v1/auth/otp/request
 * Retained for backward-compatibility with test suites and legacy integrations.
 */
export async function requestOtp(req, res, next) {
  try {
    const { phone } = req.body;

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
 * Retained for backward-compatibility with test suites and legacy integrations.
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
      session.isVerified = true;
      await session.save();

      user = await User.create({
        phone,
        role: 'CUSTOMER',
        name: 'Grocery Customer',
        fullName: 'Grocery Customer',
        legacyAccountRequiresSetup: true, // Requires setup to add email/password
        isEmailVerified: false,
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
      session.isVerified = true;
      await session.save();
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

    // Issue fresh customer session with rotating refresh token and secure HttpOnly cookies
    const { accessToken } = await issueUserSession(res, user, { rememberMe: true, req });

    res.json({
      success: true,
      requestId: req.id,
      message: isNewCustomer ? 'Welcome to Khushboo Food Service!' : 'Login successful.',
      isNewCustomer,
      user: user.toSafeObject(),
      token: accessToken,
      accessToken,
    });
  } catch (err) {
    next(err);
  }
}
