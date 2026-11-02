/**
 * Mobile Floating Cart Bar Component.
 *
 * Appears on mobile viewports (< 640px) when cart has items and user is not on /cart page.
 * Provides quick access to cart total and instant navigation, matching Blinkit / Instamart UX.
 *
 * @module components/MobileFloatingCartBar
 */

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShoppingBag, ArrowRight } from 'lucide-react';
import { useCart } from '../context/CartContext.jsx';
import { motion, AnimatePresence } from 'framer-motion';

export function MobileFloatingCartBar() {
  const { cartItemCount, cartSubtotalPaise } = useCart();
  const location = useLocation();

  // Do not render on /cart or /admin pages, or when cart is empty
  const isHidden =
    cartItemCount === 0 ||
    location.pathname === '/cart' ||
    location.pathname.startsWith('/admin');

  return (
    <AnimatePresence>
      {!isHidden && (
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 50, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className="fixed bottom-3 left-3 right-3 sm:hidden z-30 pointer-events-auto"
        >
          <Link
            to="/cart"
            className="flex items-center justify-between px-4 py-3 bg-brand text-white rounded-2xl shadow-xl border border-brand-hover/40 active:scale-98 transition focus:outline-none focus:ring-2 focus:ring-brand"
            aria-label={`View Cart: ${cartItemCount} items, ₹${((cartSubtotalPaise || 0) / 100).toFixed(0)}`}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center font-bold">
                <ShoppingBag className="w-4 h-4 text-white" />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-white/80 block leading-none">
                  {cartItemCount} {cartItemCount === 1 ? 'item' : 'items'} in bag
                </span>
                <span className="text-sm font-extrabold font-mono text-white leading-tight">
                  ₹{((cartSubtotalPaise || 0) / 100).toFixed(0)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 font-bold text-xs bg-white text-brand px-3 py-1.5 rounded-xl shadow-xs">
              <span>View Cart</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
