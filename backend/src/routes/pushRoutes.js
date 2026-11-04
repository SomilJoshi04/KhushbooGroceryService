/**
 * Push Routes — Web Push API Endpoints.
 *
 * Implements:
 * - Public VAPID public key discovery
 * - Authenticated push subscription, unsubscription, and status checks
 * - Immediate test push delivery verification
 *
 * @module routes/pushRoutes
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  getVapidPublicKey,
  subscribe,
  unsubscribe,
  getSubscriptionStatus,
  sendTestPush,
} from '../controllers/pushController.js';

const router = Router();

// Public endpoint for frontend to retrieve application server key
router.get('/vapid-public-key', getVapidPublicKey);

// Authenticated endpoints for managing device subscriptions
router.post('/subscribe', requireAuth, subscribe);
router.post('/unsubscribe', requireAuth, unsubscribe);
router.get('/status', requireAuth, getSubscriptionStatus);
router.post('/test', requireAuth, sendTestPush);

export default router;

