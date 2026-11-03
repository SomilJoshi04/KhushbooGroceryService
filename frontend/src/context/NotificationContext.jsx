/**
 * Notification Context & State Management.
 *
 * Implements:
 * - Single source of truth from MongoDB backed by REST endpoints.
 * - Reactive real-time updates via SocketContext.
 * - Optimistic UI updates for read and deletion operations.
 * - Unread count synchronization across devices and tabs.
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
} from '../utils/soundManager.js';
import { swrCache } from '../utils/swrCache.js';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { isAuthenticated, user } = useAuth();
  const { socket, isConnected } = useSocket();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [globalSoundEnabled, setGlobalSoundEnabled] = useState(true);
  const [soundCooldownSeconds, setSoundCooldownSeconds] = useState(3);

  // Keep ref to avoid stale closures in socket listener
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

  // Initialize browser audio unlock listener on mount
  useEffect(() => {
    initializeAudioUnlock();
  }, []);

  // Fetch initial global settings using shared SWR cache (deduplicated with StoreSettingsContext)
  useEffect(() => {
    let isMounted = true;
    swrCache.fetchWithSWR(
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
    ).catch(() => {});
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
   * Fetches the authoritative unread count from the backend.
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
   * Fetches paginated notifications from the backend.
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
    }
  }, [isAuthenticated, user?._id, fetchUnreadCount, fetchNotifications]);

  // Listen to Socket.IO real-time notification events
  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (notification) => {
      if (!notification || !notification._id) return;

      setNotifications((prev) => {
        // Prevent duplicate entries
        if (prev.some((n) => n._id === notification._id)) {
          return prev;
        }
        return [notification, ...prev];
      });

      setUnreadCount((prev) => prev + 1);

      // Play production notification sound (if eligible, enabled, and outside cooldown)
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

      // Play soft browser notification if permission granted
      try {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(notification.title || 'Khushboo Grocery', {
            body: notification.message,
            icon: '/websiteLogo.png',
          });
        }
      } catch {
        // Ignore native notification errors
      }
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

    socket.on('notification:new', handleNewNotification);
    socket.on('notification:count', handleCountUpdate);
    socket.on('settings:updated', handleSettingsUpdate);

    return () => {
      socket.off('notification:new', handleNewNotification);
      socket.off('notification:count', handleCountUpdate);
      socket.off('settings:updated', handleSettingsUpdate);
    };
  }, [socket]);

  /**
   * Marks a single notification as read.
   */
  const markAsRead = async (notificationId) => {
    if (!notificationId) return;

    // Optimistic local state update
    setNotifications((prev) =>
      prev.map((n) => (n._id === notificationId ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      await apiClient.patch(`/notifications/${notificationId}/read`);
    } catch (err) {
      console.warn('[notifications] Error marking as read:', err.message);
      // Re-fetch on failure to maintain consistency
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
   * Clears all read notifications for the active user.
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
        testNotificationSound,
        fetchNotifications,
        fetchUnreadCount,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        clearAllRead,
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

