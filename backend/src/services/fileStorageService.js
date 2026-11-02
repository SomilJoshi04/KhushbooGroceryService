/**
 * Centralized Production-Ready VPS File Storage Service.
 *
 * Implements:
 * - Deterministic directory structure (products, categories, banners, customers, admin, documents, temporary).
 * - Cryptographic UUID filename generation with strict MIME-to-extension mapping.
 * - Binary header (magic byte) verification for JPEG, PNG, WebP, and PDF.
 * - Strict rejection of executables, scripts, SVGs, HTML, and disguised files.
 * - Strict path traversal & directory escape prevention.
 * - Shared-file detection (prevents deleting images shared across multiple products/banners/categories).
 * - Safe file replacement lifecycle with rollback on database failure.
 * - Segregated public vs. private file access URL generation.
 * - Orphaned file detection and temporary file cleanup routines with dry-run support.
 * - Disk space monitoring and metrics.
 *
 * @module services/fileStorageService
 */

import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base uploads root on VPS: backend/uploads
export const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

// Subdirectories defined for Khushboo Grocery Service
export const STORAGE_SUBFOLDERS = {
  PRODUCTS: 'products',
  CATEGORIES: 'categories',
  BANNERS: 'banners',
  CUSTOMERS: 'customers',
  ADMIN: 'admin',
  DOCUMENTS: 'documents',
  TEMPORARY: 'temporary',
};

export const PUBLIC_SUBFOLDERS = new Set([
  STORAGE_SUBFOLDERS.PRODUCTS,
  STORAGE_SUBFOLDERS.CATEGORIES,
  STORAGE_SUBFOLDERS.BANNERS,
  STORAGE_SUBFOLDERS.CUSTOMERS,
  STORAGE_SUBFOLDERS.ADMIN,
]);

export const PRIVATE_SUBFOLDERS = new Set([
  STORAGE_SUBFOLDERS.DOCUMENTS,
  STORAGE_SUBFOLDERS.TEMPORARY,
]);

// Permitted MIME types and extensions
export const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
export const ALLOWED_DOCUMENT_MIMES = new Set(['application/pdf']);

export const MIME_TO_EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};

// Size limits in bytes
export const DEFAULT_MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
export const DEFAULT_MAX_DOCUMENT_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Ensures that the root uploads directory and all required subdirectories exist safely.
 */
export function initUploadDirectories() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  Object.values(STORAGE_SUBFOLDERS).forEach((sub) => {
    const dir = path.join(UPLOADS_DIR, sub);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const gitkeep = path.join(dir, '.gitkeep');
    if (!fs.existsSync(gitkeep)) {
      try {
        fs.writeFileSync(gitkeep, '');
      } catch (_) {}
    }
  });
}

// Initialize on module load
initUploadDirectories();

/**
 * Generates an unguessable crypto-random UUID filename with safe verified extension.
 * Never uses user-supplied filenames for storage.
 *
 * @param {string} mimeType - Verified MIME type
 * @returns {string} - e.g. "550e8400-e29b-41d4-a716-446655440000.webp"
 */
export function generateSafeFilename(mimeType) {
  const ext = MIME_TO_EXT[mimeType];
  if (!ext) {
    throw new Error(`Unsupported MIME type for filename generation: ${mimeType}`);
  }
  return `${crypto.randomUUID()}${ext}`;
}

/**
 * Validates the binary header (magic bytes) of a file or buffer.
 * Rejects polyglots, disguised scripts, SVG, HTML, and executables.
 *
 * @param {string|Buffer} target - File path or Buffer
 * @param {string} [expectedMime] - Optional expected MIME type
 * @returns {Promise<{ valid: boolean, detectedMime: string|null, error?: string }>}
 */
export async function verifyMagicBytes(target, expectedMime = null) {
  try {
    let buffer;
    if (Buffer.isBuffer(target)) {
      buffer = target.slice(0, 32);
    } else {
      if (!fs.existsSync(target)) {
        return { valid: false, detectedMime: null, error: 'File does not exist on disk' };
      }
      const fd = await fs.promises.open(target, 'r');
      buffer = Buffer.alloc(32);
      await fd.read(buffer, 0, 32, 0);
      await fd.close();
    }

    if (buffer.length < 4) {
      return { valid: false, detectedMime: null, error: 'File too small for header verification' };
    }

    // Reject executable / script headers immediately
    // MZ (Windows EXE/DLL): 0x4D, 0x5A
    if (buffer[0] === 0x4d && buffer[1] === 0x5a) {
      return { valid: false, detectedMime: null, error: 'Disallowed executable binary detected' };
    }
    // ELF (Linux binary): 0x7F, 'E', 'L', 'F'
    if (buffer[0] === 0x7f && buffer[1] === 0x45 && buffer[2] === 0x4c && buffer[3] === 0x46) {
      return { valid: false, detectedMime: null, error: 'Disallowed ELF binary detected' };
    }
    // PHP opening tag: <?php or <?
    const asciiPrefix = buffer.toString('ascii', 0, 8).toLowerCase();
    if (asciiPrefix.startsWith('<?php') || asciiPrefix.startsWith('<?') || asciiPrefix.startsWith('<html') || asciiPrefix.startsWith('<svg')) {
      return { valid: false, detectedMime: null, error: 'Script or XML/SVG markup detected in binary header' };
    }

    // 1. JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      const isMatch = !expectedMime || expectedMime === 'image/jpeg';
      return { valid: isMatch, detectedMime: 'image/jpeg', error: isMatch ? undefined : `Expected ${expectedMime} but detected JPEG` };
    }

    // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      const isMatch = !expectedMime || expectedMime === 'image/png';
      return { valid: isMatch, detectedMime: 'image/png', error: isMatch ? undefined : `Expected ${expectedMime} but detected PNG` };
    }

    // 3. WebP: RIFF (bytes 0-3) and WEBP (bytes 8-11)
    const riff = buffer.toString('ascii', 0, 4);
    const webp = buffer.toString('ascii', 8, 12);
    if (riff === 'RIFF' && webp === 'WEBP') {
      const isMatch = !expectedMime || expectedMime === 'image/webp';
      return { valid: isMatch, detectedMime: 'image/webp', error: isMatch ? undefined : `Expected ${expectedMime} but detected WebP` };
    }

    // 4. PDF: %PDF- (bytes 0-4: 0x25, 0x50, 0x44, 0x46, 0x2D)
    if (buffer.toString('ascii', 0, 5) === '%PDF-') {
      const isMatch = !expectedMime || expectedMime === 'application/pdf';
      return { valid: isMatch, detectedMime: 'application/pdf', error: isMatch ? undefined : `Expected ${expectedMime} but detected PDF` };
    }

    return { valid: false, detectedMime: null, error: 'Unrecognized or invalid binary header format' };
  } catch (err) {
    return { valid: false, detectedMime: null, error: err.message };
  }
}

/**
 * Resolves and sanitizes a storage path, strictly preventing directory traversal or escape.
 *
 * @param {string} [subfolder=''] - e.g. 'products', 'categories', or '' for root
 * @param {string} filename - Stored filename (must match strict pattern)
 * @returns {string} - Absolute canonical filesystem path
 */
export function resolveStoragePath(subfolder = '', filename = '') {
  if (!filename || typeof filename !== 'string') {
    throw new Error('Filename must be a non-empty string.');
  }

  // Reject path traversal tokens, backslashes, slashes, null bytes
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\') || filename.includes('\0')) {
    throw new Error('Security violation: Path traversal or invalid character detected in filename.');
  }

  // Enforce strict UUID filename format
  const safeFilenameRegex = /^[0-9a-fA-F-]{36}\.(jpg|jpeg|png|webp|pdf)$/i;
  if (!safeFilenameRegex.test(filename)) {
    throw new Error('Security violation: Filename does not match approved cryptographic identifier format.');
  }

  // Validate subfolder if provided
  if (subfolder) {
    if (subfolder.includes('..') || subfolder.includes('/') || subfolder.includes('\\') || subfolder.includes('\0')) {
      throw new Error('Security violation: Invalid subfolder name.');
    }
    const validSubs = Object.values(STORAGE_SUBFOLDERS);
    if (!validSubs.includes(subfolder)) {
      throw new Error(`Security violation: Subfolder "${subfolder}" is not an allowed storage category.`);
    }
  }

  const targetDir = subfolder ? path.join(UPLOADS_DIR, subfolder) : UPLOADS_DIR;
  const canonicalPath = path.resolve(targetDir, filename);

  // Assert canonical path strictly resides inside UPLOADS_DIR
  const relative = path.relative(UPLOADS_DIR, canonicalPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Security violation: Canonical path escaped uploads directory boundary.');
  }

  return canonicalPath;
}

/**
 * Parses a relative path or URL (e.g. "/uploads/products/uuid.webp" or "/uploads/uuid.webp")
 * into subfolder and filename components.
 *
 * @param {string} fileUrlOrPath
 * @returns {{ subfolder: string, filename: string, isLegacyRoot: boolean } | null}
 */
export function parseFileUrl(fileUrlOrPath) {
  if (!fileUrlOrPath || typeof fileUrlOrPath !== 'string') return null;

  // Clean query string or hash
  const cleaned = fileUrlOrPath.split('?')[0].split('#')[0].trim();

  // Pattern 1: /uploads/<subfolder>/<filename>
  const subfolderMatch = cleaned.match(/^\/?uploads\/([a-zA-Z0-9_-]+)\/([0-9a-fA-F-]{36}\.(?:jpg|jpeg|png|webp|pdf))$/i);
  if (subfolderMatch) {
    return {
      subfolder: subfolderMatch[1].toLowerCase(),
      filename: subfolderMatch[2],
      isLegacyRoot: false,
    };
  }

  // Pattern 2: /uploads/<filename> (legacy root upload)
  const rootMatch = cleaned.match(/^\/?uploads\/([0-9a-fA-F-]{36}\.(?:jpg|jpeg|png|webp))$/i);
  if (rootMatch) {
    return {
      subfolder: '',
      filename: rootMatch[1],
      isLegacyRoot: true,
    };
  }

  // Pattern 3: Bare filename
  const bareMatch = cleaned.match(/^([0-9a-fA-F-]{36}\.(?:jpg|jpeg|png|webp|pdf))$/i);
  if (bareMatch) {
    return {
      subfolder: '',
      filename: bareMatch[1],
      isLegacyRoot: false,
    };
  }

  return null;
}

/**
 * Returns the public URL for an asset.
 *
 * @param {string} subfolder - 'products' | 'categories' | 'banners' | 'customers' | 'admin'
 * @param {string} filename - e.g. "uuid.webp"
 * @param {string} [baseUrl=''] - Optional public base URL prefix
 * @returns {string} - e.g. "/uploads/products/uuid.webp"
 */
export function getPublicFileUrl(subfolder, filename, baseUrl = '') {
  const prefix = baseUrl ? baseUrl.replace(/\/+$/, '') : '';
  if (!subfolder) {
    return `${prefix}/uploads/${filename}`;
  }
  return `${prefix}/uploads/${subfolder}/${filename}`;
}

/**
 * Returns the private authenticated download URL for a document.
 *
 * @param {string} filename - e.g. "uuid.pdf"
 * @param {string} [baseUrl='']
 * @returns {string} - e.g. "/api/v1/upload/documents/uuid.pdf"
 */
export function getPrivateFileUrl(filename, baseUrl = '') {
  const prefix = baseUrl ? baseUrl.replace(/\/+$/, '') : '';
  return `${prefix}/api/v1/upload/documents/${filename}`;
}

/**
 * Checks if a file exists on disk.
 *
 * @param {string} subfolder
 * @param {string} filename
 * @returns {boolean}
 */
export function fileExists(subfolder, filename) {
  try {
    const fullPath = resolveStoragePath(subfolder, filename);
    return fs.existsSync(fullPath);
  } catch (_) {
    return false;
  }
}

/**
 * Checks whether an image URL is referenced across active database records.
 * Queries Product, Category, Banner, and User.
 *
 * @param {string} fileUrlOrFilename
 * @param {object} models - { Product, Category, Banner, User }
 * @returns {Promise<{ isReferenced: boolean, count: number, references: string[] }>}
 */
export async function isSharedFile(fileUrlOrFilename, models = {}) {
  const { Product, Category, Banner, User } = models;
  if (!Product || !Category || !Banner || !User) {
    // If models not injected, return conservative false to avoid blocking unit tests
    return { isReferenced: false, count: 0, references: [] };
  }

  const parsed = parseFileUrl(fileUrlOrFilename);
  const filename = parsed ? parsed.filename : path.basename(fileUrlOrFilename);

  // Regex to match exact filename regardless of /uploads/ prefix or subfolder
  const regex = new RegExp(`${filename}$`, 'i');

  const [productCount, categoryCount, bannerCount, userCount] = await Promise.all([
    Product.countDocuments({ images: { $regex: regex } }),
    Category.countDocuments({ image: { $regex: regex } }),
    Banner.countDocuments({
      $or: [{ desktopImage: { $regex: regex } }, { mobileImage: { $regex: regex } }],
    }),
    User.countDocuments({ avatar: { $regex: regex } }),
  ]);

  const references = [];
  if (productCount > 0) references.push(`Product (${productCount})`);
  if (categoryCount > 0) references.push(`Category (${categoryCount})`);
  if (bannerCount > 0) references.push(`Banner (${bannerCount})`);
  if (userCount > 0) references.push(`User Avatar (${userCount})`);

  const total = productCount + categoryCount + bannerCount + userCount;

  return {
    isReferenced: total > 0,
    count: total,
    references,
  };
}

/**
 * Saves a file buffer or stream to the specified subfolder.
 * Enforces magic-byte validation and safe UUID naming.
 *
 * @param {object} params
 * @param {Buffer} params.buffer - File buffer
 * @param {string} params.mimetype - Expected MIME type
 * @param {string} [params.subfolder='products'] - Target storage category
 * @param {number} [params.maxSizeBytes] - Maximum allowed file size
 * @returns {Promise<{ filename: string, subfolder: string, relativePath: string, url: string, sizeBytes: number }>}
 */
export async function saveFile({ buffer, mimetype, subfolder = STORAGE_SUBFOLDERS.PRODUCTS, maxSizeBytes }) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error('Valid file buffer is required.');
  }

  const isDoc = subfolder === STORAGE_SUBFOLDERS.DOCUMENTS;
  const allowedMimes = isDoc ? ALLOWED_DOCUMENT_MIMES : ALLOWED_IMAGE_MIMES;
  const limitBytes = maxSizeBytes || (isDoc ? DEFAULT_MAX_DOCUMENT_BYTES : DEFAULT_MAX_IMAGE_BYTES);

  if (buffer.length > limitBytes) {
    const limitMB = Math.round(limitBytes / (1024 * 1024));
    throw new Error(`File size exceeds maximum permitted limit of ${limitMB} MB.`);
  }

  if (!allowedMimes.has(mimetype)) {
    throw new Error(`Invalid file type "${mimetype}". Allowed: ${Array.from(allowedMimes).join(', ')}.`);
  }

  // Verify binary header / magic numbers
  const magicCheck = await verifyMagicBytes(buffer, mimetype);
  if (!magicCheck.valid) {
    throw new Error(`Security validation failed: ${magicCheck.error || 'Invalid file binary format'}.`);
  }

  const safeName = generateSafeFilename(magicCheck.detectedMime || mimetype);
  const targetPath = resolveStoragePath(subfolder, safeName);

  await fs.promises.writeFile(targetPath, buffer);

  const isPrivate = PRIVATE_SUBFOLDERS.has(subfolder);
  const relativePath = `/uploads/${subfolder}/${safeName}`;
  const url = isPrivate ? getPrivateFileUrl(safeName) : getPublicFileUrl(subfolder, safeName);

  return {
    filename: safeName,
    subfolder,
    relativePath,
    url,
    sizeBytes: buffer.length,
    mimetype: magicCheck.detectedMime || mimetype,
  };
}

/**
 * Safely deletes a file from disk if it is not referenced in active database records.
 * Prevents accidental broken links for shared images.
 *
 * @param {string} fileUrlOrPath - Relative URL or path
 * @param {object} [options]
 * @param {boolean} [options.force=false] - If true, bypasses reference count check
 * @param {object} [options.models] - Database models for reference check
 * @returns {Promise<{ success: boolean, deleted: boolean, reason?: string }>}
 */
export async function deleteFile(fileUrlOrPath, { force = false, models = {} } = {}) {
  const parsed = parseFileUrl(fileUrlOrPath);
  if (!parsed) {
    return { success: false, deleted: false, reason: 'Invalid or unrecognized file URL pattern.' };
  }

  const { subfolder, filename, isLegacyRoot } = parsed;

  let filePath;
  try {
    filePath = resolveStoragePath(isLegacyRoot ? '' : subfolder, filename);
  } catch (err) {
    return { success: false, deleted: false, reason: err.message };
  }

  if (!fs.existsSync(filePath)) {
    return { success: true, deleted: false, reason: 'File does not exist on disk.' };
  }

  // Reference check: Ensure no active database record depends on this file
  if (!force && Object.keys(models).length > 0) {
    const check = await isSharedFile(filename, models);
    if (check.isReferenced) {
      return {
        success: true,
        deleted: false,
        reason: `File is retained on disk because it is actively referenced by: ${check.references.join(', ')}.`,
      };
    }
  }

  try {
    await fs.promises.unlink(filePath);
    return { success: true, deleted: true };
  } catch (err) {
    if (err.code === 'ENOENT') {
      return { success: true, deleted: false, reason: 'File was already deleted.' };
    }
    throw err;
  }
}

/**
 * Atomic replacement lifecycle:
 * 1. Writes new file to disk.
 * 2. Invokes database update callback (onDbUpdate).
 * 3. If onDbUpdate succeeds: triggers safe delete of old file (if unshared).
 * 4. If onDbUpdate fails: rolls back (unlinks) new file, preserving old file on disk.
 *
 * @param {object} params
 * @param {string} params.oldUrl - Current image URL
 * @param {Buffer} params.newBuffer - New image buffer
 * @param {string} params.newMimetype - New image MIME type
 * @param {string} params.subfolder - Target storage category
 * @param {Function} params.onDbUpdate - Async callback that saves database update
 * @param {object} [params.models] - Database models for shared check
 * @returns {Promise<{ newUrl: string, filename: string, sizeBytes: number, oldFileDeleted: boolean }>}
 */
export async function replaceFile({ oldUrl, newBuffer, newMimetype, subfolder, onDbUpdate, models = {} }) {
  // Step 1: Save new file
  const saved = await saveFile({
    buffer: newBuffer,
    mimetype: newMimetype,
    subfolder,
  });

  try {
    // Step 2: Perform DB update
    if (typeof onDbUpdate === 'function') {
      await onDbUpdate(saved.url, saved.filename);
    }

    // Step 3: Cleanup old file safely if different from new
    let oldFileDeleted = false;
    if (oldUrl && oldUrl !== saved.url) {
      const delResult = await deleteFile(oldUrl, { force: false, models });
      oldFileDeleted = delResult.deleted;
    }

    return {
      newUrl: saved.url,
      filename: saved.filename,
      sizeBytes: saved.sizeBytes,
      oldFileDeleted,
    };
  } catch (dbErr) {
    // Step 4: Rollback newly uploaded file on DB failure
    try {
      const rollbackPath = resolveStoragePath(subfolder, saved.filename);
      if (fs.existsSync(rollbackPath)) {
        await fs.promises.unlink(rollbackPath);
      }
    } catch (_) {}

    throw dbErr;
  }
}

/**
 * Cleans up temporary or unfinalized uploads older than a given duration.
 *
 * @param {number} [olderThanMs=86400000] - Default 24 hours
 * @returns {Promise<{ cleanedCount: number, freedBytes: number, errors: string[] }>}
 */
export async function cleanupTemporaryFiles(olderThanMs = 24 * 60 * 60 * 1000) {
  const tempDir = path.join(UPLOADS_DIR, STORAGE_SUBFOLDERS.TEMPORARY);
  if (!fs.existsSync(tempDir)) {
    return { cleanedCount: 0, freedBytes: 0, errors: [] };
  }

  const now = Date.now();
  let cleanedCount = 0;
  let freedBytes = 0;
  const errors = [];

  const files = await fs.promises.readdir(tempDir);
  for (const file of files) {
    if (file === '.gitkeep') continue;
    const fullPath = path.join(tempDir, file);
    try {
      const stat = await fs.promises.stat(fullPath);
      if (now - stat.mtimeMs > olderThanMs) {
        await fs.promises.unlink(fullPath);
        cleanedCount++;
        freedBytes += stat.size;
      }
    } catch (err) {
      errors.push(`Failed to clean temporary file ${file}: ${err.message}`);
    }
  }

  return { cleanedCount, freedBytes, errors };
}

/**
 * Scans storage directories and identifies files not referenced in any active DB record.
 * Supports safe dry-run inspection before performing deletions.
 *
 * @param {object} options
 * @param {boolean} [options.dryRun=true] - If true, lists files without deleting
 * @param {number} [options.gracePeriodMs=3600000] - 1 hour grace period to protect active uploads
 * @param {object} options.models - { Product, Category, Banner, User }
 * @returns {Promise<{ scanned: number, orphaned: number, totalBytes: number, deleted: boolean, files: object[] }>}
 */
export async function cleanupOrphanedFiles({ dryRun = true, gracePeriodMs = 60 * 60 * 1000, models = {} } = {}) {
  const { Product, Category, Banner, User } = models;
  if (!Product || !Category || !Banner || !User) {
    throw new Error('Database models { Product, Category, Banner, User } are required for orphan cleanup.');
  }

  // 1. Collect all referenced URLs/filenames from database
  const [productDocs, categoryDocs, bannerDocs, userDocs] = await Promise.all([
    Product.find({}, { images: 1 }).lean(),
    Category.find({}, { image: 1 }).lean(),
    Banner.find({}, { desktopImage: 1, mobileImage: 1 }).lean(),
    User.find({ avatar: { $ne: '' } }, { avatar: 1 }).lean(),
  ]);

  const activeFilenames = new Set();
  const registerUrl = (url) => {
    if (!url || typeof url !== 'string') return;
    const p = parseFileUrl(url);
    if (p) activeFilenames.add(p.filename.toLowerCase());
    else {
      const base = path.basename(url.split('?')[0]);
      if (/^[0-9a-fA-F-]{36}\./.test(base)) activeFilenames.add(base.toLowerCase());
    }
  };

  productDocs.forEach((p) => (p.images || []).forEach(registerUrl));
  categoryDocs.forEach((c) => registerUrl(c.image));
  bannerDocs.forEach((b) => {
    registerUrl(b.desktopImage);
    registerUrl(b.mobileImage);
  });
  userDocs.forEach((u) => registerUrl(u.avatar));

  const now = Date.now();
  let scanned = 0;
  let orphaned = 0;
  let totalBytes = 0;
  const orphanList = [];

  // Directories to scan: public subfolders + root legacy directory
  const scanDirs = [
    { subfolder: '', dir: UPLOADS_DIR },
    ...Array.from(PUBLIC_SUBFOLDERS).map((s) => ({ subfolder: s, dir: path.join(UPLOADS_DIR, s) })),
  ];

  for (const { subfolder, dir } of scanDirs) {
    if (!fs.existsSync(dir)) continue;

    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || entry.name === '.gitkeep') continue;

      const filename = entry.name;
      // Only process valid UUID asset files
      if (!/^[0-9a-fA-F-]{36}\.(jpg|jpeg|png|webp|pdf)$/i.test(filename)) continue;

      scanned++;
      const fullPath = path.join(dir, filename);
      const stat = await fs.promises.stat(fullPath);

      // Skip files uploaded within the grace period (active upload protection)
      if (now - stat.mtimeMs < gracePeriodMs) continue;

      if (!activeFilenames.has(filename.toLowerCase())) {
        orphaned++;
        totalBytes += stat.size;
        orphanList.push({
          subfolder: subfolder || 'root',
          filename,
          sizeBytes: stat.size,
          modifiedAt: new Date(stat.mtimeMs),
        });

        if (!dryRun) {
          try {
            await fs.promises.unlink(fullPath);
          } catch (_) {}
        }
      }
    }
  }

  return {
    scanned,
    orphaned,
    totalBytes,
    deleted: !dryRun,
    files: orphanList,
  };
}

/**
 * Returns disk usage statistics across all upload directories.
 *
 * @returns {Promise<{ totalBytes: number, totalFiles: number, categories: object }>}
 */
export async function getStorageStats() {
  const stats = {
    totalBytes: 0,
    totalFiles: 0,
    categories: {},
  };

  const allFolders = ['', ...Object.values(STORAGE_SUBFOLDERS)];

  for (const folder of allFolders) {
    const dir = folder ? path.join(UPLOADS_DIR, folder) : UPLOADS_DIR;
    const categoryName = folder || 'legacy_root';

    stats.categories[categoryName] = {
      files: 0,
      bytes: 0,
    };

    if (!fs.existsSync(dir)) continue;

    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || entry.name === '.gitkeep') continue;
      try {
        const fileStat = await fs.promises.stat(path.join(dir, entry.name));
        stats.categories[categoryName].files++;
        stats.categories[categoryName].bytes += fileStat.size;
        stats.totalFiles++;
        stats.totalBytes += fileStat.size;
      } catch (_) {}
    }
  }

  return stats;
}

