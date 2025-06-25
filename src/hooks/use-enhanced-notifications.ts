import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useOneSignalNotifications } from '@/hooks/use-onesignal-notifications';
import { onSnapshot, collection, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/config/firebase';

interface NotificationData {
  id: string;
  type: string;
  content: string;
  reference_id?: string;
  read: boolean;
  created_at: string;
  user_id: string;
}

interface FirebaseNotification {
  id: string;
  type: string;
  content: string;
  reference_id?: string;
  read: boolean;
  created_at: any;
  user_id: string;
  source: 'firebase';
}

export function useEnhancedNotifications() {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isGranted, setIsGranted] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [hasShownSystemNotification, setHasShownSystemNotification] = useState(false);
  const channelsRef = useRef<any[]>([]);
  const { toast } = useToast();
  const { oneSignalUser, sendNotificationToUser } = useOneSignalNotifications();

  // Initialize user and permissions
  useEffect(() => {
    const initializeNotifications = async () => {
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setCurrentUser(user);
          
          // Check notification permission (both browser and OneSignal)
          if ('Notification' in window) {
            setIsGranted(Notification.permission === 'granted' || oneSignalUser.subscribed);
          }
          
          // Load initial notifications
          await fetchNotifications(user.id);

          // Show system notification about theme customization (only once per session)
          const hasShownKey = `system_notification_shown_${user.id}`;
          const hasShown = sessionStorage.getItem(hasShownKey);
          
          if (!hasShown && !hasShownSystemNotification) {
            setTimeout(() => {
              createSystemNotification(user.id);
              setHasShownSystemNotification(true);
              sessionStorage.setItem(hasShownKey, 'true');
            }, 3000); // Show after 3 seconds
          }
        }
      } catch (error) {
        console.error('Error initializing notifications:', error);
      }
    };

    initializeNotifications();

    // Listen for online/offline status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [oneSignalUser.subscribed, hasShownSystemNotification]);

  // Update permission status when OneSignal status changes
  useEffect(() => {
    if ('Notification' in window) {
      setIsGranted(Notification.permission === 'granted' || oneSignalUser.subscribed);
    }
  }, [oneSignalUser.subscribed]);

  // Create system notification about theme customization
  const createSystemNotification = useCallback(async (userId: string) => {
    try {
      const systemNotification = {
        user_id: userId,
        type: 'system',
        content: "💡 Don't like the pixel font? No problem! Visit your Profile section to change themes and customize fonts & colors to your preference.",
        read: false
      };

      const { data, error } = await supabase
        .from('notifications')
        .insert(systemNotification)
        .select()
        .single();

      if (error) throw error;

      // Add to local state
      setNotifications(prev => [data, ...prev]);
      setUnreadCount(prev => prev + 1);

      // Show toast notification with highlight
      toast({
        title: '🎨 Customize Your Experience',
        description: "Don't like the pixel font? Change themes in your Profile section!",
        duration: 8000,
        className: 'border-l-4 border-l-blue-500 bg-blue-50 text-blue-900 shadow-lg animate-pulse',
      });

    } catch (error) {
      console.error('Error creating system notification:', error);
    }
  }, [toast]);

  // Fetch notifications from both Supabase and Firebase
  const fetchNotifications = useCallback(async (userId: string) => {
    try {
      // Fetch Supabase notifications
      const { data: supabaseNotifications, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching Supabase notifications:', error);
      }

      // Combine notifications (Firebase notifications will be handled by real-time listener)
      const allNotifications = supabaseNotifications || [];
      
      setNotifications(allNotifications);
      setUnreadCount(allNotifications.filter(n => !n.read).length);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  }, []);

  // Create notification in database
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

      // Send OneSignal notification if user is subscribed
      if (oneSignalUser.subscribed) {
        await sendNotificationToUser(userId, getNotificationTitle(type), content, {
          type,
          reference_id: referenceId
        });
      }

      return data;
    } catch (error) {
      console.error('Error creating notification:', error);
      return null;
    }
  }, [oneSignalUser.subscribed, sendNotificationToUser]);

  // Send browser notification (fallback)
  const sendBrowserNotification = useCallback((title: string, options?: NotificationOptions) => {
    // If OneSignal is handling notifications, don't send browser notifications
    if (oneSignalUser.subscribed) return null;

    if (!isGranted || !('Notification' in window)) return null;

    try {
      const notification = new Notification(title, {
        ...options,
        icon: '/lovable-uploads/d215e62c-d97d-4600-a98e-68acbeba47d0.png',
        badge: '/lovable-uploads/d215e62c-d97d-4600-a98e-68acbeba47d0.png',
        requireInteraction: false,
        silent: false,
        tag: options?.tag || 'socialchat'
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      setTimeout(() => notification.close(), 5000);
      return notification;
    } catch (error) {
      console.error('Error showing notification:', error);
      return null;
    }
  }, [isGranted, oneSignalUser.subscribed]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) throw error;

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

  // Delete notification
  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  }, []);

  // Clear all notifications
  const clearAllNotifications = useCallback(async () => {
    if (!currentUser) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ deleted_at: new Date().toISOString() })
        .eq('user_id', currentUser.id)
        .is('deleted_at', null);

      if (error) throw error;

      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  }, [currentUser]);

  // Setup real-time subscriptions for both Supabase and Firebase
  useEffect(() => {
    if (!currentUser) return;

    const setupRealtimeSubscriptions = () => {
      // Cleanup existing channels
      channelsRef.current.forEach(channel => {
        supabase.removeChannel(channel);
      });
      channelsRef.current = [];

      // Supabase notifications subscription
      const notificationsChannel = supabase
        .channel(`notifications-${currentUser.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${currentUser.id}`
        }, async (payload) => {
          const newNotification = payload.new as NotificationData;
          
          // Add to state
          setNotifications(prev => [newNotification, ...prev]);
          setUnreadCount(prev => prev + 1);

          // Show browser notification only if OneSignal is not handling it
          if (!oneSignalUser.subscribed) {
            sendBrowserNotification(getNotificationTitle(newNotification.type), {
              body: newNotification.content,
              tag: newNotification.type,
              data: { id: newNotification.id, type: newNotification.type }
            });
          }

          // Show toast with special styling for system notifications
          const isSystemNotification = newNotification.type === 'system';
          toast({
            title: getNotificationTitle(newNotification.type),
            description: newNotification.content,
            duration: isSystemNotification ? 8000 : 4000,
            className: isSystemNotification ? 'border-l-4 border-l-blue-500 bg-blue-50 text-blue-900 shadow-lg' : undefined
          });
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${currentUser.id}`
        }, (payload) => {
          const updatedNotification = payload.new as NotificationData;
          setNotifications(prev =>
            prev.map(n => n.id === updatedNotification.id ? updatedNotification : n)
          );
        })
        .subscribe();

      // Firebase notifications subscription
      const firebaseNotificationsQuery = query(
        collection(db, 'notifications'),
        where('user_id', '==', currentUser.id),
        orderBy('created_at', 'desc')
      );

      const unsubscribeFirebase = onSnapshot(firebaseNotificationsQuery, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const firebaseNotification = {
              id: change.doc.id,
              ...change.doc.data(),
              created_at: change.doc.data().created_at?.toDate?.()?.toISOString() || new Date().toISOString(),
              source: 'firebase'
            } as NotificationData;

            // Add to state if not already present
            setNotifications(prev => {
              const exists = prev.some(n => n.id === firebaseNotification.id);
              if (!exists) {
                setUnreadCount(prevCount => prevCount + 1);
                
                // Show notification
                if (!oneSignalUser.subscribed) {
                  sendBrowserNotification(getNotificationTitle(firebaseNotification.type), {
                    body: firebaseNotification.content,
                    tag: firebaseNotification.type
                  });
                }

                toast({
                  title: getNotificationTitle(firebaseNotification.type),
                  description: firebaseNotification.content,
                  duration: 4000
                });

                return [firebaseNotification, ...prev];
              }
              return prev;
            });
          }
        });
      });

      // Store channels for cleanup
      channelsRef.current = [notificationsChannel];
      
      // Store Firebase unsubscribe function
      return () => {
        unsubscribeFirebase();
      };
    };

    const cleanup = setupRealtimeSubscriptions();

    // Reconnect on network recovery
    if (isOnline) {
      const reconnectTimer = setTimeout(setupRealtimeSubscriptions, 1000);
      return () => {
        cleanup?.();
        clearTimeout(reconnectTimer);
      };
    }

    return cleanup;
  }, [currentUser, isOnline, sendBrowserNotification, toast, oneSignalUser.subscribed]);

  // Request notification permission (browser fallback)
  const requestPermission = useCallback(async () => {
    try {
      const permission = await Notification.requestPermission();
      setIsGranted(permission === 'granted');
      
      if (permission === 'granted') {
        toast({
          title: 'Browser notifications enabled',
          description: 'You will now receive browser notifications',
          duration: 3000
        });

        // Send test notification
        sendBrowserNotification('Notifications Enabled!', {
          body: 'You will now receive browser notifications',
          tag: 'test'
        });
      }
      
      return permission === 'granted';
    } catch (error) {
      console.error('Error requesting permission:', error);
      return false;
    }
  }, [sendBrowserNotification, toast]);

  return {
    notifications,
    unreadCount,
    isGranted: isGranted || oneSignalUser.subscribed,
    isOnline,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    requestPermission,
    createNotification,
    fetchNotifications: () => currentUser && fetchNotifications(currentUser.id),
    oneSignalEnabled: oneSignalUser.subscribed
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
    case 'post':
      return 'New Post';
    default:
      return 'Notification';
  }
}