/**
 * Public Content Routes — Privacy Policy, FAQs, and Support.
 *
 * @module routes/contentRoutes
 */

import express from 'express';
import {
  getPublicPrivacyPolicy,
  getPublicTerms,
  getPublicFaqs,
  getPublicSupportSettings,
  submitInquiry,
} from '../controllers/contentController.js';
import { optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// Publicly readable information
router.get('/privacy-policy', getPublicPrivacyPolicy);
router.get('/terms', getPublicTerms);
router.get('/faqs', getPublicFaqs);
router.get('/support', getPublicSupportSettings);

// Public inquiry submission (optionalAuth attaches req.user if customer is logged in)
router.post('/inquiry', optionalAuth, submitInquiry);

export default router;
