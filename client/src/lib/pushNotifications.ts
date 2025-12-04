// SpeedAI Push Notifications Client Library

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

// Convert VAPID key to Uint8Array format required by browser
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Check if push notifications are supported
export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 
         'PushManager' in window && 
         'Notification' in window;
}

// Get current notification permission status
export function getNotificationPermission(): NotificationPermission {
  if (!('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
}

// Request notification permission
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.warn('[Push] Notifications not supported');
    return 'denied';
  }

  const permission = await Notification.requestPermission();
  console.log('[Push] Permission result:', permission);
  return permission;
}

// Register service worker
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.warn('[Push] Service workers not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });
    console.log('[Push] Service worker registered:', registration.scope);
    return registration;
  } catch (error) {
    console.error('[Push] Service worker registration failed:', error);
    return null;
  }
}

// Subscribe to push notifications
export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!isPushSupported()) {
    console.warn('[Push] Push notifications not supported');
    return null;
  }

  if (!VAPID_PUBLIC_KEY) {
    console.error('[Push] VAPID public key not configured');
    return null;
  }

  try {
    // Register service worker first
    const registration = await registerServiceWorker();
    if (!registration) {
      return null;
    }

    // Wait for service worker to be ready
    await navigator.serviceWorker.ready;

    // Check if already subscribed
    let subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      console.log('[Push] Already subscribed');
      return subscription;
    }

    // Subscribe to push
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });

    console.log('[Push] Subscribed successfully');
    return subscription;
  } catch (error) {
    console.error('[Push] Subscription failed:', error);
    return null;
  }
}

// Unsubscribe from push notifications
export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      await subscription.unsubscribe();
      console.log('[Push] Unsubscribed successfully');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('[Push] Unsubscribe failed:', error);
    return false;
  }
}

// Get current push subscription
export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch (error) {
    console.error('[Push] Error getting subscription:', error);
    return null;
  }
}

// Send subscription to server
export async function saveSubscriptionToServer(subscription: PushSubscription): Promise<boolean> {
  try {
    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        subscription: subscription.toJSON()
      }),
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    console.log('[Push] Subscription saved to server');
    return true;
  } catch (error) {
    console.error('[Push] Failed to save subscription:', error);
    return false;
  }
}

// Remove subscription from server
export async function removeSubscriptionFromServer(): Promise<boolean> {
  try {
    const subscription = await getCurrentSubscription();
    
    const response = await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        endpoint: subscription?.endpoint
      }),
      credentials: 'include'
    });

    return response.ok;
  } catch (error) {
    console.error('[Push] Failed to remove subscription from server:', error);
    return false;
  }
}

// Full subscription flow
export async function enablePushNotifications(): Promise<{
  success: boolean;
  subscription: PushSubscription | null;
  error?: string;
}> {
  // Check support
  if (!isPushSupported()) {
    return { 
      success: false, 
      subscription: null, 
      error: 'Push notifications are not supported in this browser' 
    };
  }

  // Request permission
  const permission = await requestNotificationPermission();
  if (permission !== 'granted') {
    return { 
      success: false, 
      subscription: null, 
      error: permission === 'denied' 
        ? 'Notification permission was denied' 
        : 'Notification permission was not granted' 
    };
  }

  // Subscribe to push
  const subscription = await subscribeToPush();
  if (!subscription) {
    return { 
      success: false, 
      subscription: null, 
      error: 'Failed to subscribe to push notifications' 
    };
  }

  // Save to server
  const saved = await saveSubscriptionToServer(subscription);
  if (!saved) {
    return { 
      success: false, 
      subscription, 
      error: 'Failed to save subscription to server' 
    };
  }

  return { success: true, subscription };
}

// Full unsubscription flow
export async function disablePushNotifications(): Promise<boolean> {
  try {
    await removeSubscriptionFromServer();
    await unsubscribeFromPush();
    return true;
  } catch (error) {
    console.error('[Push] Failed to disable push notifications:', error);
    return false;
  }
}

// Notification types for SpeedAI
export type NotificationType = 
  | 'daily_summary'
  | 'alert'
  | 'win'
  | 'affiliation'
  | 'trial_expiring'
  | 'system';

// Notification preferences interface
export interface NotificationPreferences {
  pushEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  dailySummary: boolean;
  alerts: boolean;
  wins: boolean;
  affiliationReminders: boolean;
  quietHoursStart?: string; // "22:00"
  quietHoursEnd?: string;   // "08:00"
}

// Update notification preferences on server
export async function updateNotificationPreferences(
  preferences: Partial<NotificationPreferences>
): Promise<boolean> {
  try {
    const response = await fetch('/api/notifications/preferences', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(preferences),
      credentials: 'include'
    });

    return response.ok;
  } catch (error) {
    console.error('[Push] Failed to update preferences:', error);
    return false;
  }
}

// Get notification preferences from server
export async function getNotificationPreferences(): Promise<NotificationPreferences | null> {
  try {
    const response = await fetch('/api/notifications/preferences', {
      credentials: 'include'
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('[Push] Failed to get preferences:', error);
    return null;
  }
}
