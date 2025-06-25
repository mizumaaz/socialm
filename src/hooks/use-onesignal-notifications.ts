import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getOneSignalConfig } from '@/config/onesignal';

interface OneSignalUser {
  subscribed: boolean;
  userId: string | null;
  permission: NotificationPermission;
}

export function useOneSignalNotifications() {
  const [oneSignalUser, setOneSignalUser] = useState<OneSignalUser>({
    subscribed: false,
    userId: null,
    permission: 'default'
  });
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const config = getOneSignalConfig();

  useEffect(() => {
    if (config.disabled) {
      console.log('OneSignal disabled in development environment');
      setIsLoading(false);
      
      // Set browser notification permission
      if ('Notification' in window) {
        setOneSignalUser(prev => ({
          ...prev,
          permission: Notification.permission
        }));
      }
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
            userId: userId || null,
            permission: Notification.permission
          });
          
          setIsLoading(false);
          
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
        setIsLoading(false);
        
        // Set browser notification permission as fallback
        if ('Notification' in window) {
          setOneSignalUser(prev => ({
            ...prev,
            permission: Notification.permission
          }));
        }
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

      // Fallback to browser notifications after 3 seconds if OneSignal doesn't load
      setTimeout(() => {
        clearInterval(checkOneSignal);
        if (isLoading) {
          console.log('OneSignal failed to load, using browser notifications');
          setIsLoading(false);
          
          // Set browser notification permission
          if ('Notification' in window) {
            setOneSignalUser(prev => ({
              ...prev,
              permission: Notification.permission
            }));
          }
        }
      }, 3000);
    }
  }, [config.disabled, isLoading]);

  const requestPermission = useCallback(async () => {
    if (config.disabled) {
      // Use browser notifications in development
      if ('Notification' in window) {
        try {
          const permission = await Notification.requestPermission();
          setOneSignalUser(prev => ({
            ...prev,
            permission,
            subscribed: permission === 'granted'
          }));
          
          if (permission === 'granted') {
            toast({
              title: 'Notifications enabled!',
              description: 'You will now receive browser notifications',
              duration: 3000
            });
            
            // Send test notification
            new Notification('Notifications Enabled!', {
              body: 'You will now receive browser notifications',
              icon: '/lovable-uploads/d215e62c-d97d-4600-a98e-68acbeba47d0.png'
            });
          }
          
          return permission === 'granted';
        } catch (error) {
          console.error('Error requesting browser notification permission:', error);
          return false;
        }
      }
      return false;
    }

    try {
      if (!window.OneSignalInstance) {
        // Fallback to browser notifications
        if ('Notification' in window) {
          const permission = await Notification.requestPermission();
          setOneSignalUser(prev => ({
            ...prev,
            permission,
            subscribed: permission === 'granted'
          }));
          return permission === 'granted';
        }
        throw new Error('OneSignal not initialized');
      }

      const OneSignal = window.OneSignalInstance;
      const permission = await OneSignal.Notifications.requestPermission();
      
      if (permission) {
        setOneSignalUser(prev => ({ 
          ...prev, 
          subscribed: true,
          permission: 'granted'
        }));
        toast({
          title: 'Push notifications enabled!',
          description: 'You will now receive notifications even when SocialChat is closed',
          duration: 4000
        });
      }
      
      return permission;
    } catch (error) {
      console.error('Error requesting OneSignal permission:', error);
      
      // Fallback to browser notifications
      if ('Notification' in window) {
        try {
          const permission = await Notification.requestPermission();
          setOneSignalUser(prev => ({
            ...prev,
            permission,
            subscribed: permission === 'granted'
          }));
          
          if (permission === 'granted') {
            toast({
              title: 'Notifications enabled!',
              description: 'You will now receive browser notifications',
              duration: 3000
            });
          }
          
          return permission === 'granted';
        } catch (fallbackError) {
          console.error('Error requesting browser notification permission:', fallbackError);
        }
      }
      
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
    if (config.disabled) {
      // Can't really unsubscribe from browser notifications
      toast({
        title: 'Development Mode',
        description: 'In production, this would disable push notifications',
        duration: 3000
      });
      return true;
    }

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
      
      // In development, show a browser notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
          body: message,
          icon: '/lovable-uploads/d215e62c-d97d-4600-a98e-68acbeba47d0.png',
          tag: 'development-notification'
        });
      }
      
      return true;
    }

    try {
      // This would typically be done server-side
      console.log('Sending notification to user:', { userId, title, message, data });
      
      // Dispatch a custom event for in-app notification
      const event = new CustomEvent('inAppNotification', {
        detail: { title, message, data }
      });
      window.dispatchEvent(event);
      
      return true;
    } catch (error) {
      console.error('Error sending notification:', error);
      return false;
    }
  }, [config.disabled]);

  return {
    oneSignalUser,
    isInitialized: !isLoading,
    isLoading,
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