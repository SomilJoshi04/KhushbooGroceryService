/**
 * Catalog Routes — Categories and Products.
 *
 * @module routes/catalogRoutes
 */

import express from 'express';
import {
  getCategories,
  getCategoryBySlugOrId,
  getProducts,
  getProductBySlugOrId,
  createCategory,
  updateCategory,
  deleteCategory,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../controllers/catalogController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createCategorySchema,
  updateCategorySchema,
  createProductSchema,
  updateProductSchema,
  productQuerySchema,
} from '../validation/catalogSchemas.js';

const router = express.Router();

// ── Public Routes ─────────────────────────────────────────────────────────────

router.get('/categories', getCategories);
router.get('/categories/:slugOrId', getCategoryBySlugOrId);

router.get(
  '/products',
  validate({ query: productQuerySchema }),
  getProducts
);

router.get('/products/:slugOrId', getProductBySlugOrId);

// ── Administrative Routes ─────────────────────────────────────────────────────

router.post(
  '/categories',
  requireAuth,
  requireRole('ADMIN', 'SUPER_ADMIN'),
  validate({ body: createCategorySchema }),
  createCategory
);

router.put(
  '/categories/:id',
  requireAuth,
  requireRole('ADMIN', 'SUPER_ADMIN'),
  validate({ body: updateCategorySchema }),
  updateCategory
);

router.delete(
  '/categories/:id',
  requireAuth,
  requireRole('ADMIN', 'SUPER_ADMIN'),
  deleteCategory
);

router.post(
  '/products',
  requireAuth,
  requireRole('ADMIN', 'SUPER_ADMIN'),
  validate({ body: createProductSchema }),
  createProduct
);

router.put(
  '/products/:id',
  requireAuth,
  requireRole('ADMIN', 'SUPER_ADMIN'),
  validate({ body: updateProductSchema }),
  updateProduct
);

router.delete(
  '/products/:id',
  requireAuth,
  requireRole('ADMIN', 'SUPER_ADMIN'),
  deleteProduct
);

export default router;
