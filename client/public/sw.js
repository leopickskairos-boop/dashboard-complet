// SpeedAI Service Worker for Push Notifications
const CACHE_NAME = 'speedai-v1';

// Install event - cache essential assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Push notification event handler
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  
  let data = {
    title: 'SpeedAI',
    body: 'Nouvelle notification',
    icon: '/speedai-icon-192.png',
    badge: '/speedai-badge-72.png',
    tag: 'speedai-notification',
    data: {}
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = {
        title: payload.title || data.title,
        body: payload.body || data.body,
        icon: payload.icon || data.icon,
        badge: payload.badge || data.badge,
        tag: payload.tag || `speedai-${Date.now()}`,
        data: payload.data || {},
        requireInteraction: payload.requireInteraction || false,
        actions: payload.actions || []
      };
    } catch (e) {
      console.error('[SW] Error parsing push data:', e);
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag,
    data: data.data,
    requireInteraction: data.requireInteraction,
    actions: data.actions,
    vibrate: [200, 100, 200],
    timestamp: Date.now()
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.notification.tag);
  event.notification.close();

  const notificationData = event.notification.data || {};
  let targetUrl = '/dashboard';

  // Route based on notification type
  if (notificationData.type) {
    switch (notificationData.type) {
      case 'daily_summary':
        targetUrl = '/dashboard';
        break;
      case 'alert':
        targetUrl = '/dashboard?tab=alerts';
        break;
      case 'win':
        targetUrl = '/dashboard?tab=wins';
        break;
      case 'affiliation':
        targetUrl = '/dashboard?tab=affiliation';
        break;
      case 'trial_expiring':
        targetUrl = '/dashboard?tab=subscription';
        break;
      default:
        targetUrl = notificationData.url || '/dashboard';
    }
  }

  // Handle action button clicks
  if (event.action) {
    switch (event.action) {
      case 'view':
        targetUrl = notificationData.url || '/dashboard';
        break;
      case 'dismiss':
        return;
      case 'call-back':
        if (notificationData.callbackUrl) {
          targetUrl = notificationData.callbackUrl;
        }
        break;
    }
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if available
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Open new window if none exists
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Notification close handler (for analytics)
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed:', event.notification.tag);
  
  const notificationData = event.notification.data || {};
  
  // Send analytics event for notification dismissal
  if (notificationData.notificationId) {
    fetch('/api/notifications/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        notificationId: notificationData.notificationId,
        action: 'dismissed',
        timestamp: Date.now()
      })
    }).catch(console.error);
  }
});

// Background sync for offline notification queuing
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-notifications') {
    event.waitUntil(syncNotifications());
  }
});

async function syncNotifications() {
  console.log('[SW] Syncing notifications...');
  try {
    const response = await fetch('/api/notifications/sync');
    if (response.ok) {
      console.log('[SW] Notifications synced successfully');
    }
  } catch (error) {
    console.error('[SW] Sync failed:', error);
  }
}

// Message handler for communication with main app
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});
