/**
 * Cart Flying Thumbnail Animation Overlay.
 *
 * Renders temporary flying product thumbnails that animate from the clicked product card
 * toward the cart icon in the header using Framer Motion.
 * Rendered via createPortal to document.body to prevent clipping by overflow-hidden parent containers.
 *
 * @module components/CartFlyingOverlay
 */

import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

export function CartFlyingOverlay({ flyingItems, onComplete }) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden"
      aria-hidden="true"
    >
      <AnimatePresence>
        {flyingItems.map((item) => {
          // Mid-point curve calculation for natural parabola/arc
          const deltaX = item.targetX - item.startX;
          const deltaY = item.targetY - item.startY;

          // Compute midpoint to create a gentle, natural flight arc toward the header
          const midX = item.startX + deltaX * 0.5;
          // Arch slightly upward unless already near the very top of the viewport
          const midY = item.startY > 120
            ? Math.min(item.startY, item.targetY) - 40
            : (item.startY + item.targetY) / 2;

          // Target scale relative to initialSize
          const targetScale = Math.max(0.18, item.targetSize / item.initialSize);

          return (
            <motion.div
              key={item.id}
              initial={{
                x: item.startX,
                y: item.startY,
                opacity: 1,
                scale: 1,
                rotate: 0,
              }}
              animate={{
                x: [item.startX, midX, item.targetX],
                y: [item.startY, midY, item.targetY],
                scale: [1, 0.8, targetScale],
                opacity: [1, 0.95, 0.2],
                rotate: [0, -8, 12],
              }}
              exit={{ opacity: 0 }}
              transition={{
                duration: 0.65,
                ease: [0.22, 1, 0.36, 1], // natural easeOut cubic curve
                times: [0, 0.5, 1],
              }}
              onAnimationComplete={() => onComplete(item.id)}
              className="fixed top-0 left-0 rounded-xl overflow-hidden shadow-xl border-2 border-white ring-1 ring-brand/30 bg-surface z-[9999] will-change-transform pointer-events-none"
              style={{
                width: item.initialSize,
                height: item.initialSize,
                boxShadow: '0 10px 25px -5px rgba(36, 92, 67, 0.35), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              }}
            >
              <img
                src={item.imageUrl}
                alt=""
                className="w-full h-full object-cover rounded-lg"
                onError={(e) => {
                  e.currentTarget.src =
                    'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=150&q=80';
                }}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>,
    document.body
  );
}
