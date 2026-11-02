/**
 * Production-Ready VPS File Storage Controller.
 *
 * Implements:
 * - Admin-protected product, category, banner, and asset uploads.
 * - Authenticated private document uploads & downloads with ownership checks.
 * - Reference checking & shared-file protection before unlinking.
 * - Storage metrics and orphaned/temporary file maintenance.
 * - SSRF-protected remote image importing.
 * - Comprehensive audit logging for all mutations.
 *
 * @module controllers/uploadController
 */

import path from 'path';
import fs from 'fs';
import dns from 'dns/promises';
import { AuditLog } from '../models/AuditLog.js';
import { Product } from '../models/Product.js';
import { Category } from '../models/Category.js';
import { Banner } from '../models/Banner.js';
import { User } from '../models/User.js';
import { CustomerInquiry } from '../models/CustomerInquiry.js';
import {
  UPLOADS_DIR,
  STORAGE_SUBFOLDERS,
  PUBLIC_SUBFOLDERS,
  PRIVATE_SUBFOLDERS,
  ALLOWED_IMAGE_MIMES,
  ALLOWED_DOCUMENT_MIMES,
  resolveStoragePath,
  parseFileUrl,
  getPublicFileUrl,
  getPrivateFileUrl,
  saveFile,
  deleteFile,
  isSharedFile,
  getStorageStats,
  cleanupOrphanedFiles,
  cleanupTemporaryFiles,
  verifyMagicBytes,
} from '../services/fileStorageService.js';

/**
 * Checks if an IP address belongs to private/internal/reserved ranges (SSRF protection).
 */
function isPrivateOrReservedIp(ip) {
  if (!ip) return true;
  if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') return true;

  // IPv4 private ranges
  const parts = ip.split('.').map(Number);
  if (parts.length === 4) {
    if (parts[0] === 10) return true; // 10.0.0.0/8
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true; // 172.16.0.0/12
    if (parts[0] === 192 && parts[1] === 168) return true; // 192.168.0.0/16
    if (parts[0] === 169 && parts[1] === 254) return true; // Link-local / Cloud metadata
    if (parts[0] === 0 || parts[0] >= 224) return true; // Reserved / Multicast
  }

  return false;
}

/**
 * POST /api/v1/upload/image (and /product-image, /category-image, /banner-image)
 * Uploads an image asset to a designated subfolder (defaults to 'products').
 */
export async function uploadSingleImage(req, res, next) {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: 'No image file was provided.',
      });
    }

    const subfolder = req.__uploadSubfolder || (
      req.params?.subfolder ||
      req.query?.folder ||
      req.body?.folder ||
      STORAGE_SUBFOLDERS.PRODUCTS
    ).toLowerCase();

    const publicUrl = getPublicFileUrl(subfolder, file.filename);

    if (req.user) {
      await AuditLog.create({
        action: 'IMAGE_UPLOAD',
        performedBy: req.user._id,
        performerRole: req.user.role,
        targetType: 'Image',
        targetId: file.filename,
        details: {
          filename: file.filename,
          subfolder,
          mimetype: file.mimetype,
          sizeBytes: file.size,
          url: publicUrl,
        },
        ipAddress: req.ip || '',
        requestId: req.id,
      });
    }

    res.status(201).json({
      success: true,
      requestId: req.id,
      message: 'Image uploaded and secured successfully.',
      data: {
        url: publicUrl,
        filename: file.filename,
        subfolder,
        originalName: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/upload/document
 * Uploads a private document (e.g., PDF verification, customer attachment).
 */
export async function uploadDocument(req, res, next) {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: 'No document file was provided.',
      });
    }

    const filename = file.filename;
    const privateUrl = getPrivateFileUrl(filename);

    if (req.user) {
      await AuditLog.create({
        action: 'DOCUMENT_UPLOAD',
        performedBy: req.user._id,
        performerRole: req.user.role,
        targetType: 'Document',
        targetId: filename,
        details: {
          filename,
          mimetype: file.mimetype,
          sizeBytes: file.size,
          downloadUrl: privateUrl,
        },
        ipAddress: req.ip || '',
        requestId: req.id,
      });
    }

    res.status(201).json({
      success: true,
      requestId: req.id,
      message: 'Private document uploaded securely.',
      data: {
        filename,
        url: privateUrl,
        originalName: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
        isPrivate: true,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/upload/documents/:filename
 * Secure authenticated retrieval for private documents.
 * Enforces ownership check (Customer owns inquiry/document or User is ADMIN/SUPER_ADMIN).
 */
export async function downloadDocument(req, res, next) {
  try {
    const { filename } = req.params;

    if (!filename || !/^[0-9a-fA-F-]{36}\.pdf$/i.test(filename)) {
      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: 'Invalid document filename identifier.',
      });
    }

    let filePath;
    try {
      filePath = resolveStoragePath(STORAGE_SUBFOLDERS.DOCUMENTS, filename);
    } catch {
      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: 'Security violation: Access path invalid.',
      });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        requestId: req.id,
        message: 'The requested document does not exist or has expired.',
      });
    }

    // Role-based authorization:
    // ADMIN and SUPER_ADMIN have full operational access to documents.
    // CUSTOMER can only access if they uploaded or own the associated inquiry/record.
    const userRole = req.user?.role;
    const isStaffOrAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN' || userRole === 'STAFF';

    if (!isStaffOrAdmin) {
      const privateUrl = getPrivateFileUrl(filename);
      // Check if user is associated with an inquiry referencing this document
      const matchingInquiry = await CustomerInquiry.exists({
        customer: req.user._id,
        $or: [
          { message: { $regex: filename } },
          { responseNotes: { $regex: filename } },
        ],
      });

      if (!matchingInquiry) {
        return res.status(403).json({
          success: false,
          requestId: req.id,
          message: 'Access denied: You do not have permission to view or download this document.',
        });
      }
    }

    // Serve private document with download headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');

    return res.sendFile(filePath);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/upload/image/:filename or /api/v1/upload/image/:folder/:filename
 * Safely deletes an uploaded asset if not referenced by active records.
 */
export async function deleteUploadedImage(req, res, next) {
  try {
    const { folder, filename } = req.params;
    const targetFilename = filename || folder;
    const targetFolder = filename ? folder : '';

    if (!targetFilename || !/^[0-9a-fA-F-]{36}\.(jpg|jpeg|png|webp|pdf)$/i.test(targetFilename)) {
      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: 'Invalid filename identifier.',
      });
    }

    const models = { Product, Category, Banner, User };

    // Check references before deleting
    const refCheck = await isSharedFile(targetFilename, models);
    if (refCheck.isReferenced) {
      return res.status(409).json({
        success: false,
        requestId: req.id,
        message: `Cannot delete image: It is currently actively displayed on ${refCheck.references.join(', ')}.`,
      });
    }

    const deletePath = targetFolder ? `/uploads/${targetFolder}/${targetFilename}` : `/uploads/${targetFilename}`;
    const delResult = await deleteFile(deletePath, { force: false, models });

    if (req.user) {
      await AuditLog.create({
        action: 'IMAGE_DELETE',
        performedBy: req.user._id,
        performerRole: req.user.role,
        targetType: 'Image',
        targetId: targetFilename,
        details: { filename: targetFilename, folder: targetFolder, deleted: delResult.deleted },
        ipAddress: req.ip || '',
        requestId: req.id,
      });
    }

    res.json({
      success: true,
      requestId: req.id,
      message: delResult.deleted ? 'Image deleted successfully from local storage.' : (delResult.reason || 'File not found.'),
      data: delResult,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/upload/stats
 * Returns disk usage statistics across all categories (Admin only).
 */
export async function getStorageMetrics(req, res, next) {
  try {
    const stats = await getStorageStats();
    res.json({
      success: true,
      requestId: req.id,
      data: stats,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/upload/cleanup
 * Runs orphaned and temporary file cleanup (Admin only).
 */
export async function triggerStorageCleanup(req, res, next) {
  try {
    const dryRun = req.body.dryRun !== false; // Default to safe dry-run
    const models = { Product, Category, Banner, User };

    const [orphanResults, tempResults] = await Promise.all([
      cleanupOrphanedFiles({ dryRun, models }),
      dryRun ? Promise.resolve({ cleanedCount: 0, freedBytes: 0, errors: [] }) : cleanupTemporaryFiles(),
    ]);

    if (!dryRun && req.user) {
      await AuditLog.create({
        action: 'STORAGE_CLEANUP',
        performedBy: req.user._id,
        performerRole: req.user.role,
        targetType: 'Storage',
        targetId: 'all',
        details: {
          orphanedDeleted: orphanResults.orphaned,
          tempDeleted: tempResults.cleanedCount,
          freedBytes: orphanResults.totalBytes + tempResults.freedBytes,
        },
        ipAddress: req.ip || '',
        requestId: req.id,
      });
    }

    res.json({
      success: true,
      requestId: req.id,
      message: dryRun
        ? `Dry-run completed. Found ${orphanResults.orphaned} orphaned files (${Math.round(orphanResults.totalBytes / 1024)} KB). No files were deleted.`
        : `Cleanup completed. Removed ${orphanResults.orphaned} orphaned files and ${tempResults.cleanedCount} temporary files.`,
      data: {
        dryRun,
        orphans: orphanResults,
        temporary: tempResults,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/upload/fetch-remote (Optional SSRF-protected external URL importer)
 */
export async function fetchRemoteImage(req, res, next) {
  try {
    const { url, folder } = req.body;
    const subfolder = (folder || STORAGE_SUBFOLDERS.PRODUCTS).toLowerCase();

    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: 'Image URL is required.',
      });
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: 'Invalid image URL format.',
      });
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: 'Only HTTP and HTTPS image URLs are supported.',
      });
    }

    // Resolve hostname to IP to prevent SSRF against internal network
    const ips = await dns.resolve4(parsedUrl.hostname).catch(() => []);
    if (ips.length === 0 || ips.some(isPrivateOrReservedIp)) {
      return res.status(403).json({
        success: false,
        requestId: req.id,
        message: 'Security violation: Remote address belongs to a restricted or private network.',
      });
    }

    // Fetch image with abort timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'KhushbooFoodService-ImageFetch/1.0' },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: `Remote server returned status ${response.status}`,
      });
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
      return res.status(400).json({
        success: false,
        requestId: req.id,
        message: 'Remote resource is not an image.',
      });
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Save through fileStorageService
    const saved = await saveFile({
      buffer,
      mimetype: contentType.split(';')[0].trim(),
      subfolder,
    });

    if (req.user) {
      await AuditLog.create({
        action: 'IMAGE_REMOTE_FETCH',
        performedBy: req.user._id,
        performerRole: req.user.role,
        targetType: 'Image',
        targetId: saved.filename,
        details: { remoteUrl: url, subfolder, filename: saved.filename, size: saved.sizeBytes },
        ipAddress: req.ip || '',
        requestId: req.id,
      });
    }

    res.status(201).json({
      success: true,
      requestId: req.id,
      message: 'Remote image fetched and secured in local storage.',
      data: {
        url: saved.url,
        filename: saved.filename,
        subfolder,
        size: saved.sizeBytes,
      },
    });
  } catch (err) {
    next(err);
  }
}
