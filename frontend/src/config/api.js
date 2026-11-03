/**
 * Centralized API configuration module for the frontend.
 *
 * ALL backend API calls must import `apiClient` or `API_BASE_URL` from here.
 * Never hardcode the backend URL anywhere else in the codebase.
 *
 * Environment variable:
 *   VITE_API_BASE_URL — set in frontend/.env (development) or via the hosting
 *   provider's environment settings (production).
 *
 * IMPORTANT: Every VITE_* variable is embedded into the browser bundle at
 * build time. Never put secrets in VITE_* variables.
 *
 * @module config/api
 */

// ── Validate at module load time ─────────────────────────────────────────────

const rawUrl = import.meta.env.VITE_API_BASE_URL;

if (!rawUrl) {
  // Show a visible, actionable error in the browser console during development.
  // In production builds this is a fatal misconfiguration.
  const msg =
    '[api] ❌ VITE_API_BASE_URL is not set.\n' +
    'Create frontend/.env with:\n' +
    '  VITE_API_BASE_URL=http://localhost:5000/api\n' +
    'Then restart the Vite dev server.';
  console.error(msg);
}

// Guard: production builds must not silently target localhost.
if (import.meta.env.PROD && rawUrl && rawUrl.includes('localhost')) {
  console.error(
    '[api] ❌ Production build is targeting localhost. ' +
    'Set VITE_API_BASE_URL to your real backend URL before building.'
  );
}

/**
 * Base URL for all API requests.
 * Falls back to localhost:5000 in development only (never production).
 * @type {string}
 */
export const API_BASE_URL = rawUrl ||
  (import.meta.env.DEV ? 'http://localhost:5000/api' : '');

// ─────────────────────────────────────────────────────────────────────────────
// Axios-based API client
// ─────────────────────────────────────────────────────────────────────────────

import axios from 'axios';

/**
 * Pre-configured Axios instance.
 * - Base URL from environment.
 * - 10-second timeout.
 * - Credentials (cookies) included.
 * - JSON content type.
 *
 * @type {import('axios').AxiosInstance}
 */
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10_000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── Response interceptor — sanitize errors before they reach components ────────
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Pass through canceled / aborted requests cleanly so components can ignore them
    if (axios.isCancel(error) || error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
      return Promise.reject(error);
    }

    if (error.response) {
      // Server returned a response with a non-2xx status.
      // Return only the server's safe message; never expose axios internals.
      const serverMessage =
        error.response.data?.message ||
        `Request failed with status ${error.response.status}.`;
      return Promise.reject(new Error(serverMessage));
    }

    if (error.request) {
      // Request was made but no response received (network error, timeout).
      return Promise.reject(
        new Error('Cannot reach the server. Check your internet connection and try again.')
      );
    }

    // Something else happened.
    return Promise.reject(new Error('An unexpected error occurred.'));
  }
);

// ── Image URL resolver & Placeholders ─────────────────────────────────────────

export const NEUTRAL_PRODUCT_PLACEHOLDER =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400" fill="none"><rect width="400" height="400" fill="%23F3F4F6"/><path d="M160 180H240M160 220H210M140 140H260C271.046 140 280 148.954 280 160V260C280 271.046 271.046 280 260 280H140C128.954 280 120 271.046 120 260V160C120 148.954 128.954 140 140 140Z" stroke="%239CA3AF" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export const NEUTRAL_BANNER_PLACEHOLDER =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600" viewBox="0 0 1200 600" fill="none"><rect width="1200" height="600" fill="%231B4332"/><circle cx="600" cy="300" r="160" fill="%232D6A4F" fill-opacity="0.4"/><path d="M570 270H630M570 310H610M550 230H650C661.046 230 670 238.954 670 250V350C670 361.046 661.046 370 650 370H550C538.954 370 530 361.046 530 350V250C530 238.954 538.954 230 550 230Z" stroke="%23D4A373" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const _configuredUploadsBase = (import.meta.env.VITE_UPLOADS_BASE_URL || '')
  .trim()
  .replace(/\/+$/, '')
  .replace(/\/uploads$/, '');

const _rawApiBase = (import.meta.env.VITE_API_BASE_URL || '').trim();

// Automatically derive host from VITE_API_BASE_URL if VITE_UPLOADS_BASE_URL is not explicitly set
const _derivedApiHost =
  _rawApiBase.startsWith('http://') || _rawApiBase.startsWith('https://')
    ? _rawApiBase.replace(/\/api(\/v\d+)?\/?$/, '')
    : '';

const PRIVATE_DIRECTORIES = new Set(['documents', 'temporary']);

const UPLOAD_PREFIX_SEGMENTS = [
  ['api', 'v1', 'uploads'],
  ['api', 'uploads'],
  ['uploads'],
];

/**
 * Checks whether a URL or path targets private storage (documents or temporary)
 * under recognized upload prefixes (/uploads, /api/v1/uploads, /api/uploads).
 *
 * Requirements:
 * 1. Normalize URI encoding, backslashes, case and dot segments.
 * 2. Detect exact documents and temporary directory segments under those upload prefixes.
 * 3. Do not classify unrelated paths such as /assets/documents/icon.webp as private.
 * 4. Fails closed (returns true) on malformed URI encoding.
 * 5. Does not block unrelated filenames such as /uploads/my-documents-image.webp.
 *
 * @param {string} urlOrPath
 * @returns {boolean}
 */
export function isPrivateUploadPath(urlOrPath) {
  if (!urlOrPath || typeof urlOrPath !== 'string') return false;

  let pathStr = urlOrPath.trim().split('?')[0];
  if (pathStr.startsWith('http://') || pathStr.startsWith('https://')) {
    try {
      pathStr = new URL(pathStr).pathname;
    } catch (_e) {
      return true; // Fail closed on malformed URL
    }
  }

  let decoded = '';
  try {
    decoded = decodeURIComponent(pathStr);
  } catch (_e) {
    return true; // Fail closed on malformed URI encoding
  }

  // Normalize backslashes to forward slashes and lowercase
  const rawNormalized = decoded.replace(/\\/g, '/').toLowerCase();

  // Resolve dot-segments (normalize ., ..)
  const parts = rawNormalized.split('/');
  const segments = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') {
      segments.pop();
    } else {
      segments.push(part);
    }
  }

  // Find matching upload prefix and test if the remaining path targets a private directory
  for (const prefix of UPLOAD_PREFIX_SEGMENTS) {
    if (segments.length >= prefix.length && prefix.every((seg, idx) => segments[idx] === seg)) {
      const rest = segments.slice(prefix.length);
      if (rest.length > 0 && PRIVATE_DIRECTORIES.has(rest[0])) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Resolves a stored image path (e.g. "/uploads/products/uuid.webp") into an accessible URL.
 *
 * Requirements:
 * 1. Absolute HTTP/HTTPS URLs remain unchanged.
 * 2. Data and blob URLs remain unchanged.
 * 3. /uploads/... paths resolve using VITE_UPLOADS_BASE_URL when configured.
 * 4. If VITE_UPLOADS_BASE_URL is empty, derives the backend origin safely from VITE_API_BASE_URL.
 * 5. If neither provides an absolute origin, returns same-origin relative URLs.
 * 6. Avoids duplicate /uploads segments.
 * 7. Does not make private document paths public.
 *
 * @param {string} urlOrPath
 * @returns {string}
 */
export function resolveImageUrl(urlOrPath) {
  if (!urlOrPath || typeof urlOrPath !== 'string') return '';

  const trimmed = urlOrPath.trim();

  // Already an absolute URL, data URI, or blob URL — return as-is.
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }

  // Do not make private documents or temporary staging paths public
  if (isPrivateUploadPath(trimmed)) {
    return trimmed;
  }

  const normalized = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;

  // Only resolve /uploads/ paths
  if (!normalized.startsWith('/uploads/')) {
    return trimmed;
  }

  // 1. Explicit VITE_UPLOADS_BASE_URL takes highest precedence
  if (_configuredUploadsBase) {
    return `${_configuredUploadsBase}${normalized}`;
  }

  // 2. If VITE_API_BASE_URL was configured with an absolute URL, target that backend origin
  if (_derivedApiHost) {
    return `${_derivedApiHost}${normalized}`;
  }

  // 3. Same-origin relative path fallback
  return normalized;
}

/**
 * Returns an alternative route through /api/v1/uploads if direct /uploads fails.
 * Useful as a failover for environments where Nginx only proxies /api to Node.js.
 *
 * @param {string} urlOrPath
 * @returns {string}
 */
export function getApiUploadUrl(urlOrPath) {
  if (!urlOrPath || typeof urlOrPath !== 'string') return '';

  const trimmed = urlOrPath.trim();
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }

  // Do not generate public fallback URLs for private document or temporary paths
  if (isPrivateUploadPath(trimmed)) {
    return trimmed;
  }

  const normalized = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  if (!normalized.startsWith('/uploads/')) {
    return resolveImageUrl(urlOrPath);
  }

  const host = _configuredUploadsBase || _derivedApiHost;
  return host ? `${host}/api/v1${normalized}` : `/api/v1${normalized}`;
}
