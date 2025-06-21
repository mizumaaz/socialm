import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getOneSignalConfig } from '@/config/onesignal';

interface OneSignalUser {
  subscribed: boolean;
  userId: string | null;
}

export function useOneSignalNotifications() {
  const [oneSignalUser, setOneSignalUser] = useState<OneSignalUser>({
    subscribed: false,
    userId: null
  });
  const [isInitialized, setIsInitialized] = useState(false);
  const { toast } = useToast();

  const config = getOneSignalConfig();

  useEffect(() => {
    if (config.disabled) {
      console.log('OneSignal disabled in development environment');
      setIsInitialized(true);
      return;
    }

    const initializeOneSignal = async () => {
      try {
        // Wait for OneSignal to be available
        if (typeof window !== 'undefined' && window.OneSignalInstance) {
          const OneSignal = window.OneSignalInstance;
          
          // Get current subscription status
          const subscribed = OneSignal.User.PushSubscription.optedIn;
          const userId = OneSignal.User.PushSubscription.id;
          
          setOneSignalUser({
            subscribed: subscribed || false,
            userId: userId || null
          });
          
          setIsInitialized(true);
          
          // Listen for subscription changes
          window.addEventListener('oneSignalSubscriptionChanged', (event: any) => {
            setOneSignalUser(prev => ({
              ...prev,
              subscribed: event.detail.subscribed
            }));
          });
        }
      } catch (error) {
        console.error('Error initializing OneSignal:', error);
        setIsInitialized(true);
      }
    };

    // Check if OneSignal is already loaded
    if (window.OneSignalInstance) {
      initializeOneSignal();
    } else {
      // Wait for OneSignal to load
      const checkOneSignal = setInterval(() => {
        if (window.OneSignalInstance) {
          clearInterval(checkOneSignal);
          initializeOneSignal();
        }
      }, 100);

      // Cleanup after 10 seconds if OneSignal doesn't load
      setTimeout(() => {
        clearInterval(checkOneSignal);
        if (!isInitialized) {
          console.log('OneSignal failed to load, continuing without push notifications');
          setIsInitialized(true);
        }
      }, 10000);
    }
  }, [config.disabled, isInitialized]);

  const requestPermission = useCallback(async () => {
    if (config.disabled) {
      toast({
        title: 'Development Mode',
        description: 'Push notifications are disabled in development environment',
        duration: 3000
      });
      return false;
    }

    try {
      if (!window.OneSignalInstance) {
        throw new Error('OneSignal not initialized');
      }

      const OneSignal = window.OneSignalInstance;
      const permission = await OneSignal.Notifications.requestPermission();
      
      if (permission) {
        setOneSignalUser(prev => ({ ...prev, subscribed: true }));
        toast({
          title: 'Push notifications enabled!',
          description: 'You will now receive notifications even when SocialChat is closed',
          duration: 4000
        });
      }
      
      return permission;
    } catch (error) {
      console.error('Error requesting OneSignal permission:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to enable push notifications',
        duration: 3000
      });
      return false;
    }
  }, [config.disabled, toast]);

  const unsubscribe = useCallback(async () => {
    if (config.disabled) return true;

    try {
      if (!window.OneSignalInstance) {
        throw new Error('OneSignal not initialized');
      }

      const OneSignal = window.OneSignalInstance;
      await OneSignal.User.PushSubscription.optOut();
      
      setOneSignalUser(prev => ({ ...prev, subscribed: false }));
      
      toast({
        title: 'Push notifications disabled',
        description: 'You will no longer receive push notifications',
        duration: 3000
      });
      
      return true;
    } catch (error) {
      console.error('Error unsubscribing from OneSignal:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to disable push notifications',
        duration: 3000
      });
      return false;
    }
  }, [config.disabled, toast]);

  const sendNotificationToUser = useCallback(async (
    userId: string,
    title: string,
    message: string,
    data?: any
  ) => {
    if (config.disabled) {
      console.log('Would send notification in production:', { userId, title, message, data });
      return true;
    }

    try {
      // This would typically be done server-side
      console.log('Sending notification to user:', { userId, title, message, data });
      return true;
    } catch (error) {
      console.error('Error sending notification:', error);
      return false;
    }
  }, [config.disabled]);

  return {
    oneSignalUser,
    isInitialized,
    requestPermission,
    unsubscribe,
    sendNotificationToUser
  };
}

// Extend window interface for TypeScript
declare global {
  interface Window {
    OneSignalInstance?: any;
  }
}