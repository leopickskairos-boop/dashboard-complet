import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  isPushSupported,
  getNotificationPermission,
  enablePushNotifications,
  disablePushNotifications,
  getCurrentSubscription,
  registerServiceWorker,
  type NotificationPreferences
} from '@/lib/pushNotifications';
import { apiRequest } from '@/lib/queryClient';

export interface UsePushNotificationsResult {
  isSupported: boolean;
  permission: NotificationPermission;
  isSubscribed: boolean;
  isLoading: boolean;
  error: string | null;
  preferences: NotificationPreferences | null;
  preferencesLoading: boolean;
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
  updatePreferences: (prefs: Partial<NotificationPreferences>) => Promise<boolean>;
}

export function usePushNotifications(): UsePushNotificationsResult {
  const queryClient = useQueryClient();
  const [isSupported] = useState(() => isPushSupported());
  const [permission, setPermission] = useState<NotificationPermission>(() => 
    getNotificationPermission()
  );
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch notification preferences
  const { data: preferences, isLoading: preferencesLoading } = useQuery<NotificationPreferences>({
    queryKey: ['/api/notifications/preferences'],
    enabled: isSupported
  });

  // Update preferences mutation
  const updatePreferencesMutation = useMutation({
    mutationFn: async (prefs: Partial<NotificationPreferences>) => {
      const response = await apiRequest('PATCH', '/api/notifications/preferences', prefs);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/preferences'] });
    }
  });

  // Check subscription status on mount
  useEffect(() => {
    if (!isSupported) return;

    const checkSubscription = async () => {
      try {
        // Register service worker early
        await registerServiceWorker();
        
        const subscription = await getCurrentSubscription();
        setIsSubscribed(!!subscription);
        setPermission(getNotificationPermission());
      } catch (err) {
        console.error('[usePushNotifications] Error checking subscription:', err);
      }
    };

    checkSubscription();
  }, [isSupported]);

  // Subscribe to push notifications
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      setError('Push notifications are not supported');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await enablePushNotifications();
      
      if (result.success) {
        setIsSubscribed(true);
        setPermission('granted');
        // Update server-side preference
        await updatePreferencesMutation.mutateAsync({ pushEnabled: true });
        return true;
      } else {
        setError(result.error || 'Failed to subscribe');
        return false;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, updatePreferencesMutation]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const success = await disablePushNotifications();
      
      if (success) {
        setIsSubscribed(false);
        // Update server-side preference
        await updatePreferencesMutation.mutateAsync({ pushEnabled: false });
        return true;
      } else {
        setError('Failed to unsubscribe');
        return false;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [updatePreferencesMutation]);

  // Update preferences
  const updatePreferences = useCallback(async (
    prefs: Partial<NotificationPreferences>
  ): Promise<boolean> => {
    try {
      await updatePreferencesMutation.mutateAsync(prefs);
      return true;
    } catch (err) {
      console.error('[usePushNotifications] Error updating preferences:', err);
      return false;
    }
  }, [updatePreferencesMutation]);

  return {
    isSupported,
    permission,
    isSubscribed,
    isLoading: isLoading || updatePreferencesMutation.isPending,
    error,
    preferences: preferences || null,
    preferencesLoading,
    subscribe,
    unsubscribe,
    updatePreferences
  };
}

export default usePushNotifications;
