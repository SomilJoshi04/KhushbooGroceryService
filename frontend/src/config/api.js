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
