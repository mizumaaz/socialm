import React, { createContext, useContext, useEffect } from 'react';
import { useRealtimeNotifications } from '@/hooks/use-realtime-notifications';
import { useToast } from '@/hooks/use-toast';

interface RealtimeNotificationContextType {
  notifications: any[];
  unreadCount: number;
  isConnected: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  createNotification: (userId: string, type: string, content: string, referenceId?: string) => Promise<any>;
}

const RealtimeNotificationContext = createContext<RealtimeNotificationContextType | null>(null);

export function useRealtimeNotificationContext() {
  const context = useContext(RealtimeNotificationContext);
  if (!context) {
    throw new Error('useRealtimeNotificationContext must be used within RealtimeNotificationProvider');
  }
  return context;
}

interface RealtimeNotificationProviderProps {
  children: React.ReactNode;
}

export function RealtimeNotificationProvider({ children }: RealtimeNotificationProviderProps) {
  const realtimeNotifications = useRealtimeNotifications();
  const { toast } = useToast();

  // Show connection status
  useEffect(() => {
    if (realtimeNotifications.isConnected) {
      console.log('✅ Real-time notifications connected');
    } else {
      console.log('❌ Real-time notifications disconnected');
    }
  }, [realtimeNotifications.isConnected]);

  return (
    <RealtimeNotificationContext.Provider value={realtimeNotifications}>
      {children}
    </RealtimeNotificationContext.Provider>
  );
}