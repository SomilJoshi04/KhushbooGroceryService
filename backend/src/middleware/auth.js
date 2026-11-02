/**
 * Authentication and Authorization Middleware.
 *
 * Enforces JWT verification via HttpOnly cookie or Authorization header.
 * Provides role-based access control (RBAC).
 *
 * @module middleware/auth
 */

import { verifyToken, AUTH_COOKIE_NAME } from '../utils/token.js';
import { User } from '../models/User.js';

/**
 * Middleware: Requires a valid authenticated session.
 * Rejects with 401 if missing, invalid, or expired.
 */
export async function requireAuth(req, res, next) {
  try {
    // Check HttpOnly cookie first, then fallback to Bearer header
    let token = req.cookies?.[AUTH_COOKIE_NAME];

    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        requestId: req.id,
        message: 'Authentication required. Please log in.',
      });
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch {
      return res.status(401).json({
        success: false,
        requestId: req.id,
        message: 'Invalid or expired session. Please log in again.',
      });
    }

    const user = await User.findById(decoded.id);

    if (!user || !user.isActive || user.isDeleted) {
      return res.status(401).json({
        success: false,
        requestId: req.id,
        message: user?.suspendedReason
          ? `Account suspended: ${user.suspendedReason}`
          : 'User account not found, deactivated, or deleted.',
      });
    }

    if (decoded.sessionVersion !== undefined && user.sessionVersion > decoded.sessionVersion) {
      return res.status(401).json({
        success: false,
        requestId: req.id,
        message: 'Your session has been invalidated. Please log in again.',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Middleware factory: Enforces specific roles (RBAC).
 *
 * @param {...string} allowedRoles - E.g. 'ADMIN', 'SUPER_ADMIN', 'STAFF'
 * @returns {import('express').RequestHandler}
 */
export function requireRole(...allowedRoles) {
  const roles = allowedRoles.flat();
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        requestId: req.id,
        message: 'Authentication required.',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        requestId: req.id,
        message: 'Access denied. You do not have permission to access this resource.',
      });
    }

    next();
  };
}

/**
 * Middleware: Optional authentication.
 * Attaches req.user if a valid token is present, otherwise proceeds as guest.
 */
export async function optionalAuth(req, res, next) {
  try {
    let token = req.cookies?.[AUTH_COOKIE_NAME];
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      try {
        const decoded = verifyToken(token);
        const user = await User.findById(decoded.id);
        if (user && user.isActive) {
          req.user = user;
        }
      } catch {
        // Ignore invalid token for optional auth
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}
