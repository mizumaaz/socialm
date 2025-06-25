import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { NotificationService } from '@/config/firebase';

interface NotificationData {
  id: string;
  type: string;
  content: string;
  reference_id?: string;
  read: boolean;
  created_at: string;
  user_id: string;
}

export function useRealtimeNotifications() {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const { toast } = useToast();

  // Initialize Firebase notifications
  useEffect(() => {
    const initFirebase = async () => {
      try {
        await NotificationService.initialize();
        
        // Listen for foreground messages
        NotificationService.onMessage((payload) => {
          console.log('Firebase message received:', payload);
          
          // Show toast notification
          toast({
            title: payload.notification?.title || 'New Notification',
            description: payload.notification?.body || 'You have a new notification',
            duration: 5000,
          });
        });
      } catch (error) {
        console.error('Error initializing Firebase notifications:', error);
      }
    };

    initFirebase();
  }, [toast]);

  // Get current user
  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setCurrentUser(user);
          await fetchNotifications(user.id);
        }
      } catch (error) {
        console.error('Error getting current user:', error);
      }
    };

    getCurrentUser();
  }, []);

  // Fetch notifications from database
  const fetchNotifications = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching notifications:', error);
        return;
      }

      setNotifications(data || []);
      setUnreadCount(data?.filter(n => !n.read).length || 0);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  }, []);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!currentUser) return;

    let notificationsChannel: any;

    const setupRealtimeSubscription = () => {
      try {
        notificationsChannel = supabase
          .channel(`notifications-${currentUser.id}`)
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${currentUser.id}`
          }, async (payload) => {
            console.log('New notification received:', payload);
            const newNotification = payload.new as NotificationData;
            
            // Add to state
            setNotifications(prev => [newNotification, ...prev]);
            setUnreadCount(prev => prev + 1);

            // Show toast notification
            toast({
              title: getNotificationTitle(newNotification.type),
              description: newNotification.content,
              duration: 5000,
            });

            // Send Firebase notification
            try {
              await NotificationService.sendNotificationToUser(
                currentUser.id,
                getNotificationTitle(newNotification.type),
                newNotification.content,
                { type: newNotification.type, id: newNotification.id }
              );
            } catch (error) {
              console.error('Error sending Firebase notification:', error);
            }
          })
          .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${currentUser.id}`
          }, (payload) => {
            console.log('Notification updated:', payload);
            const updatedNotification = payload.new as NotificationData;
            setNotifications(prev =>
              prev.map(n => n.id === updatedNotification.id ? updatedNotification : n)
            );
            
            // Update unread count
            if (updatedNotification.read) {
              setUnreadCount(prev => Math.max(0, prev - 1));
            }
          })
          .subscribe((status) => {
            console.log('Notifications subscription status:', status);
            setIsConnected(status === 'SUBSCRIBED');
          });

      } catch (error) {
        console.error('Error setting up realtime subscription:', error);
        setIsConnected(false);
      }
    };

    setupRealtimeSubscription();

    // Cleanup function
    return () => {
      if (notificationsChannel) {
        supabase.removeChannel(notificationsChannel);
      }
    };
  }, [currentUser, toast]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) throw error;

      // Optimistic update
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    if (!currentUser) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', currentUser.id)
        .eq('read', false);

      if (error) throw error;

      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  }, [currentUser]);

  // Create notification
  const createNotification = useCallback(async (
    userId: string,
    type: string,
    content: string,
    referenceId?: string
  ) => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          type,
          content,
          reference_id: referenceId,
          read: false
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating notification:', error);
      return null;
    }
  }, []);

  return {
    notifications,
    unreadCount,
    isConnected,
    markAsRead,
    markAllAsRead,
    createNotification,
    fetchNotifications: () => currentUser && fetchNotifications(currentUser.id)
  };
}

// Helper function to get notification titles
function getNotificationTitle(type: string): string {
  switch (type) {
    case 'message':
      return 'New Message';
    case 'friend_request':
      return 'Friend Request';
    case 'friend_accepted':
      return 'Friend Request Accepted';
    case 'like':
      return 'New Like';
    case 'comment':
      return 'New Comment';
    case 'system':
      return '🎨 Customize Your Experience';
    default:
      return 'Notification';
  }
}