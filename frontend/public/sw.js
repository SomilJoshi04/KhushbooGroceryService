/**
 * Service Worker — Khushboo Food Service Web Push & Notification Dispatcher.
 *
 * Implements:
 * - Standard Push API event listener for background VAPID notifications.
 * - Active client awareness: suppresses duplicate OS push if user is actively focused on the site.
 * - Broadcasts KHUSHBOO_PUSH_RECEIVED to open tabs to coordinate notification state.
 * - Deep-linking notificationclick handler: focuses existing tab and navigates, or opens new window.
 * - Tab navigation and state preservation.
 * - Zero intrusive offline caching to ensure zero conflict with dynamic REST APIs & Vite build.
 */

const SW_VERSION = '1.1.0';

// Service Worker Installation
self.addEventListener('install', (event) => {
  // Activate immediately without waiting for existing clients to close
  self.skipWaiting();
});

// Service Worker Activation
self.addEventListener('activate', (event) => {
  // Claim all active clients immediately
  event.waitUntil(self.clients.claim());
});

// Incoming Push Event Handler
self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      let data = {};

      if (event.data) {
        try {
          data = event.data.json();
        } catch {
          data = {
            title: 'Khushboo Food Service',
            body: event.data.text() || 'You have a new update.',
          };
        }
      }

      const clientList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      // Check if any client tab belonging to our origin is currently focused
      const isAnyTabFocused = clientList.some((client) => client.focused);

      const targetUrl = data.url || (data.data && data.data.actionUrl) || '/';
      const notificationId = data.notificationId || (data.data && data.data.notificationId) || '';

      // Notify any open tabs about the push event
      for (const client of clientList) {
        try {
          client.postMessage({
            type: 'KHUSHBOO_PUSH_RECEIVED',
            notificationId,
            targetUrl,
          });
        } catch {
          // Ignore postMessage failure to inactive client
        }
      }

      // If the website tab is actively focused, the in-app real-time toast and UI
      // already display this event to the user. Suppress the OS banner to prevent double alerts.
      if (isAnyTabFocused) {
        return;
      }

      // When tab is hidden, minimized, or website is closed: display system push notification
      const title = (data.title || 'Khushboo Food Service').trim();
      const body = (data.body || data.message || 'You have a new notification.').trim();
      const icon = data.icon || '/websiteLogo.png';
      const badge = data.badge || '/favicon.svg';
      const tag = data.tag || (notificationId ? `khushboo-${notificationId}` : `khushboo-notification-${Date.now()}`);

      const options = {
        body,
        icon,
        badge,
        tag,
        renotify: true,
        requireInteraction: false,
        vibrate: [150, 80, 150],
        data: {
          url: targetUrl,
          notificationId,
          timestamp: Date.now(),
        },
      };

      await self.registration.showNotification(title, options);
    })()
  );
});

// Notification Click Handler — Focus existing tab or open destination URL
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetPath = (event.notification.data && event.notification.data.url) || '/';
  // Construct absolute URL on the current origin
  const destinationUrl = new URL(targetPath, self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If an existing window tab from our origin is open, focus it and navigate
        for (const client of clientList) {
          if (client.url.startsWith(self.location.origin) && 'focus' in client) {
            client.focus();
            if ('navigate' in client && client.url !== destinationUrl) {
              return client.navigate(destinationUrl);
            }
            return client;
          }
        }

        // If no matching window is open, open a new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(destinationUrl);
        }
      })
  );
});

// Notification Close Handler
self.addEventListener('notificationclose', (event) => {
  // Preserved for telemetry if needed
});
