/**
 * Secure File & Image Upload Middleware.
 *
 * Implements:
 * - Dynamic subfolder routing (products, categories, banners, customers, admin, documents, temporary).
 * - Cryptographic UUID file naming on disk (never trusts original client filename).
 * - Enforced file size limits: 5 MB for images, 10 MB for documents.
 * - Strict whitelist for MIME types: JPEG, PNG, WebP for images, PDF for documents.
 * - Post-upload binary header (magic byte) verification.
 * - Automatic immediate unlink of invalid or malicious files.
 *
 * @module middleware/upload
 */

import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  UPLOADS_DIR,
  STORAGE_SUBFOLDERS,
  ALLOWED_IMAGE_MIMES,
  ALLOWED_DOCUMENT_MIMES,
  MIME_TO_EXT,
  DEFAULT_MAX_IMAGE_BYTES,
  DEFAULT_MAX_DOCUMENT_BYTES,
  verifyMagicBytes,
  generateSafeFilename,
  resolveStoragePath,
} from '../services/fileStorageService.js';

export const MAX_FILE_SIZE_BYTES = DEFAULT_MAX_IMAGE_BYTES;
export const MAX_DOCUMENT_SIZE_BYTES = DEFAULT_MAX_DOCUMENT_BYTES;

/**
 * Maps requested folder from req.query.folder or req.body.folder or param
 * to a verified storage subfolder, defaulting to 'products'.
 */
export function resolveTargetSubfolder(req, defaultFolder = STORAGE_SUBFOLDERS.PRODUCTS) {
  const requested = (
    req.params?.subfolder ||
    req.query?.folder ||
    req.body?.folder ||
    defaultFolder
  ).toLowerCase().trim();

  const validFolders = Object.values(STORAGE_SUBFOLDERS);
  if (validFolders.includes(requested)) {
    return requested;
  }
  return defaultFolder;
}

/**
 * Multer disk storage engine writing directly into appropriate subfolder.
 */
const dynamicDiskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const subfolder = req.__uploadSubfolder || resolveTargetSubfolder(req);
      const targetDir = path.join(UPLOADS_DIR, subfolder);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      cb(null, targetDir);
    } catch (err) {
      cb(err, UPLOADS_DIR);
    }
  },
  filename: (req, file, cb) => {
    try {
      const ext = MIME_TO_EXT[file.mimetype] || path.extname(file.originalname).toLowerCase();
      // Ensure ext is safe
      const safeExt = /^\.(jpg|jpeg|png|webp|pdf)$/i.test(ext) ? ext : '.bin';
      const safeName = generateSafeFilename(file.mimetype in MIME_TO_EXT ? file.mimetype : 'image/jpeg');
      cb(null, safeName);
    } catch (err) {
      cb(err, null);
    }
  },
});

/**
 * Dynamic MIME filter verifying file extensions match permitted lists.
 */
const createDynamicFileFilter = (allowedMimes) => (req, file, cb) => {
  if (allowedMimes.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Invalid file type "${file.mimetype}". Allowed types: ${Array.from(allowedMimes).join(', ')}`
      ),
      false
    );
  }
};

/**
 * Default multer upload instance for backward compatibility (defaults to 5 MB images).
 */
export const multerUpload = multer({
  storage: dynamicDiskStorage,
  limits: {
    fileSize: DEFAULT_MAX_IMAGE_BYTES,
    files: 5,
  },
  fileFilter: createDynamicFileFilter(ALLOWED_IMAGE_MIMES),
});

/**
 * Factory for creating customized upload middleware with specific subfolder and size limits.
 *
 * @param {object} options
 * @param {string} [options.subfolder='products']
 * @param {Set<string>} [options.allowedMimes]
 * @param {number} [options.maxSizeBytes]
 * @param {string} [options.fieldName='file']
 * @returns {Array<Function>} Express middleware stack
 */
export function createUploader({
  subfolder = STORAGE_SUBFOLDERS.PRODUCTS,
  allowedMimes = ALLOWED_IMAGE_MIMES,
  maxSizeBytes = DEFAULT_MAX_IMAGE_BYTES,
  fieldName = 'file',
} = {}) {
  const uploadInstance = multer({
    storage: dynamicDiskStorage,
    limits: {
      fileSize: maxSizeBytes,
      files: 5,
    },
    fileFilter: createDynamicFileFilter(allowedMimes),
  });

  return [
    (req, res, next) => {
      req.__uploadSubfolder = subfolder;
      next();
    },
    (req, res, next) => {
      uploadInstance.single(fieldName)(req, res, (err) => {
        if (err) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            const limitMB = Math.round(maxSizeBytes / (1024 * 1024));
            return res.status(400).json({
              success: false,
              requestId: req.id,
              message: `File size exceeds maximum permitted limit of ${limitMB} MB.`,
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
    },
    validateUploadedFileMagicBytes,
  ];
}

/**
 * Validates actual binary content (magic numbers) of the uploaded file on disk.
 * Preserves backward compatibility.
 *
 * @param {string} filePath
 * @returns {Promise<boolean>}
 */
export async function verifyImageMagicBytes(filePath) {
  const result = await verifyMagicBytes(filePath);
  return result.valid && ALLOWED_IMAGE_MIMES.has(result.detectedMime);
}

/**
 * Express middleware to verify magic bytes after Multer writes the file.
 * Automatically deletes the file from disk if it fails verification.
 */
export async function validateUploadedFileMagicBytes(req, res, next) {
  const files = [];
  if (req.file) files.push(req.file);
  if (req.files) {
    if (Array.isArray(req.files)) {
      files.push(...req.files);
    } else {
      Object.values(req.files).forEach((arr) => files.push(...arr));
    }
  }

  for (const file of files) {
    const isDoc = (req.__uploadSubfolder || '').toLowerCase() === STORAGE_SUBFOLDERS.DOCUMENTS;
    const expectedMimes = isDoc ? ALLOWED_DOCUMENT_MIMES : ALLOWED_IMAGE_MIMES;

    const check = await verifyMagicBytes(file.path, file.mimetype);
    if (!check.valid || !expectedMimes.has(check.detectedMime)) {
      // Unlink spoofed or malformed file immediately
      try {
        await fs.promises.unlink(file.path);
      } catch (_) {}

      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: `Security validation failed: ${check.error || 'The uploaded file does not match approved formats.'}`,
      });
    }
  }

  next();
}
