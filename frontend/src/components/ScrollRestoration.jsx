/**
 * Scroll Restoration Component for Single Page Application.
 *
 * Implements production-ready scroll behavior across all routes:
 * 1. On normal route navigation (PUSH): Resets scroll to top (0, 0) instantly.
 * 2. On browser Back / Forward (POP): Restores previous scroll position with async-content awareness.
 * 3. On same-page interactions (local state, filters, modal open/close): Preserves current scroll position.
 * 4. On hash navigation (#anchor): Smoothly scrolls into view of target anchor.
 * 5. Handles dedicated scroll containers (e.g. admin #admin-main-scroll).
 *
 * @module components/ScrollRestoration
 */

import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

const STORAGE_KEY = 'khushboo_scroll_history';
const MAX_CACHE_ENTRIES = 50;

// In-memory cache for fast lookup during the active session
const memoryScrollCache = new Map();

/**
 * Loads cached scroll positions from sessionStorage
 */
function loadStorageCache() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        Object.entries(parsed).forEach(([k, v]) => {
          memoryScrollCache.set(k, v);
        });
      }
    }
  } catch {
    // Ignore storage quota or access issues
  }
}

/**
 * Persists cached scroll positions to sessionStorage
 */
function persistStorageCache() {
  try {
    const obj = {};
    let count = 0;
    // Keep most recent entries
    for (const [k, v] of memoryScrollCache.entries()) {
      if (count++ > MAX_CACHE_ENTRIES) break;
      obj[k] = v;
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch {
    // Ignore storage quota errors
  }
}

// Initialize storage cache on module load
loadStorageCache();

/**
 * Helper to get the admin scroll container if mounted
 */
function getAdminScrollContainer() {
  return (
    document.getElementById('admin-main-scroll') ||
    document.querySelector('main.overflow-y-auto')
  );
}

/**
 * Captures current scroll positions for both window and admin container
 */
function captureCurrentScroll() {
  const adminContainer = getAdminScrollContainer();
  return {
    windowX: window.scrollX || window.pageXOffset || 0,
    windowY: window.scrollY || window.pageYOffset || 0,
    adminY: adminContainer ? adminContainer.scrollTop : 0,
    timestamp: Date.now(),
  };
}

/**
 * Safely applies scroll position to window and admin container
 * Overrides CSS scroll-behavior: smooth during route transitions to prevent sluggish sliding
 */
function applyScroll(x = 0, y = 0, adminY = 0) {
  const root = document.documentElement;
  const originalBehavior = root.style.scrollBehavior;
  root.style.scrollBehavior = 'auto';

  try {
    window.scrollTo({ left: x, top: y, behavior: 'instant' });
  } catch {
    window.scrollTo(x, y);
  }
  document.body.scrollTop = y;
  root.scrollTop = y;

  const adminContainer = getAdminScrollContainer();
  if (adminContainer) {
    adminContainer.scrollTop = adminY;
  }

  // Restore CSS scroll behavior on next frame
  requestAnimationFrame(() => {
    root.style.scrollBehavior = originalBehavior;
  });
}

export function ScrollRestoration() {
  const location = useLocation();
  const navigationType = useNavigationType();

  const prevLocationRef = useRef(location);
  const currentKeyRef = useRef(location.key || location.pathname);

  // 1. Configure browser manual scroll restoration on mount
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    // Save positions before window unload / refresh
    const handleBeforeUnload = () => {
      const pos = captureCurrentScroll();
      if (currentKeyRef.current) {
        memoryScrollCache.set(currentKeyRef.current, pos);
      }
      persistStorageCache();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // 2. Throttled scroll listener to keep the active page scroll position up-to-date
  useEffect(() => {
    let scrollTimeout = null;

    const handleScroll = () => {
      if (scrollTimeout) return;
      scrollTimeout = setTimeout(() => {
        scrollTimeout = null;
        const key = currentKeyRef.current;
        if (key) {
          const pos = captureCurrentScroll();
          memoryScrollCache.set(key, pos);
          memoryScrollCache.set(location.pathname + location.search, pos);
        }
      }, 100);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('scroll', handleScroll, { capture: true, passive: true });

    return () => {
      if (scrollTimeout) clearTimeout(scrollTimeout);
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, [location.pathname, location.search]);

  // 3. React to Route and Location Changes
  useEffect(() => {
    const prev = prevLocationRef.current;
    const current = location;

    // Save scroll position of the page we are navigating away from
    if (prev && prev.key !== current.key) {
      const exitPos = captureCurrentScroll();
      memoryScrollCache.set(prev.key, exitPos);
      memoryScrollCache.set(prev.pathname + prev.search, exitPos);
      persistStorageCache();
    }

    currentKeyRef.current = current.key || current.pathname;

    // Check if this is hash navigation (e.g. #section)
    if (current.hash) {
      const targetId = current.hash.replace('#', '');
      const scrollIntoHash = () => {
        const element =
          document.getElementById(targetId) ||
          document.querySelector(current.hash) ||
          document.querySelector(`[name="${targetId}"]`);

        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return true;
        }
        return false;
      };

      // Try immediately, or retry after initial render frame
      if (!scrollIntoHash()) {
        const timer = setTimeout(scrollIntoHash, 100);
        return () => clearTimeout(timer);
      }
      prevLocationRef.current = current;
      return;
    }

    // Check Navigation Type
    if (navigationType === 'POP') {
      // Browser Back or Forward pressed
      const saved =
        memoryScrollCache.get(current.key) ||
        memoryScrollCache.get(current.pathname + current.search) ||
        memoryScrollCache.get(current.pathname);

      if (saved && (saved.windowY > 0 || saved.adminY > 0)) {
        // Restore immediately
        applyScroll(saved.windowX || 0, saved.windowY, saved.adminY || 0);

        // Async content polling: If data takes 100-300ms to fetch, ensure we re-assert scroll
        // once page height has expanded to accommodate the saved position
        let attempts = 0;
        const maxAttempts = 5;
        const interval = setInterval(() => {
          attempts += 1;
          const currentHeight = document.documentElement.scrollHeight;
          if (currentHeight >= saved.windowY || attempts >= maxAttempts) {
            applyScroll(saved.windowX || 0, saved.windowY, saved.adminY || 0);
            clearInterval(interval);
          }
        }, 100);

        prevLocationRef.current = current;
        return () => clearInterval(interval);
      }

      // No saved position: fallback cleanly to top
      applyScroll(0, 0, 0);
      prevLocationRef.current = current;
      return;
    }

    if (navigationType === 'PUSH') {
      // Normal route navigation (e.g. clicking a link, navigate() to different page)
      applyScroll(0, 0, 0);
      prevLocationRef.current = current;
      return;
    }

    if (navigationType === 'REPLACE') {
      // If pathname changed on replace (e.g. redirect), scroll to top
      if (prev && prev.pathname !== current.pathname) {
        applyScroll(0, 0, 0);
      }
      // If same pathname (e.g. in-page filter or search param update), do NOT reset scroll
      prevLocationRef.current = current;
      return;
    }

    prevLocationRef.current = current;
  }, [location, navigationType]);

  return null;
}
