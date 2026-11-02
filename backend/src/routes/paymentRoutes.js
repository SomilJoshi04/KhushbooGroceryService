/**
 * Payment Routes.
 *
 * @module routes/paymentRoutes
 */

import express from 'express';
import { rateLimit } from 'express-rate-limit';
import {
  createPaymentIntent,
  verifyPayment,
  handleWebhook,
  refundOrderPayment,
} from '../controllers/paymentController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createPaymentIntentSchema,
  verifyPaymentSchema,
  refundPaymentSchema,
} from '../validation/paymentSchemas.js';
import { env } from '../config/env.js';

const router = express.Router();

const paymentIntentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === 'production' ? 20 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many payment requests from this IP. Please wait a few minutes before trying again.',
  },
});

router.post(
  '/create-intent',
  requireAuth,
  paymentIntentLimiter,
  validate({ body: createPaymentIntentSchema }),
  createPaymentIntent
);

router.post(
  '/verify',
  requireAuth,
  validate({ body: verifyPaymentSchema }),
  verifyPayment
);

router.post(
  '/webhook',
  handleWebhook
);

router.post(
  '/orders/:id/refund',
  requireAuth,
  requireRole(['ADMIN', 'SUPER_ADMIN']),
  validate({ body: refundPaymentSchema }),
  refundOrderPayment
);

export default router;
