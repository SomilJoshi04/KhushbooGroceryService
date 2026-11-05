/**
 * React Hook for Order Success Confirmation Sound.
 *
 * Implements:
 * - Controlled post-confirmation sound trigger.
 * - Idempotency per order ID (prevents double playback in React StrictMode, remount, refresh, back/forward).
 * - Graceful browser autoplay policy handling.
 * - Subtle manual play fallback if autoplay is restricted.
 * - Zero impact on order success status or page loading.
 *
 * @module hooks/useOrderSuccessSound
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  extractOrderId,
  isValidSuccessfulOrder,
  hasOrderSoundPlayed,
  claimOrderSound,
  unclaimOrderSound,
  playOrderSuccessSound,
} from '../utils/orderSuccessSound.js';

/**
 * @param {object|string|null} order - The confirmed order object or orderNumber
 * @param {object} [options]
 * @param {boolean} [options.enabled=true] - Whether sound hook is active
 * @param {boolean} [options.autoPlay=true] - Whether to attempt automatic playback on mount
 * @returns {{ soundStatus: string, autoplayBlocked: boolean, playManual: () => Promise<void> }}
 */
export function useOrderSuccessSound(order, options = {}) {
  const { enabled = true, autoPlay = true } = options;

  const [soundStatus, setSoundStatus] = useState('idle'); // 'idle' | 'playing' | 'played' | 'blocked' | 'error'
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  const orderId = extractOrderId(order);
  const attemptedRef = useRef(false);

  // Attempt automatic confirmation sound upon mounting with a genuinely successful order
  useEffect(() => {
    if (!enabled || !autoPlay || !orderId) return;

    // Strict validation: order must exist and not be cancelled/failed
    if (!isValidSuccessfulOrder(order)) return;

    // Idempotency: skip if this order has already played (catches page refresh, back/forward)
    if (hasOrderSoundPlayed(orderId)) {
      setSoundStatus('played');
      return;
    }

    // Shield against duplicate executions within the same component lifecycle
    if (attemptedRef.current) return;
    attemptedRef.current = true;

    let isMounted = true;
    setSoundStatus('playing');

    playOrderSuccessSound(order)
      .then((result) => {
        if (!isMounted) return;

        if (result.success) {
          setSoundStatus('played');
          setAutoplayBlocked(false);
        } else if (result.reason === 'AUTOPLAY_BLOCKED') {
          // Unclaim so user can click the manual fallback button
          unclaimOrderSound(orderId);
          attemptedRef.current = false;
          setAutoplayBlocked(true);
          setSoundStatus('blocked');
        } else if (result.reason === 'ALREADY_PLAYED') {
          setSoundStatus('played');
          setAutoplayBlocked(false);
        } else {
          setSoundStatus('error');
        }
      })
      .catch(() => {
        if (isMounted) setSoundStatus('error');
      });

    return () => {
      isMounted = false;
    };
  }, [enabled, autoPlay, orderId, order]);

  // Accessible manual playback fallback if the browser blocked autoplay
  const playManual = useCallback(async () => {
    if (!orderId || !isValidSuccessfulOrder(order)) return;

    try {
      const result = await playOrderSuccessSound(order, { force: true });
      if (result.success) {
        setSoundStatus('played');
        setAutoplayBlocked(false);
      }
    } catch (err) {
      if (import.meta.env?.DEV) {
        console.warn('[useOrderSuccessSound] Manual playback error:', err.message);
      }
    }
  }, [order, orderId]);

  return {
    soundStatus,
    autoplayBlocked,
    playManual,
  };
}

