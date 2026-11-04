/**
 * Position-Aware Real-Time Notification Toast.
 *
 * Implements:
 * - Khushboo warm ivory / forest green aesthetic matching design system.
 * - Category-specific Lucide icon with colored background.
 * - Bold title, relative timestamp, and concise message body.
 * - Direct deep-link action button (e.g. "View Order" -> navigates & marks as read).
 * - "Notification Center" secondary link.
 * - Dismiss button ('X').
 * - 6.5-second auto-dismiss with hover pause support.
 * - Smooth entrance and exit animations via framer-motion.
 *
 * @module components/NotificationToast
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Package,
  CreditCard,
  MessageSquare,
  AlertTriangle,
  Tag,
  Info,
  ArrowRight,
  X,
  Bell,
} from 'lucide-react';

function getToastIcon(category, type) {
  switch (category) {
    case 'ORDER':
      return <Package className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 shrink-0" />;
    case 'PAYMENT':
      return <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 shrink-0" />;
    case 'SUPPORT':
      return <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 shrink-0" />;
    case 'INVENTORY':
      return <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 shrink-0" />;
    case 'MARKETING':
    case 'PROMOTION':
      return <Tag className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 shrink-0" />;
    default:
      return <Info className="w-4 h-4 sm:w-5 sm:h-5 text-brand shrink-0" />;
  }
}

function getToastBorderColor(category, severity) {
  if (severity === 'CRITICAL') return 'border-l-rose-500';
  if (severity === 'WARNING') return 'border-l-amber-500';
  if (category === 'ORDER') return 'border-l-emerald-600';
  if (category === 'PAYMENT') return 'border-l-blue-600';
  if (category === 'SUPPORT') return 'border-l-indigo-600';
  return 'border-l-brand';
}

function formatToastTime(isoDate) {
  if (!isoDate) return 'Just now';
  const now = new Date();
  const date = new Date(isoDate);
  const diffSec = Math.floor((now - date) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

export function NotificationToast({
  toast,
  onDismiss,
  onNavigate,
  onOpenCenter,
  autoDismissMs = 6500,
}) {
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef(null);
  const startTimeRef = useRef(Date.now());
  const remainingTimeRef = useRef(autoDismissMs);

  const { notification } = toast;
  const borderColorClass = getToastBorderColor(notification.category, notification.severity);

  useEffect(() => {
    if (isPaused) {
      if (timerRef.current) clearTimeout(timerRef.current);
      remainingTimeRef.current -= Date.now() - startTimeRef.current;
      return;
    }

    startTimeRef.current = Date.now();
    const timeout = Math.max(1000, remainingTimeRef.current);
    timerRef.current = setTimeout(() => {
      onDismiss(toast.id);
    }, timeout);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPaused, toast.id, onDismiss]);

  const handleActionClick = () => {
    if (notification.actionUrl) {
      onNavigate(notification.actionUrl, notification._id);
    } else if (onOpenCenter) {
      onOpenCenter();
    }
    onDismiss(toast.id);
  };

  const handleCenterClick = () => {
    if (onOpenCenter) onOpenCenter();
    onDismiss(toast.id);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -15, scale: 0.96 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      role="alert"
      aria-live="polite"
      className={`pointer-events-auto w-full bg-surface/98 backdrop-blur-md border border-border-neutral rounded-2xl shadow-xl p-3 sm:p-4 text-text-main flex flex-col gap-2 relative overflow-hidden border-l-4 ${borderColorClass} select-none`}
    >
      {/* Top Header: Category Icon, Title, Time, and Dismiss Button */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-xl bg-surface-subtle border border-border-neutral flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
            {getToastIcon(notification.category, notification.type)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1.5">
              <h4 className="font-heading font-bold text-xs sm:text-sm text-text-main truncate leading-tight">
                {notification.title}
              </h4>
              <span className="text-[10px] text-text-muted font-mono shrink-0">
                {formatToastTime(notification.createdAt || toast.timestamp)}
              </span>
            </div>
            <p className="text-xs text-text-muted mt-0.5 line-clamp-2 leading-relaxed">
              {notification.message}
            </p>
          </div>
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          className="p-1 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-subtle transition focus:outline-none focus:ring-1 focus:ring-brand shrink-0 cursor-pointer"
          aria-label="Dismiss notification"
          title="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Action Footer */}
      <div className="pt-2 border-t border-border-neutral/60 flex items-center justify-between gap-2 text-xs">
        {notification.actionUrl ? (
          <button
            type="button"
            onClick={handleActionClick}
            className="px-3 py-1.5 bg-brand hover:bg-brand-hover text-white text-[11px] sm:text-xs font-bold rounded-xl transition inline-flex items-center gap-1.5 shadow-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand"
          >
            <span>{notification.category === 'ORDER' ? 'View Order' : 'View Details'}</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        ) : (
          <div />
        )}

        <button
          type="button"
          onClick={handleCenterClick}
          className="text-[11px] text-text-muted hover:text-brand font-semibold transition inline-flex items-center gap-1 cursor-pointer"
        >
          <Bell className="w-3 h-3 text-brand" />
          <span>Notification Center</span>
        </button>
      </div>
    </motion.div>
  );
}

export default NotificationToast;

