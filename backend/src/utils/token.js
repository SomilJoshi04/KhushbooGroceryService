/**
 * Token and Crypto Utilities.
 *
 * Handles JWT signing/verification, HttpOnly cookie management,
 * and cryptographically secure OTP generation/hashing.
 *
 * @module utils/token
 */

import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { env } from '../config/env.js';

export const AUTH_COOKIE_NAME = 'khushboo_auth_token';

/**
 * Generates a signed JWT for the given user payload.
 *
 * @param {Object} payload
 * @param {string} payload.id
 * @param {string} payload.role
 * @param {string} payload.phone
 * @returns {string} Signed JWT
 */
export function generateToken(payload) {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

/**
 * Verifies a JWT and returns the decoded payload.
 *
 * @param {string} token
 * @returns {Object} Decoded payload
 */
export function verifyToken(token) {
  return jwt.verify(token, env.JWT_SECRET);
}

/**
 * Sets the authentication JWT as a secure, HttpOnly cookie.
 *
 * @param {import('express').Response} res
 * @param {string} token
 */
export function setAuthCookie(res, token) {
  const isProduction = env.NODE_ENV === 'production';

  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction, // HTTPS required in production
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    path: '/',
  });
}

/**
 * Clears the authentication cookie upon logout.
 *
 * @param {import('express').Response} res
 */
export function clearAuthCookie(res) {
  const isProduction = env.NODE_ENV === 'production';

  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    path: '/',
  });
}

/**
 * Generates a cryptographically random numeric OTP matching env.OTP_LENGTH.
 * In development, returns DEV_OTP if configured, or a secure random numeric code.
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
  // crypto.randomInt is cryptographically secure (unlike Math.random)
  const code = crypto.randomInt(min, max);
  return String(code);
}

/**
 * Creates a SHA-256 HMAC hash of the OTP using the server secret.
 * Raw OTPs are never stored in the database.
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
