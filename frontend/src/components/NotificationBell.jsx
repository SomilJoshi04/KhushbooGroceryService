/**
 * Real-Time Notification Bell & Dropdown Component.
 *
 * Implements:
 * - Live unread badge with pulse animation for new notifications.
 * - Categorized notification cards with severity indicators and action deep links.
 * - Single click "Mark read & Navigate" to order, support ticket, or inventory record.
 * - "Mark all read" and "Clear read" controls.
 * - Outside click handling and mobile responsiveness.
 *
 * @module components/NotificationBell
 */

import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  Package,
  CreditCard,
  MessageSquare,
  AlertTriangle,
  Tag,
  Info,
  ExternalLink,
  Wifi,
  WifiOff,
  X,
  Volume2,
  BellRing,
} from 'lucide-react';
import { useNotifications } from '../context/NotificationContext.jsx';

/**
 * Maps notification category to a Lucide icon.
 */
function getCategoryIcon(category, type) {
  switch (category) {
    case 'ORDER':
      return <Package className="w-4 h-4 text-emerald-600" />;
    case 'PAYMENT':
      return <CreditCard className="w-4 h-4 text-blue-600" />;
    case 'SUPPORT':
      return <MessageSquare className="w-4 h-4 text-indigo-600" />;
    case 'INVENTORY':
      return <AlertTriangle className="w-4 h-4 text-amber-600" />;
    case 'MARKETING':
      return <Tag className="w-4 h-4 text-purple-600" />;
    default:
      return <Info className="w-4 h-4 text-brand" />;
  }
}

/**
 * Returns color classes based on severity level.
 */
function getSeverityStyles(severity) {
  switch (severity) {
    case 'CRITICAL':
      return 'border-l-rose-500 bg-rose-500/5 hover:bg-rose-500/10';
    case 'WARNING':
      return 'border-l-amber-500 bg-amber-500/5 hover:bg-amber-500/10';
    case 'SUCCESS':
      return 'border-l-emerald-500 bg-emerald-500/5 hover:bg-emerald-500/10';
    default:
      return 'border-l-brand bg-brand-light/30 hover:bg-brand-light/50';
  }
}

/**
 * Human-readable relative time formatter.
 */
function formatTimeAgo(isoDate) {
  if (!isoDate) return '';
  const now = new Date();
  const date = new Date(isoDate);
  const diffSec = Math.floor((now - date) / 1000);

  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

export function NotificationBell({ placement = 'customer' }) {
  const {
    notifications,
    unreadCount,
    loading,
    isConnected,
    audioBlocked,
    enableAudioAlerts,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllRead,
    registerBellElement,
    setNotificationCenterOpen,
    desktopPermission,
    requestDesktopPermission,
    pushSupported,
    isPushSubscribed,
    enablePush,
    pushLoading,
  } = useNotifications();

  const [pushDismissed, setPushDismissed] = useState(false);

  const [isOpen, setIsOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState('ALL'); // 'ALL' | 'UNREAD'
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Register notification bell element with IntersectionObserver
  useEffect(() => {
    if (dropdownRef.current && typeof registerBellElement === 'function') {
      registerBellElement(dropdownRef.current);
    }
    return () => {
      if (typeof registerBellElement === 'function') {
        registerBellElement(null);
      }
    };
  }, [registerBellElement]);

  // Synchronize notification center open state with context
  useEffect(() => {
    if (typeof setNotificationCenterOpen === 'function') {
      setNotificationCenterOpen(isOpen);
    }
  }, [isOpen, setNotificationCenterOpen]);

  // Listen for programmatic open requests (e.g. from floating toasts)
  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('khushboo:open_notification_center', handleOpen);
    return () => window.removeEventListener('khushboo:open_notification_center', handleOpen);
  }, []);

  // Close dropdown on outside click or touch
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  const filteredNotifications = notifications.filter((n) => {
    if (activeFilter === 'UNREAD') return !n.isRead;
    return true;
  });

  const handleNotificationClick = (notification) => {
    if (!notification.isRead) {
      markAsRead(notification._id);
    }
    if (notification.actionUrl) {
      setIsOpen(false);
      navigate(notification.actionUrl);
    }
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative p-2 rounded-xl bg-surface hover:bg-surface-subtle border border-border-neutral text-text-muted hover:text-text-main transition shadow-xs focus:outline-none focus:ring-1 focus:ring-brand"
        aria-label="View notifications"
        title="Notifications"
      >
        <Bell className="w-4 h-4 sm:w-4.5 sm:h-4.5" />

        {/* Real-time Unread Badge Pill */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-status-error text-[10px] font-bold text-white shadow-xs animate-scaleIn">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}

        {/* Live Socket Connection Dot */}
        <span
          className={`absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full ${
            isConnected ? 'bg-emerald-500' : 'bg-amber-400'
          }`}
          title={isConnected ? 'Live real-time feed connected' : 'Connecting to live feed...'}
        />
      </button>

      {/* Notifications Dropdown Drawer / Popover */}
      {isOpen && (
        <>
          {/* Mobile backdrop overlay */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 sm:hidden animate-fadeIn"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          <div
            className={`fixed inset-x-2.5 top-14 xs:top-16 z-50 max-w-[420px] mx-auto sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[380px] sm:max-w-[400px] bg-surface border border-border-neutral rounded-2xl shadow-2xl overflow-hidden animate-fadeIn flex flex-col`}
            style={{ maxHeight: 'calc(100dvh - 76px)' }}
          >
            {/* Header */}
            <div className="p-3 sm:p-3.5 border-b border-border-neutral flex items-center justify-between bg-surface-subtle/70 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <h3 className="font-heading font-bold text-sm text-text-main truncate">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-brand-light text-brand text-[10px] font-bold shrink-0">
                    {unreadCount} new
                  </span>
                )}
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-medium text-text-muted ml-0.5 shrink-0"
                  title={isConnected ? 'Connected to live push server' : 'Reconnecting to push server'}
                >
                  {isConnected ? (
                    <>
                      <Wifi className="w-3 h-3 text-emerald-600" />
                      <span className="text-emerald-700 font-semibold hidden xs:inline">Live</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-3 h-3 text-amber-500" />
                      <span className="text-amber-600 hidden xs:inline">Syncing</span>
                    </>
                  )}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    className="px-2 py-1 rounded-lg text-[11px] font-semibold text-brand hover:bg-brand-light transition flex items-center gap-1"
                    title="Mark all as read"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Mark read</span>
                  </button>
                )}

                {/* Mobile close button */}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1 sm:hidden rounded-lg text-text-muted hover:text-text-main hover:bg-surface-subtle transition"
                  aria-label="Close notifications"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Browser Autoplay Blocked Banner */}
            {audioBlocked && (
              <div className="p-2.5 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between text-xs text-amber-800 shrink-0">
                <div className="flex items-center gap-1.5 min-w-0 pr-2">
                  <Volume2 className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="truncate text-[11px] font-medium">Browser blocked audio alerts</span>
                </div>
                <button
                  type="button"
                  onClick={enableAudioAlerts}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold rounded-lg transition shrink-0 cursor-pointer shadow-xs active:scale-95"
                >
                  Enable Sound
                </button>
              </div>
            )}

            {/* Web Push / Desktop Notification Opt-in Prompt */}
            {pushSupported && !isPushSubscribed && !pushDismissed && desktopPermission !== 'denied' && (
              <div className="px-3 py-1.5 bg-brand-light/40 border-b border-brand/20 flex items-center justify-between text-[11px] text-brand shrink-0">
                <div className="flex items-center gap-1.5 min-w-0 pr-1">
                  <BellRing className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate font-medium">Receive order alerts when tab is closed?</span>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-1">
                  <button
                    type="button"
                    disabled={pushLoading}
                    onClick={async () => {
                      try {
                        await enablePush();
                      } catch {
                        // Handled in context
                      }
                    }}
                    className="px-2 py-0.5 bg-brand text-white font-bold rounded-md text-[10px] hover:bg-brand-hover transition cursor-pointer shadow-2xs disabled:opacity-50"
                  >
                    {pushLoading ? 'Enabling...' : 'Enable'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPushDismissed(true)}
                    className="p-0.5 text-text-muted hover:text-text-main rounded transition"
                    title="Dismiss"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}

            {/* Filter Pills */}
            <div className="px-3 py-2 border-b border-border-neutral flex items-center justify-between gap-2 bg-surface shrink-0">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                    activeFilter === 'ALL'
                      ? 'bg-brand text-white'
                      : 'bg-surface-subtle text-text-muted hover:text-text-main'
                  }`}
                >
                  All ({notifications.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter('UNREAD')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                    activeFilter === 'UNREAD'
                      ? 'bg-brand text-white'
                      : 'bg-surface-subtle text-text-muted hover:text-text-main'
                  }`}
                >
                  Unread ({unreadCount})
                </button>
              </div>

              {notifications.some((n) => n.isRead) && (
                <button
                  type="button"
                  onClick={clearAllRead}
                  className="text-[11px] text-text-muted hover:text-status-error font-medium transition"
                  title="Remove read notifications"
                >
                  Clear read
                </button>
              )}
            </div>

            {/* Notification Items List */}
            <div className="overflow-y-auto divide-y divide-border-neutral/60 flex-1 overscroll-contain">
            {loading && notifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-text-muted">Loading notifications...</div>
            ) : filteredNotifications.length === 0 ? (
              <div className="py-10 px-4 text-center">
                <div className="w-10 h-10 rounded-full bg-surface-subtle text-text-muted mx-auto flex items-center justify-center mb-2.5">
                  <Bell className="w-5 h-5 opacity-40" />
                </div>
                <p className="text-xs font-bold text-text-main">
                  {activeFilter === 'UNREAD' ? 'No unread notifications' : 'No notifications yet'}
                </p>
                <p className="text-[11px] text-text-muted mt-1 max-w-[220px] mx-auto">
                  {activeFilter === 'UNREAD'
                    ? 'You are all caught up with orders, support updates, and alerts.'
                    : 'Real-time updates about orders, inventory, and promotions will appear here.'}
                </p>
              </div>
            ) : (
              filteredNotifications.map((notification) => {
                const isUnread = !notification.isRead;
                const severityClass = getSeverityStyles(notification.severity);

                return (
                  <div
                    key={notification._id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`relative p-3 transition flex items-start gap-2.5 cursor-pointer border-l-4 ${severityClass} ${
                      isUnread ? 'bg-surface' : 'opacity-85 bg-surface-subtle/30'
                    }`}
                  >
                    {/* Category Icon */}
                    <div className="w-7 h-7 rounded-lg bg-surface border border-border-neutral flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                      {getCategoryIcon(notification.category, notification.type)}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span
                          className={`text-xs font-bold truncate ${
                            isUnread ? 'text-text-main' : 'text-text-muted'
                          }`}
                        >
                          {notification.title}
                        </span>
                        <span className="text-[10px] text-text-muted font-mono shrink-0">
                          {formatTimeAgo(notification.createdAt)}
                        </span>
                      </div>

                      <p className="text-[11.5px] text-text-muted line-clamp-2 leading-relaxed">
                        {notification.message}
                      </p>

                      {/* Deep Link hint */}
                      {notification.actionUrl && (
                        <div className="mt-1 flex items-center gap-1 text-[10.5px] text-brand font-semibold hover:underline">
                          <span>View Details</span>
                          <ExternalLink className="w-3 h-3" />
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div
                      className="flex flex-col items-center gap-1 shrink-0 ml-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {isUnread && (
                        <button
                          type="button"
                          onClick={() => markAsRead(notification._id)}
                          className="p-1 rounded-md text-text-muted hover:text-brand hover:bg-brand-light transition"
                          title="Mark as read"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => deleteNotification(notification._id)}
                        className="p-1 rounded-md text-text-muted hover:text-status-error hover:bg-status-error/10 transition"
                        title="Delete notification"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </>
    )}
  </div>
);
}

