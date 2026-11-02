/**
 * Order Routes.
 *
 * @module routes/orderRoutes
 */

import express from 'express';
import { rateLimit } from 'express-rate-limit';
import {
  createOrder,
  getMyOrders,
  getOrderById,
  cancelOrder,
} from '../controllers/orderController.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createOrderSchema, cancelOrderSchema } from '../validation/orderSchemas.js';
import { env } from '../config/env.js';

const router = express.Router();

const orderCreationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === 'production' ? 15 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many order attempts from this IP. Please wait 15 minutes before creating another order.',
  },
});

router.post(
  '/',
  requireAuth,
  orderCreationLimiter,
  validate({ body: createOrderSchema }),
  createOrder
);

router.get('/', requireAuth, getMyOrders);

router.get('/:id', requireAuth, getOrderById);

router.post(
  '/:id/cancel',
  requireAuth,
  validate({ body: cancelOrderSchema }),
  cancelOrder
);

export default router;
