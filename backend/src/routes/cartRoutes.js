/**
 * Cart Routes — Production Authenticated Cart Management.
 *
 * All cart endpoints strictly require valid customer authentication (requireAuth).
 * Guests cannot read, modify, or checkout from cart.
 *
 * @module routes/cartRoutes
 */

import express from 'express';
import {
  getCart,
  addItemToCart,
  updateCartItemQty,
  removeCartItem,
  clearCart,
  validateCart,
} from '../controllers/cartController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Strict Authentication Guard on all cart operations
router.use(requireAuth);

router.get('/', getCart);
router.post('/items', addItemToCart);
router.put('/items/:itemKey', updateCartItemQty);
router.delete('/items/:itemKey', removeCartItem);
router.delete('/', clearCart);
router.post('/validate', validateCart);

export default router;
