/**
 * In-Memory & Session Stale-While-Revalidate (SWR) Cache Manager.
 *
 * Implements:
 * - 0ms instant display of previously fetched catalog, categories, banners, and settings.
 * - Silent background revalidation without wiping UI or flashing unnecessary skeletons.
 * - Concurrent in-flight request deduplication (prevents duplicate simultaneous calls).
 * - Pattern-based cache invalidation when admin performs mutations.
 * - Clean user-isolation on logout.
 *
 * @module utils/swrCache
 */

class SWRCacheManager {
  constructor() {
    this.memoryCache = new Map();
    this.inFlightRequests = new Map();
  }

  /**
   * Retrieves entry from memory or session storage.
   * @param {string} key
   * @returns {{ data: any, isStale: boolean } | null}
   */
  get(key) {
    const now = Date.now();
    let entry = this.memoryCache.get(key);

    if (!entry) {
      // Check session storage
      try {
        if (typeof window !== 'undefined' && window.sessionStorage) {
          const raw = window.sessionStorage.getItem(`kgs_swr_${key}`);
          if (raw) {
            entry = JSON.parse(raw);
            this.memoryCache.set(key, entry);
          }
        }
      } catch {
        // Ignore session parse errors
      }
    }

    if (!entry) return null;

    const isStale = now - entry.timestamp > entry.ttl;
    return { data: entry.data, isStale };
  }

  /**
   * Stores entry in memory and session storage.
   * @param {string} key
   * @param {any} data
   * @param {number} ttlMs - TTL in milliseconds (default 5 minutes)
   */
  set(key, data, ttlMs = 5 * 60 * 1000) {
    const entry = {
      data,
      timestamp: Date.now(),
      ttl: ttlMs,
    };
    this.memoryCache.set(key, entry);

    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.setItem(`kgs_swr_${key}`, JSON.stringify(entry));
      }
    } catch {
      // Storage quota or private mode fallback: memory cache remains valid
    }
  }

  /**
   * Fetch with Stale-While-Revalidate pattern and request deduplication.
   *
   * @param {string} key - Cache identifier
   * @param {Function} fetcher - Async function returning data
   * @param {object} options
   * @param {number} [options.ttlMs] - Cache TTL (default 3 mins)
   * @param {Function} [options.onSuccess] - Callback when data is ready (cached or fresh)
   * @param {Function} [options.onError] - Error callback
   * @returns {Promise<any>}
   */
  async fetchWithSWR(key, fetcher, options = {}) {
    const { ttlMs = 3 * 60 * 1000, onSuccess, onError } = options;

    const cached = this.get(key);
    let servedCached = false;

    // 1. Immediately provide cached data if available (0ms)
    if (cached && cached.data) {
      servedCached = true;
      if (typeof onSuccess === 'function') {
        onSuccess(cached.data, false /* isFresh */);
      }
      // If cached data is still fresh, return without background network request
      if (!cached.isStale) {
        return cached.data;
      }
    }

    // 2. Request deduplication: reuse in-flight promise if one already exists for this key
    if (this.inFlightRequests.has(key)) {
      try {
        const sharedData = await this.inFlightRequests.get(key);
        if (!servedCached && typeof onSuccess === 'function') {
          onSuccess(sharedData, true);
        }
        return sharedData;
      } catch (err) {
        if (!servedCached && typeof onError === 'function') {
          onError(err);
        }
        throw err;
      }
    }

    // 3. Execute background network fetch
    const requestPromise = (async () => {
      try {
        const freshData = await fetcher();
        this.set(key, freshData, ttlMs);
        if (typeof onSuccess === 'function') {
          onSuccess(freshData, true /* isFresh */);
        }
        return freshData;
      } catch (err) {
        if (!servedCached && typeof onError === 'function') {
          onError(err);
        }
        throw err;
      } finally {
        this.inFlightRequests.delete(key);
      }
    })();

    this.inFlightRequests.set(key, requestPromise);
    return requestPromise;
  }

  /**
   * Invalidate all keys matching pattern (or all if omitted).
   * @param {string|RegExp} [pattern]
   */
  invalidate(pattern) {
    if (!pattern) {
      this.memoryCache.clear();
      try {
        if (typeof window !== 'undefined' && window.sessionStorage) {
          const keys = Object.keys(window.sessionStorage);
          keys.forEach((k) => {
            if (k.startsWith('kgs_swr_')) {
              window.sessionStorage.removeItem(k);
            }
          });
        }
      } catch {}
      return;
    }

    const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;

    for (const key of this.memoryCache.keys()) {
      if (regex.test(key)) {
        this.memoryCache.delete(key);
        try {
          if (typeof window !== 'undefined' && window.sessionStorage) {
            window.sessionStorage.removeItem(`kgs_swr_${key}`);
          }
        } catch {}
      }
    }
  }
}

export const swrCache = new SWRCacheManager();

