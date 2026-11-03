/**
 * Authentication and User Routes.
 *
 * Implements strict per-route rate limits, Zod schema validation,
 * and secure credential handling.
 *
 * @module routes/authRoutes
 */

import express from 'express';
import { rateLimit } from 'express-rate-limit';
import {
  register,
  verifyEmail,
  resendVerification,
  login,
  refreshToken,
  logout,
  logoutAll,
  forgotPassword,
  resetPassword,
  changePassword,
  claimLegacyRequestOtp,
  claimLegacyComplete,
  adminLogin,
  getCurrentUser,
  updateProfile,
  uploadAvatar,
  deleteAvatar,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  submitDeletionRequest,
  getDeletionRequestStatus,
  requestOtp,
  verifyOtp,
} from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { multerUpload, validateUploadedFileMagicBytes } from '../middleware/upload.js';
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  claimLegacyRequestOtpSchema,
  claimLegacyCompleteSchema,
  adminLoginSchema,
  updateProfileSchema,
  addressSchema,
  deletionRequestSchema,
  requestOtpSchema,
  verifyOtpSchema,
} from '../validation/authSchemas.js';
import { STORAGE_SUBFOLDERS } from '../services/fileStorageService.js';
import { env } from '../config/env.js';

const router = express.Router();

// ── Rate Limiters for Sensitive Endpoints ───────────────────────────────────

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: env.NODE_ENV === 'production' ? 10 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many account creation attempts from this IP. Please try again after an hour.',
  },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.NODE_ENV === 'production' ? 15 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts. Please wait 15 minutes before trying again.',
  },
});

const verifyEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === 'production' ? 20 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many verification attempts. Please wait a while before trying again.',
  },
});

const resendVerificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === 'production' ? 5 : 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many resend verification requests. Please check your inbox and spam folders.',
  },
});

const passwordRecoveryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === 'production' ? 5 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many password reset requests. Please check your email or try again later.',
  },
});

const claimLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === 'production' ? 10 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many account claim attempts. Please wait before trying again.',
  },
});

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === 'production' ? 5 : 50,
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

const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === 'production' ? 5 : 100,
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

// ── Public Authentication Routes ────────────────────────────────────────────

// 1. Customer Registration
router.post(
  '/register',
  registerLimiter,
  validate({ body: registerSchema }),
  register
);

// 2. Email Verification
router.post(
  '/verify-email',
  verifyEmailLimiter,
  validate({ body: verifyEmailSchema }),
  verifyEmail
);
router.get('/verify-email', verifyEmailLimiter, verifyEmail);

router.post(
  '/resend-verification',
  resendVerificationLimiter,
  validate({ body: resendVerificationSchema }),
  resendVerification
);

// 3. Login
router.post(
  '/login',
  loginLimiter,
  validate({ body: loginSchema }),
  login
);

// 4. Token Refresh
router.post('/refresh', refreshToken);

// 5. Logout
router.post('/logout', logout);

// 6. Password Recovery
router.post(
  '/forgot-password',
  passwordRecoveryLimiter,
  validate({ body: forgotPasswordSchema }),
  forgotPassword
);

router.post(
  '/reset-password',
  passwordRecoveryLimiter,
  validate({ body: resetPasswordSchema }),
  resetPassword
);

// 7. Legacy Account Claim
router.post(
  '/claim/request-otp',
  claimLimiter,
  validate({ body: claimLegacyRequestOtpSchema }),
  claimLegacyRequestOtp
);

router.post(
  '/claim/complete',
  claimLimiter,
  validate({ body: claimLegacyCompleteSchema }),
  claimLegacyComplete
);

// 8. Store Administrator Portal Login
router.post(
  '/admin/login',
  adminLoginLimiter,
  validate({ body: adminLoginSchema }),
  adminLogin
);

// 9. Legacy OTP Routes (Preserved for compatibility)
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

// ── Authenticated User Routes ───────────────────────────────────────────────

router.get('/me', requireAuth, getCurrentUser);

router.post('/logout-all', requireAuth, logoutAll);

router.post(
  '/change-password',
  requireAuth,
  validate({ body: changePasswordSchema }),
  changePassword
);

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

router.delete('/profile/avatar', requireAuth, deleteAvatar);

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

router.patch('/addresses/:id/default', requireAuth, setDefaultAddress);

router.delete('/addresses/:id', requireAuth, deleteAddress);

router.post(
  '/deletion-request',
  requireAuth,
  validate({ body: deletionRequestSchema }),
  submitDeletionRequest
);

router.get('/deletion-request', requireAuth, getDeletionRequestStatus);

export default router;
