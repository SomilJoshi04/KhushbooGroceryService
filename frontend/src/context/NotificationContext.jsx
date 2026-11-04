/**
 * Notification Context & Position-Aware Real-Time State Management.
 *
 * Implements:
 * - Single source of truth from MongoDB backed by REST endpoints.
 * - Reactive real-time updates via SocketContext (`notification:new`).
 * - Position-aware toast delivery:
 *     - Displays floating in-app toasts when notifications arrive.
 *     - Suppresses duplicate toasts if the notification centre dropdown is actively open.
 *     - Never forces automatic page scrolling (preserves user browsing at any scroll position).
 *     - FIFO toast queue capping (maximum 3 concurrent visible toasts).
 * - Multi-tab and background tab coordination:
 *     - Desktop Notification API integration for background tabs (when user permitted).
 *     - Synchronizes unread counts and records upon returning to active tab (`visibilitychange`).
 *     - Reconnection state synchronization on WebSocket connect.
 * - IntersectionObserver tracking for notification bell viewport visibility.
 * - Robust deduplication by persistent MongoDB notification ID.
 * - Audio playback integration with cooldowns and browser autoplay restriction handling.
 *
 * @module context/NotificationContext
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '../config/api.js';
import { useAuth } from './AuthContext.jsx';
import { useSocket } from './SocketContext.jsx';
import {
  playNotificationSound,
  testNotificationSound,
  initializeAudioUnlock,
  unlockAudioWithInteraction,
} from '../utils/soundManager.js';
import { swrCache } from '../utils/swrCache.js';
import {
  isPushSupported,
  getCurrentSubscription,
  subscribeToPush,
  unsubscribeFromPush,
  sendTestPushNotification,
  getPermissionState,
} from '../utils/pushManager.js';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { isAuthenticated, user } = useAuth();
  const { socket, isConnected } = useSocket();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [globalSoundEnabled, setGlobalSoundEnabled] = useState(true);
  const [soundCooldownSeconds, setSoundCooldownSeconds] = useState(3);
  const [audioBlocked, setAudioBlocked] = useState(false);

  // Position-aware toast notifications state
  const [toasts, setToasts] = useState([]);
  const [isNotificationCenterOpen, setIsNotificationCenterOpenState] = useState(false);
  const [isBellInViewport, setIsBellInViewport] = useState(true);
  const [desktopPermission, setDesktopPermission] = useState(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'denied';
  });

  // Browser Web Push (VAPID) State
  const [isPushSubscribed, setIsPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const pushSupported = isPushSupported();

  // Stable references for socket listeners and observers
  const isNotificationCenterOpenRef = useRef(false);
  const displayedToastIdsRef = useRef(new Set());
  const bellElementRef = useRef(null);
  const observerRef = useRef(null);

  const soundConfigRef = useRef({
    globalSoundEnabled: true,
    soundCooldownSeconds: 3,
    userRole: 'CUSTOMER',
    userSoundEnabled: true,
  });

  useEffect(() => {
    const isPathAdmin = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');
    const role = user?.role || (isPathAdmin ? 'ADMIN' : 'CUSTOMER');
    soundConfigRef.current = {
      globalSoundEnabled,
      soundCooldownSeconds,
      userRole: role,
      userSoundEnabled: user?.soundEnabled ?? true,
    };
  }, [globalSoundEnabled, soundCooldownSeconds, user]);

  // Sync notification center open state
  const setNotificationCenterOpen = useCallback((isOpen) => {
    isNotificationCenterOpenRef.current = isOpen;
    setIsNotificationCenterOpenState(isOpen);
  }, []);

  // Programmatically open notification center
  const openNotificationCenter = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('khushboo:open_notification_center'));
    }
  }, []);

  // Register notification bell element with IntersectionObserver
  const registerBellElement = useCallback((node) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    bellElementRef.current = node;

    if (node && typeof window !== 'undefined' && 'IntersectionObserver' in window) {
      // Immediate bounds check
      try {
        const rect = node.getBoundingClientRect();
        const inView =
          rect.top < window.innerHeight &&
          rect.bottom > 0 &&
          rect.left < window.innerWidth &&
          rect.right > 0;
        setIsBellInViewport(inView);
      } catch {
        setIsBellInViewport(true);
      }

      const observer = new IntersectionObserver(
        ([entry]) => {
          setIsBellInViewport(Boolean(entry?.isIntersecting));
        },
        { threshold: 0.1 }
      );

      observer.observe(node);
      observerRef.current = observer;
    }
  }, []);

  // Clean up observer on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, []);

  // Dispatch a floating in-app toast
  const dispatchToast = useCallback((notification) => {
    if (!notification || !notification._id) return;

    // Deduplicate: avoid displaying multiple toasts for the exact same notification
    if (displayedToastIdsRef.current.has(notification._id)) {
      return;
    }
    displayedToastIdsRef.current.add(notification._id);

    setToasts((prev) => {
      // Limit to maximum 3 visible toasts (drop oldest if at capacity)
      const trimmed = prev.slice(0, 2);
      return [
        {
          id: notification._id,
          notification,
          timestamp: Date.now(),
        },
        ...trimmed,
      ];
    });
  }, []);

  // Dismiss a toast by ID
  const dismissToast = useCallback((toastId) => {
    setToasts((prev) => prev.filter((t) => t.id !== toastId));
  }, []);

  // Clear all active toasts
  const clearAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  // Request native browser desktop notification permission
  const requestDesktopPermission = useCallback(async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        setDesktopPermission(perm);
        return perm === 'granted';
      } catch (err) {
        console.warn('[notifications] Desktop permission error:', err.message);
      }
    }
    return false;
  }, []);

  // Synchronize Web Push subscription state with browser PushManager
  useEffect(() => {
    if (!isAuthenticated || !pushSupported) {
      setIsPushSubscribed(false);
      return;
    }

    let isMounted = true;
    getCurrentSubscription()
      .then((sub) => {
        if (isMounted) {
          setIsPushSubscribed(Boolean(sub));
        }
      })
      .catch(() => {
        if (isMounted) setIsPushSubscribed(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, pushSupported]);

  // Listen to background Web Push notifications received via Service Worker postMessage
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    const handleSwMessage = (event) => {
      if (event.data?.type === 'KHUSHBOO_PUSH_RECEIVED') {
        fetchUnreadCount();
        fetchNotifications(1);
      }
    };

    navigator.serviceWorker.addEventListener('message', handleSwMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleSwMessage);
    };
  }, []);

  // Web Push subscribe handler
  const enablePush = useCallback(async () => {
    setPushLoading(true);
    try {
      const sub = await subscribeToPush();
      setIsPushSubscribed(Boolean(sub));
      setDesktopPermission('granted');
      return { success: true, subscription: sub };
    } catch (err) {
      console.warn('[notifications] Failed to enable push:', err.message);
      throw err;
    } finally {
      setPushLoading(false);
    }
  }, []);

  // Web Push unsubscribe handler
  const disablePush = useCallback(async () => {
    setPushLoading(true);
    try {
      await unsubscribeFromPush();
      setIsPushSubscribed(false);
      return { success: true };
    } catch (err) {
      console.warn('[notifications] Failed to disable push:', err.message);
      throw err;
    } finally {
      setPushLoading(false);
    }
  }, []);

  // Web Push immediate test notification handler
  const testPush = useCallback(async () => {
    try {
      return await sendTestPushNotification();
    } catch (err) {
      console.warn('[notifications] Failed to send test push:', err.message);
      throw err;
    }
  }, []);

  // Initialize browser audio unlock listener on mount
  useEffect(() => {
    initializeAudioUnlock();

    const handleBlocked = (e) => {
      setAudioBlocked(Boolean(e.detail?.blocked));
    };
    window.addEventListener('khushboo:audio_blocked', handleBlocked);
    return () => window.removeEventListener('khushboo:audio_blocked', handleBlocked);
  }, []);

  const enableAudioAlerts = useCallback(async () => {
    const success = await unlockAudioWithInteraction();
    if (success) {
      setAudioBlocked(false);
    }
    return success;
  }, []);

  // Fetch initial global settings using shared SWR cache
  useEffect(() => {
    let isMounted = true;
    swrCache
      .fetchWithSWR(
        'store_settings',
        async () => {
          const res = await apiClient.get('/v1/store/settings');
          return res.data?.data || null;
        },
        {
          ttlMs: 5 * 60 * 1000,
          onSuccess: (d) => {
            if (!isMounted || !d?.notificationSettings) return;
            if (typeof d.notificationSettings.soundEnabled === 'boolean') {
              setGlobalSoundEnabled(d.notificationSettings.soundEnabled);
            }
            if (typeof d.notificationSettings.soundCooldownSeconds === 'number') {
              setSoundCooldownSeconds(d.notificationSettings.soundCooldownSeconds);
            }
          },
        }
      )
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    totalPages: 1,
    totalRecords: 0,
    hasNextPage: false,
  });

  /**
   * Fetches authoritative unread count from backend.
   */
  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      return;
    }
    try {
      const res = await apiClient.get('/notifications/unread-count');
      if (res.data?.success && typeof res.data.unreadCount === 'number') {
        setUnreadCount(res.data.unreadCount);
      }
    } catch (err) {
      console.warn('[notifications] Failed to fetch unread count:', err.message);
    }
  }, [isAuthenticated]);

  /**
   * Fetches paginated notifications from backend.
   */
  const fetchNotifications = useCallback(
    async ({ page = 1, limit = 20, isRead, category } = {}) => {
      if (!isAuthenticated) {
        setNotifications([]);
        return;
      }
      setLoading(true);
      try {
        const params = { page, limit };
        if (isRead !== undefined && isRead !== 'ALL') {
          params.isRead = isRead;
        }
        if (category && category !== 'ALL') {
          params.category = category;
        }

        const res = await apiClient.get('/notifications', { params });
        if (res.data?.success) {
          const fetchedItems = res.data.data?.notifications || res.data.notifications || [];
          setNotifications(fetchedItems);
          if (res.data.data?.pagination) {
            setPagination(res.data.data.pagination);
          }
          if (typeof res.data.data?.unreadCount === 'number') {
            setUnreadCount(res.data.data.unreadCount);
          }
        }
      } catch (err) {
        console.warn('[notifications] Failed to fetch notifications:', err.message);
      } finally {
        setLoading(false);
      }
    },
    [isAuthenticated]
  );

  // Initial fetch on login or user change
  useEffect(() => {
    if (isAuthenticated) {
      fetchUnreadCount();
      fetchNotifications({ page: 1, limit: 15 });
    } else {
      setNotifications([]);
      setUnreadCount(0);
      setToasts([]);
      displayedToastIdsRef.current.clear();
    }
  }, [isAuthenticated, user?._id, fetchUnreadCount, fetchNotifications]);

  // Synchronize notifications when user returns to active tab or WebSocket reconnects
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (typeof document === 'undefined') return;
      if (document.visibilityState === 'visible' && isAuthenticated) {
        fetchUnreadCount();
        fetchNotifications({ page: 1, limit: 15 });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated, fetchUnreadCount, fetchNotifications]);

  // Listen to Socket.IO real-time notification events
  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (notification) => {
      if (!notification || !notification._id) return;

      // 1. Update persistent notification history in state (deduplicated)
      setNotifications((prev) => {
        if (prev.some((n) => n._id === notification._id)) {
          return prev;
        }
        return [notification, ...prev];
      });

      // 2. Increment unread badge counter immediately
      setUnreadCount((prev) => prev + 1);

      // 3. Play production notification sound (if eligible, enabled, and outside cooldown)
      const currentCfg = soundConfigRef.current;
      const isPathAdmin = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');
      const isNotifAdmin = notification.recipientRole === 'ALL_ADMINS';
      const effectiveRole =
        isNotifAdmin || isPathAdmin
          ? (['ADMIN', 'SUPER_ADMIN', 'STAFF'].includes(currentCfg.userRole) ? currentCfg.userRole : 'ADMIN')
          : currentCfg.userRole;

      playNotificationSound({
        notification,
        userRole: effectiveRole,
        globalSoundEnabled: currentCfg.globalSoundEnabled,
        userSoundEnabled: currentCfg.userSoundEnabled,
        cooldownSeconds: currentCfg.soundCooldownSeconds,
      }).catch((err) => {
        console.warn('[sound] Playback error suppressed:', err?.message);
      });

      // 4. Trigger live UI refresh for active order lists (admin orders and customer order tracking)
      const isOrderEvent =
        notification.category === 'ORDER' ||
        (typeof notification.type === 'string' && notification.type.startsWith('ORDER_'));
      if (isOrderEvent && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('khushboo:order_state_changed', { detail: notification }));
      }

      // 5. Background Tab Handling
      const isTabHidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
      if (isTabHidden) {
        // Tab is in background: deliver native browser desktop notification if permission was granted
        try {
          if ('Notification' in window && Notification.permission === 'granted') {
            const nativeNotif = new Notification(notification.title || 'Khushboo Grocery', {
              body: notification.message,
              icon: '/websiteLogo.png',
              badge: '/websiteLogo.png',
            });
            nativeNotif.onclick = () => {
              window.focus();
              if (notification.actionUrl) {
                window.location.href = notification.actionUrl;
              }
            };
          }
        } catch {
          // Ignore native notification errors
        }
        // Do not display in-app toast when tab is not visible
        return;
      }

      // 6. Intelligent Position-Aware Toast Visibility Handling:
      // If the notification centre dropdown is actively OPEN, the user is looking directly
      // at the notification list where the item is already prepended at the top.
      // In this case, avoid showing a duplicate floating toast.
      const isCenterOpen = isNotificationCenterOpenRef.current;
      if (isCenterOpen) {
        return;
      }

      // If the notification centre is closed, display the in-app toast in a fixed position
      // visible on the user's active viewport (whether at top or bottom of page, or bell is offscreen)
      // without modifying their scroll position.
      dispatchToast(notification);
    };

    const handleCountUpdate = (data) => {
      if (data && typeof data.unreadCount === 'number') {
        setUnreadCount(data.unreadCount);
      }
    };

    const handleSettingsUpdate = (data) => {
      if (data?.notificationSettings) {
        if (typeof data.notificationSettings.soundEnabled === 'boolean') {
          setGlobalSoundEnabled(data.notificationSettings.soundEnabled);
        }
        if (typeof data.notificationSettings.soundCooldownSeconds === 'number') {
          setSoundCooldownSeconds(data.notificationSettings.soundCooldownSeconds);
        }
      }
    };

    const handleSocketReconnect = () => {
      if (isAuthenticated) {
        fetchUnreadCount();
        fetchNotifications({ page: 1, limit: 15 });
      }
    };

    socket.on('notification:new', handleNewNotification);
    socket.on('notification:count', handleCountUpdate);
    socket.on('settings:updated', handleSettingsUpdate);
    socket.on('connect', handleSocketReconnect);

    return () => {
      socket.off('notification:new', handleNewNotification);
      socket.off('notification:count', handleCountUpdate);
      socket.off('settings:updated', handleSettingsUpdate);
      socket.off('connect', handleSocketReconnect);
    };
  }, [socket, isAuthenticated, fetchUnreadCount, fetchNotifications, dispatchToast]);

  /**
   * Marks a single notification as read.
   */
  const markAsRead = async (notificationId) => {
    if (!notificationId) return;

    // Optimistic local state update
    setNotifications((prev) =>
      prev.map((n) =>
        n._id === notificationId ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
      )
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      await apiClient.patch(`/notifications/${notificationId}/read`);
    } catch (err) {
      console.warn('[notifications] Error marking as read:', err.message);
      fetchUnreadCount();
    }
  };

  /**
   * Marks all notifications as read.
   */
  const markAllAsRead = async () => {
    // Optimistic local state update
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
    );
    setUnreadCount(0);

    try {
      await apiClient.patch('/notifications/mark-all-read');
    } catch (err) {
      console.warn('[notifications] Error marking all as read:', err.message);
      fetchUnreadCount();
    }
  };

  /**
   * Deletes a notification by ID.
   */
  const deleteNotification = async (notificationId) => {
    if (!notificationId) return;

    const target = notifications.find((n) => n._id === notificationId);
    setNotifications((prev) => prev.filter((n) => n._id !== notificationId));
    if (target && !target.isRead) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }

    try {
      await apiClient.delete(`/notifications/${notificationId}`);
    } catch (err) {
      console.warn('[notifications] Error deleting notification:', err.message);
      fetchNotifications();
    }
  };

  /**
   * Clears all read notifications for active user.
   */
  const clearAllRead = async () => {
    setNotifications((prev) => prev.filter((n) => !n.isRead));

    try {
      await apiClient.delete('/notifications/clear-all');
    } catch (err) {
      console.warn('[notifications] Error clearing read notifications:', err.message);
      fetchNotifications();
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        pagination,
        isConnected,
        globalSoundEnabled,
        soundCooldownSeconds,
        audioBlocked,
        enableAudioAlerts,
        testNotificationSound,
        fetchNotifications,
        fetchUnreadCount,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        clearAllRead,
        // Position-aware toast & visibility helpers
        toasts,
        dispatchToast,
        dismissToast,
        clearAllToasts,
        isNotificationCenterOpen,
        setNotificationCenterOpen,
        openNotificationCenter,
        isBellInViewport,
        registerBellElement,
        desktopPermission,
        requestDesktopPermission,
        // Browser Web Push (VAPID) helpers
        pushSupported,
        isPushSubscribed,
        pushLoading,
        enablePush,
        disablePush,
        testPush,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
