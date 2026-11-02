/**
 * Delivery Service Routes.
 *
 * @module routes/deliveryRoutes
 */

import express from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import {
  calculateDeliveryPricing,
  DELIVERY_SLABS,
  STORE_LOCATION,
  APPROVED_INDORE_PINCODES,
  getEffectiveStoreLocation,
} from '../services/deliveryService.js';
import { StoreSetting } from '../models/StoreSetting.js';
import { env } from '../config/env.js';

const router = express.Router();

const checkDeliverySchema = z.object({
  pincode: z.string().trim().regex(/^\d{6}$/, 'Enter a valid 6-digit PIN code'),
  city: z.string().trim().optional().default('Indore'),
  coordinates: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    })
    .optional(),
  subtotalPaise: z.number().int().min(0).default(0),
}).strict();

router.post(
  '/check',
  validate({ body: checkDeliverySchema }),
  async (req, res, next) => {
    try {
      const result = await calculateDeliveryPricing(req.body);
      res.json({
        success: true,
        requestId: req.id,
        ...result,
      });
    } catch (err) {
      next(err);
    }
  }
);

router.get('/config', async (req, res, next) => {
  try {
    const storeLocation = await getEffectiveStoreLocation();
    const setting = await StoreSetting.findOne().lean();
    res.json({
      success: true,
      requestId: req.id,
      store: {
        city: storeLocation.city,
        pincode: storeLocation.pincode,
        address: storeLocation.address,
      },
      slabs: DELIVERY_SLABS,
      freeDeliveryThresholdPaise: setting?.freeDeliveryThresholdPaise ?? env.FREE_DELIVERY_THRESHOLD_PAISE,
      minOrderAmountPaise: setting?.minOrderAmountPaise ?? env.MIN_ORDER_AMOUNT_PAISE,
      deliveryFeeBasePaise: setting?.deliveryFeeBasePaise ?? env.DELIVERY_FEE_BASE_PAISE,
      estimatedDeliveryWindow: setting?.estimatedDeliveryWindow || '90 - 120 Minutes',
      maxDistanceKm: setting?.maxDeliveryDistanceKm ?? env.MAX_DELIVERY_DISTANCE_KM,
      serviceablePincodes: Array.from(APPROVED_INDORE_PINCODES),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
