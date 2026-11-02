/**
 * Food routes (interim scaffold).
 *
 * Route-level rate limits and Zod validation applied here.
 * Body size is restricted at the app level (server.js) AND here.
 *
 * SECURITY NOTE: No authentication is applied here yet (P4).
 * The seed endpoint is additionally blocked at the controller level
 * when NODE_ENV=production.
 *
 * @module routes/foodRoutes
 */

import express from 'express';
import { rateLimit } from 'express-rate-limit';

import { validate } from '../middleware/validate.js';
import { createFoodSchema } from '../validation/foodSchemas.js';
import { getFoodItems, createFoodItem, seedFoodItems } from '../controllers/foodController.js';
import { env } from '../config/env.js';

const router = express.Router();

// ── Per-route rate limits ─────────────────────────────────────────────────────

/** Broad read limit: generous for a menu page. */
const readLimiter = rateLimit({
  windowMs: 60 * 1000,      // 1 minute
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please slow down.' },
});

/** Write limit: stricter to limit abuse before auth exists. */
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,      // 1 minute
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please slow down.' },
});

// ── Routes ─────────────────────────────────────────────────────────────────────

router.get('/', readLimiter, getFoodItems);

router.post('/', writeLimiter, validate({ body: createFoodSchema }), createFoodItem);

/**
 * Seed endpoint — development ONLY.
 * In production this returns 404 (both in route guard and controller).
 * TODO (P4): Remove or protect behind admin authentication.
 */
if (env.NODE_ENV !== 'production') {
  router.post('/seed', writeLimiter, seedFoodItems);
}

export default router;
