/**
 * Public Promotional Banner Routes.
 *
 * Exposes:
 * - GET /api/v1/banners: returns currently active, scheduled, and eligible banners.
 *
 * @module routes/bannerRoutes
 */

import express from 'express';
import { getPublicBanners } from '../controllers/bannerController.js';

const router = express.Router();

router.get('/', getPublicBanners);

export default router;
