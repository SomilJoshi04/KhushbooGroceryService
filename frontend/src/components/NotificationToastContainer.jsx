/**
 * Floating Container for Position-Aware Notification Toasts.
 *
 * Implements:
 * - Fixed viewport positioning on mobile and desktop:
 *     - Mobile: `top-4 left-3 right-3` (well clear of bottom shopping cart bar)
 *     - Desktop: `top-20 right-4 max-w-sm` (below header, un-obstructing content)
 * - Maximum 3 visible toasts with graceful FIFO rotation.
 * - Framer Motion `AnimatePresence` animations.
 * - Non-blocking pointer event handling (`pointer-events-none` container, `pointer-events-auto` cards).
 * - Deep link navigation and optimistic read acknowledgment.
 *
 * @module components/NotificationToastContainer
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useNotifications } from '../context/NotificationContext.jsx';
import { NotificationToast } from './NotificationToast.jsx';

export function NotificationToastContainer() {
  const { toasts, dismissToast, markAsRead, openNotificationCenter } = useNotifications();
  const navigate = useNavigate();

  if (!toasts || toasts.length === 0) {
    return null;
  }

  // Cap maximum concurrent visible toasts to 3 to prevent screen flooding
  const visibleToasts = toasts.slice(0, 3);

  const handleNavigate = (actionUrl, notificationId) => {
    if (notificationId) {
      markAsRead(notificationId);
    }
    if (actionUrl) {
      navigate(actionUrl);
    }
  };

  return (
    <div
      role="region"
      aria-label="Real-time notifications"
      className="fixed top-4 left-3 right-3 sm:left-auto sm:right-4 sm:top-20 z-50 flex flex-col gap-2.5 max-w-full sm:max-w-sm pointer-events-none"
    >
      <AnimatePresence mode="popLayout">
        {visibleToasts.map((toast) => (
          <NotificationToast
            key={toast.id}
            toast={toast}
            onDismiss={dismissToast}
            onNavigate={handleNavigate}
            onOpenCenter={openNotificationCenter}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

export default NotificationToastContainer;

