/**
 * Storefront Public Routes — Store Info & Coupon Validation.
 *
 * @module routes/storeRoutes
 */

import express from 'express';
import { validateCoupon, getStoreSettings } from '../controllers/adminController.js';

const router = express.Router();

// Public coupon verification for checkout
router.post('/coupons/validate', validateCoupon);

// Public store operating details and thresholds
router.get('/settings', getStoreSettings);

export default router;
