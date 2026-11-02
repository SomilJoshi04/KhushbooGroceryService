/**
 * Production Upload Routes.
 *
 * Implements:
 * - Public asset uploads segregated by category (products, categories, banners).
 * - Authenticated private document upload & streaming download.
 * - Reference-checked deletion with shared-asset safety.
 * - Admin storage metrics and cleanup controls.
 * - Strict rate limiting and error handling.
 *
 * @module routes/uploadRoutes
 */

import express from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  multerUpload,
  createUploader,
  validateUploadedFileMagicBytes,
} from '../middleware/upload.js';
import {
  STORAGE_SUBFOLDERS,
  ALLOWED_DOCUMENT_MIMES,
  DEFAULT_MAX_DOCUMENT_BYTES,
} from '../services/fileStorageService.js';
import {
  uploadSingleImage,
  uploadDocument,
  downloadDocument,
  deleteUploadedImage,
  getStorageMetrics,
  triggerStorageCleanup,
  fetchRemoteImage,
} from '../controllers/uploadController.js';

const router = express.Router();

// Strict rate limit for upload endpoints: 60 uploads per 15 minutes per IP
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: {
    success: false,
    message: 'Too many upload attempts. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Middleware wrapper for multer single upload with error catching.
 */
function handleMulter(req, res, next) {
  const upload = multerUpload.single('file');
  upload(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          requestId: req.id,
          message: 'File size exceeds maximum permitted limit of 5 MB.',
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

// ─────────────────────────────────────────────────────────────────────────────
// 1. Private Document Endpoints
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/v1/upload/documents/:filename — Download private document (requires login + ownership/admin check)
router.get('/documents/:filename', requireAuth, downloadDocument);

// POST /api/v1/upload/documents — Upload private document (PDF only, max 10 MB)
const documentUploader = createUploader({
  subfolder: STORAGE_SUBFOLDERS.DOCUMENTS,
  allowedMimes: ALLOWED_DOCUMENT_MIMES,
  maxSizeBytes: DEFAULT_MAX_DOCUMENT_BYTES,
  fieldName: 'file',
});
router.post('/documents', requireAuth, uploadLimiter, ...documentUploader, uploadDocument);

// ─────────────────────────────────────────────────────────────────────────────
// 2. Admin Asset Uploads (Products, Categories, Banners)
// ─────────────────────────────────────────────────────────────────────────────

// General image upload (used by ImageUpload.jsx component, supports ?folder= query param)
router.post(
  '/image',
  requireAuth,
  requireRole('ADMIN', 'SUPER_ADMIN'),
  uploadLimiter,
  handleMulter,
  validateUploadedFileMagicBytes,
  uploadSingleImage
);

// Dedicated product image upload
const productUploader = createUploader({ subfolder: STORAGE_SUBFOLDERS.PRODUCTS });
router.post(
  '/products',
  requireAuth,
  requireRole('ADMIN', 'SUPER_ADMIN'),
  uploadLimiter,
  ...productUploader,
  uploadSingleImage
);

// Dedicated category image upload
const categoryUploader = createUploader({ subfolder: STORAGE_SUBFOLDERS.CATEGORIES });
router.post(
  '/categories',
  requireAuth,
  requireRole('ADMIN', 'SUPER_ADMIN'),
  uploadLimiter,
  ...categoryUploader,
  uploadSingleImage
);

// Dedicated promotional banner image upload
const bannerUploader = createUploader({ subfolder: STORAGE_SUBFOLDERS.BANNERS });
router.post(
  '/banners',
  requireAuth,
  requireRole('ADMIN', 'SUPER_ADMIN'),
  uploadLimiter,
  ...bannerUploader,
  uploadSingleImage
);

// ─────────────────────────────────────────────────────────────────────────────
// 3. Asset Deletion & Management (Admin Only)
// ─────────────────────────────────────────────────────────────────────────────

// DELETE /api/v1/upload/image/:filename
router.delete('/image/:filename', requireAuth, requireRole('ADMIN', 'SUPER_ADMIN'), deleteUploadedImage);

// DELETE /api/v1/upload/image/:folder/:filename
router.delete('/image/:folder/:filename', requireAuth, requireRole('ADMIN', 'SUPER_ADMIN'), deleteUploadedImage);

// GET /api/v1/upload/stats — Disk space usage metrics
router.get('/stats', requireAuth, requireRole('ADMIN', 'SUPER_ADMIN'), getStorageMetrics);

// POST /api/v1/upload/cleanup — Trigger orphaned & temporary cleanup (supports dryRun: true/false)
router.post('/cleanup', requireAuth, requireRole('ADMIN', 'SUPER_ADMIN'), triggerStorageCleanup);

// POST /api/v1/upload/fetch-remote — SSRF-protected remote image fetch
router.post('/fetch-remote', requireAuth, requireRole('ADMIN', 'SUPER_ADMIN'), uploadLimiter, fetchRemoteImage);

export default router;
