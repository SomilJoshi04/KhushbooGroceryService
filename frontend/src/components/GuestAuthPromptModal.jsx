/**
 * Polite Guest Authentication Prompt Modal.
 *
 * Appears when an unauthenticated customer attempts to add an item to the cart or checkout.
 * Non-intrusive, polite, and preserves the customer's intended shopping action.
 *
 * @module components/GuestAuthPromptModal
 */

import React from 'react';
import { X, ShoppingBag, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';

export function GuestAuthPromptModal({ isOpen, onClose, onSignIn, pendingAction }) {
  if (!isOpen) return null;

  const product = pendingAction?.product;
  const variant = pendingAction?.variant;
  const qty = pendingAction?.quantityToAdd || 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="guest-auth-title"
    >
      <div className="relative w-full max-w-md bg-surface border border-border-neutral rounded-2xl shadow-2xl p-6 sm:p-7 text-text-main overflow-hidden transform transition-all animate-scaleUp">
        {/* Subtle Decorative Background Accent */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-brand-light/40 rounded-full blur-2xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-text-muted hover:text-text-main hover:bg-surface-subtle transition focus:outline-none focus:ring-2 focus:ring-brand"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand Logo Badge */}
        <div className="flex justify-center mb-4">
          <img
            src="/websiteLogo.png"
            alt="Khushboo Grocery Service Logo"
            className="w-14 h-14 rounded-2xl object-contain shadow-xs border border-border-neutral/60 bg-surface"
          />
        </div>

        {/* Header Texts */}
        <div className="text-center mb-5">
          <h2
            id="guest-auth-title"
            className="text-xl sm:text-2xl font-extrabold font-heading text-text-main tracking-tight mb-2"
          >
            Sign in to start shopping
          </h2>
          <p className="text-xs sm:text-sm text-text-muted leading-relaxed max-w-sm mx-auto">
            Create your account or sign in to add products to your cart, save your selections, and
            place orders with Khushboo Grocery Service.
          </p>
        </div>

        {/* Pending Product Action Preview Card */}
        {product && (
          <div className="mb-5 p-3.5 bg-surface-subtle border border-border-neutral rounded-xl flex items-center gap-3 shadow-2xs">
            <div className="w-12 h-12 rounded-lg bg-surface border border-border-neutral shrink-0 overflow-hidden flex items-center justify-center p-1">
              {product.images?.[0] ? (
                <img
                  src={product.images[0]}
                  alt={product.name}
                  className="w-full h-full object-contain"
                />
              ) : (
                <Sparkles className="w-5 h-5 text-brand" />
              )}
            </div>

            <div className="flex-1 min-w-0 text-left">
              <p className="text-xs font-bold text-text-main truncate">{product.name}</p>
              <p className="text-[11px] text-text-muted flex items-center gap-1.5 mt-0.5">
                <span>{variant?.label || 'Standard Pack'}</span>
                <span>•</span>
                <span>Qty: {qty}</span>
              </p>
              <p className="text-[10px] text-brand font-medium flex items-center gap-1 mt-1">
                <CheckCircle2 className="w-3 h-3 text-brand shrink-0" />
                <span>Ready to add automatically once signed in</span>
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={onSignIn}
            className="w-full py-3 px-4 bg-brand hover:bg-brand-hover text-white font-bold text-sm rounded-xl shadow-xs transition active:scale-[0.99] flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2"
          >
            <span>Sign In / Create Account</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-4 bg-surface hover:bg-surface-subtle border border-border-neutral text-text-muted hover:text-text-main font-semibold text-xs rounded-xl transition text-center focus:outline-none focus:ring-2 focus:ring-border-neutral"
          >
            Continue Shopping
          </button>
        </div>

        {/* Micro Guarantee Note */}
        <p className="text-[11px] text-text-muted text-center mt-4">
          Quick & secure mobile login • Free delivery on orders above ₹499
        </p>
      </div>
    </div>
  );
}
export default GuestAuthPromptModal;
