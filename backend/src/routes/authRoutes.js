/**
 * Authentication and User Routes.
 *
 * Implements strict per-route rate limits and Zod schema validation.
 *
 * @module routes/authRoutes
 */

import express from 'express';
import { rateLimit } from 'express-rate-limit';
import {
  requestOtp,
  verifyOtp,
  adminLogin,
  getCurrentUser,
  updateProfile,
  uploadAvatar,
  deleteAvatar,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  logout,
  submitDeletionRequest,
  getDeletionRequestStatus,
} from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { multerUpload, validateUploadedFileMagicBytes } from '../middleware/upload.js';
import {
  requestOtpSchema,
  verifyOtpSchema,
  adminLoginSchema,
  updateProfileSchema,
  addressSchema,
  deletionRequestSchema,
} from '../validation/authSchemas.js';

import {
  STORAGE_SUBFOLDERS,
} from '../services/fileStorageService.js';

import { env } from '../config/env.js';

const router = express.Router();

// ── Rate Limiters for Sensitive Auth Endpoints ───────────────────────────────

const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.NODE_ENV === 'production' ? 5 : 100, // Max 5 in prod, relaxed in dev/test
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many OTP requests. Please wait a while before requesting again.',
  },
});

const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === 'production' ? 10 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many verification attempts. Please wait 15 minutes before trying again.',
  },
});

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === 'production' ? 5 : 50, // Strict anti-brute-force on admin portal
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many administrative login attempts. IP temporarily blocked.',
  },
});

const avatarUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === 'production' ? 20 : 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many avatar upload attempts. Please try again after 15 minutes.',
  },
});

/**
 * Helper middleware wrapping multer for profile avatar upload.
 */
function handleAvatarMulter(req, res, next) {
  const upload = multerUpload.single('avatar');
  upload(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          requestId: req.id,
          message: 'Profile image size exceeds maximum permitted limit of 5 MB.',
        });
      }
      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: err.message || 'File upload error.',
      });
    }
    next();
  });
}

// ── Public Auth Routes ────────────────────────────────────────────────────────

router.post(
  '/otp/request',
  otpRequestLimiter,
  validate({ body: requestOtpSchema }),
  requestOtp
);

router.post(
  '/otp/verify',
  otpVerifyLimiter,
  validate({ body: verifyOtpSchema }),
  verifyOtp
);

router.post(
  '/admin/login',
  adminLoginLimiter,
  validate({ body: adminLoginSchema }),
  adminLogin
);

router.post('/logout', logout);

// ── Authenticated User Routes ─────────────────────────────────────────────────

router.get('/me', requireAuth, getCurrentUser);

router.patch(
  '/profile',
  requireAuth,
  validate({ body: updateProfileSchema }),
  updateProfile
);

router.post(
  '/profile/avatar',
  requireAuth,
  avatarUploadLimiter,
  (req, res, next) => {
    req.__uploadSubfolder =
      req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN'
        ? STORAGE_SUBFOLDERS.ADMIN
        : STORAGE_SUBFOLDERS.CUSTOMERS;
    next();
  },
  handleAvatarMulter,
  validateUploadedFileMagicBytes,
  uploadAvatar
);

router.delete(
  '/profile/avatar',
  requireAuth,
  deleteAvatar
);

router.post(
  '/addresses',
  requireAuth,
  validate({ body: addressSchema }),
  addAddress
);

router.put(
  '/addresses/:id',
  requireAuth,
  validate({ body: addressSchema.partial() }),
  updateAddress
);

router.patch(
  '/addresses/:id/default',
  requireAuth,
  setDefaultAddress
);

router.delete('/addresses/:id', requireAuth, deleteAddress);

// Account deletion request (Customer self-service compliance endpoint)
router.post(
  '/deletion-request',
  requireAuth,
  validate({ body: deletionRequestSchema }),
  submitDeletionRequest
);
router.get('/deletion-request', requireAuth, getDeletionRequestStatus);

export default router;
