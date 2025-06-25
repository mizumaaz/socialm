import React, { createContext, useContext, useEffect } from 'react';
import { useFirebaseNotifications } from '@/hooks/use-firebase-notifications';
import { useToast } from '@/hooks/use-toast';
import { useEnhancedNotifications } from '@/hooks/use-enhanced-notifications';

interface FirebaseNotificationContextType {
  isSupported: boolean;
  permission: NotificationPermission;
  token: string | null;
  isInitialized: boolean;
  requestPermission: () => Promise<boolean>;
}

const FirebaseNotificationContext = createContext<FirebaseNotificationContextType | null>(null);

export function useFirebaseNotificationContext() {
  const context = useContext(FirebaseNotificationContext);
  if (!context) {
    throw new Error('useFirebaseNotificationContext must be used within FirebaseNotificationProvider');
  }
  return context;
}

interface FirebaseNotificationProviderProps {
  children: React.ReactNode;
}

export function FirebaseNotificationProvider({ children }: FirebaseNotificationProviderProps) {
  const firebaseNotifications = useFirebaseNotifications();
  const { toast } = useToast();
  const { unreadCount } = useEnhancedNotifications();

  // Show notification permission prompt on first visit
  useEffect(() => {
    if (firebaseNotifications.isInitialized && 
        firebaseNotifications.isSupported && 
        firebaseNotifications.permission === 'default') {
      
      // Show a subtle prompt after 3 seconds
      const timer = setTimeout(() => {
        toast({
          title: '🔔 Enable Notifications',
          description: 'Get notified about new messages and updates from SocialChat!',
          duration: 10000,
          action: (
            <button
              onClick={firebaseNotifications.requestPermission}
              className="bg-social-green text-white px-3 py-1 rounded text-sm hover:bg-social-light-green transition-colors"
            >
              Enable
            </button>
          ),
        });
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [firebaseNotifications.isInitialized, firebaseNotifications.isSupported, firebaseNotifications.permission, firebaseNotifications.requestPermission, toast]);

  // Update document title with unread count
  useEffect(() => {
    if (unreadCount > 0) {
      document.title = `(${unreadCount}) SocialChat`;
    } else {
      document.title = "SocialChat";
    }
    
    return () => {
      document.title = "SocialChat";
    };
  }, [unreadCount]);

  return (
    <FirebaseNotificationContext.Provider value={firebaseNotifications}>
      {children}
    </FirebaseNotificationContext.Provider>
  );
}