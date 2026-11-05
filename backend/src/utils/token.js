/**
 * Token and Crypto Utilities.
 *
 * Handles JWT signing/verification, rotating refresh tokens, HttpOnly cookie management,
 * SHA-256 cryptographic hashing for verification and reset tokens, and OTP helpers for legacy claims.
 *
 * @module utils/token
 */

import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { env } from '../config/env.js';

export const AUTH_COOKIE_NAME = 'khushboo_auth_token';
export const REFRESH_COOKIE_NAME = 'khushboo_refresh_token';

/**
 * Generates a short-lived access JWT for authenticated requests.
 *
 * @param {Object} payload
 * @param {string} payload.id
 * @param {string} payload.role
 * @param {string} [payload.email]
 * @param {string} [payload.username]
 * @param {number} [payload.sessionVersion]
 * @returns {string} Signed JWT
 */
export function generateAccessToken(payload) {
  const secret = env.JWT_ACCESS_SECRET || env.JWT_SECRET;
  return jwt.sign(payload, secret, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN || '15m',
  });
}

/** Backward-compatible alias for generateAccessToken */
export const generateToken = generateAccessToken;

/**
 * Verifies an access JWT and returns the decoded payload.
 *
 * @param {string} token
 * @returns {Object} Decoded payload
 */
export function verifyAccessToken(token) {
  const secret = env.JWT_ACCESS_SECRET || env.JWT_SECRET;
  return jwt.verify(token, secret);
}

/** Backward-compatible alias for verifyAccessToken */
export const verifyToken = verifyAccessToken;

/**
 * Generates a cryptographically random, high-entropy refresh token.
 *
 * @returns {{ tokenId: string, rawToken: string }}
 */
export function generateRefreshToken() {
  const tokenId = crypto.randomUUID();
  const rawToken = crypto.randomBytes(40).toString('hex');
  return { tokenId, rawToken: `${tokenId}.${rawToken}` };
}

/**
 * Creates a deterministic SHA-256 hash of a raw token.
 * Stored in MongoDB so tokens are never stored in plaintext.
 *
 * @param {string} rawToken
 * @returns {string} Hex-encoded SHA-256 hash
 */
export function hashToken(rawToken) {
  return crypto.createHash('sha256').update(String(rawToken)).digest('hex');
}

/**
 * Generates a cryptographically secure random token (hex string).
 * Used for email verification and password reset tokens.
 *
 * @param {number} [bytes=32]
 * @returns {string}
 */
export function generateSecureToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Calculates refresh token expiration in milliseconds from configuration.
 * Respects env.JWT_REFRESH_EXPIRES_IN (e.g. '30d', '7d', '24h').
 *
 * @param {boolean} [rememberMe=true]
 * @returns {number} Duration in milliseconds
 */
export function getRefreshTokenDurationMs(rememberMe = true) {
  if (!rememberMe) {
    return 24 * 60 * 60 * 1000; // 1 day if rememberMe is unchecked
  }
  const config = env.JWT_REFRESH_EXPIRES_IN || '30d';
  const match = String(config).trim().match(/^(\d+)([dhms])?$/i);
  if (match) {
    const val = parseInt(match[1], 10);
    const unit = (match[2] || 'd').toLowerCase();
    if (unit === 'd') return val * 24 * 60 * 60 * 1000;
    if (unit === 'h') return val * 60 * 60 * 1000;
    if (unit === 'm') return val * 60 * 1000;
    if (unit === 's') return val * 1000;
  }
  return 30 * 24 * 60 * 60 * 1000; // Default: 30 days
}

/**
 * Sets access and refresh cookies securely as HttpOnly cookies.
 *
 * @param {import('express').Response} res
 * @param {Object} options
 * @param {string} options.accessToken
 * @param {string} [options.refreshToken]
 * @param {boolean} [options.rememberMe]
 */
export function setAuthCookies(res, { accessToken, refreshToken, rememberMe = false }) {
  const isProduction = env.NODE_ENV === 'production';
  const sameSite = isProduction ? (env.COOKIE_SAME_SITE || 'lax') : 'lax';

  // 15 minutes for access token cookie (kept strictly short-lived for security)
  if (accessToken) {
    res.cookie(AUTH_COOKIE_NAME, accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite,
      maxAge: 15 * 60 * 1000,
      path: '/',
    });
  }

  // Configurable persistent duration (default 30 days) for rotating refresh token cookie
  if (refreshToken) {
    const refreshMaxAge = getRefreshTokenDurationMs(rememberMe);

    res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite,
      maxAge: refreshMaxAge,
      path: '/',
    });
  }
}

/**
 * Issues a new access token and rotating refresh token session,
 * persists the hashed refresh token on the user in MongoDB,
 * and sets secure HttpOnly cookies on the response.
 *
 * @param {import('express').Response} res
 * @param {import('../models/User.js').User} user
 * @param {Object} [options]
 * @param {boolean} [options.rememberMe=true]
 * @param {import('express').Request} [options.req]
 * @returns {Promise<{ accessToken: string, rawRefreshToken: string }>}
 */
export async function issueUserSession(res, user, options = {}) {
  const { rememberMe = true, req = null } = options;

  const tokenPayload = {
    id: user._id.toString(),
    role: user.role,
    phone: user.phone,
    email: user.email,
    username: user.username,
    sessionVersion: user.sessionVersion || 1,
  };
  const accessToken = generateAccessToken(tokenPayload);

  // Generate high-entropy rotating refresh token
  const { tokenId, rawToken: rawRefreshToken } = generateRefreshToken();
  const refreshTokenHash = hashToken(rawRefreshToken);
  const refreshExpiry = new Date(Date.now() + getRefreshTokenDurationMs(rememberMe));

  // Clean expired refresh tokens and cap maximum active sessions per user (10)
  user.refreshTokens = (user.refreshTokens || []).filter((t) => t.expiresAt > new Date());
  if (user.refreshTokens.length >= 10) {
    user.refreshTokens.shift();
  }

  user.refreshTokens.push({
    tokenId,
    tokenHash: refreshTokenHash,
    expiresAt: refreshExpiry,
    userAgent: (req?.headers?.['user-agent'] || '').slice(0, 300),
    ipAddress: req?.ip || '',
  });

  await user.save();

  // Set secure HttpOnly cookies
  setAuthCookies(res, {
    accessToken,
    refreshToken: rawRefreshToken,
    rememberMe: Boolean(rememberMe),
  });

  return { accessToken, rawRefreshToken };
}

/** Backward-compatible alias for setAuthCookie */
export function setAuthCookie(res, token) {
  setAuthCookies(res, { accessToken: token, rememberMe: true });
}

/**
 * Clears all authentication cookies upon logout.
 *
 * @param {import('express').Response} res
 */
export function clearAuthCookies(res) {
  const isProduction = env.NODE_ENV === 'production';

  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'lax' : 'lax',
    path: '/',
  });

  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'lax' : 'lax',
    path: '/',
  });
}

/** Backward-compatible alias for clearAuthCookie */
export const clearAuthCookie = clearAuthCookies;

/**
 * Generates a cryptographically random numeric OTP matching env.OTP_LENGTH.
 * Used for claiming legacy accounts by phone ownership.
 *
 * @returns {string} Numeric OTP
 */
export function generateOtp() {
  if (env.NODE_ENV !== 'production' && env.USE_DEV_OTP && env.DEV_OTP) {
    return env.DEV_OTP;
  }
  const length = Number(env.OTP_LENGTH) || 4;
  const min = 10 ** (length - 1);
  const max = 10 ** length;
  const code = crypto.randomInt(min, max);
  return String(code);
}

/**
 * Creates a SHA-256 HMAC hash of the OTP using the server secret.
 *
 * @param {string} phone
 * @param {string} otp
 * @returns {string} Hex encoded HMAC hash
 */
export function hashOtp(phone, otp) {
  return crypto
    .createHmac('sha256', env.JWT_SECRET)
    .update(`${phone}:${otp}`)
    .digest('hex');
}
