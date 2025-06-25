import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useNotifications() {
  const [isGranted, setIsGranted] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Check if browser supports notifications
    if ('Notification' in window) {
      // Check if permission is already granted
      if (Notification.permission === 'granted') {
        setIsGranted(true);
      } else if (Notification.permission !== 'denied') {
        // Request permission
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            setIsGranted(true);
          }
        });
      }
    }

    // Check for service worker support
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      try {
        // Register service worker for push notifications
        navigator.serviceWorker.ready.then(registration => {
          console.log('Service Worker is ready for push notifications');
        });
      } catch (error) {
        console.error('Error setting up service worker:', error);
      }
    }
  }, []);

  // Send a notification with proper fallbacks
  const sendNotification = useCallback((title: string, options?: NotificationOptions) => {
    // First try to show a notification via the Notifications API
    if (isGranted && 'Notification' in window) {
      try {
        const notification = new Notification(title, {
          ...options,
          icon: options?.icon || '/lovable-uploads/d215e62c-d97d-4600-a98e-68acbeba47d0.png',
          badge: '/lovable-uploads/d215e62c-d97d-4600-a98e-68acbeba47d0.png',
          requireInteraction: false,
          silent: false
        });
        
        // Add click handler to notification
        notification.onclick = function() {
          window.focus();
          notification.close();
        };
        
        // Auto close after 5 seconds
        setTimeout(() => {
          notification.close();
        }, 5000);
        
        return notification;
      } catch (error) {
        console.error('Error showing notification:', error);
      }
    }
    
    // If native notification fails or isn't available, use toast as fallback
    toast({
      title,
      description: options?.body,
      className: 'toast-notification',
    });
    
    return null;
  }, [isGranted, toast]);

  // Create notification in database
  const createNotification = useCallback(async (userId: string, type: string, content: string, referenceId?: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          type,
          content,
          reference_id: referenceId || null,
          read: false
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error creating notification:', error);
    }
  }, []);

  // Setup message notifications subscription
  const setupMessageNotifications = useCallback((userId: string) => {
    return supabase
      .channel('messages-notifications')
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages',
          filter: `receiver_id=eq.${userId}`
        }, 
        async (payload) => {
          try {
            // Get sender details
            const { data: senderData } = await supabase
              .from('profiles')
              .select('name')
              .eq('id', payload.new.sender_id)
              .single();

            if (senderData) {
              // Create notification in database
              await createNotification(
                userId,
                'message',
                `${senderData.name} sent you a message`,
                payload.new.id
              );

              // Show push notification
              sendNotification(`New message from ${senderData.name}`, {
                body: payload.new.content.substring(0, 60) + (payload.new.content.length > 60 ? '...' : ''),
                tag: 'message',
                requireInteraction: true,
              });
            }
          } catch (error) {
            console.error('Error sending notification:', error);
          }
        }
      )
      .subscribe();
  }, [sendNotification, createNotification]);

  // Setup for friend request notifications
  const setupFriendRequestNotifications = useCallback((userId: string) => {
    return supabase
      .channel('friend-request-notifications')
      .on('postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'friends',
          filter: `receiver_id=eq.${userId}`
        },
        async (payload) => {
          try {
            // Get sender details
            const { data: senderData } = await supabase
              .from('profiles')
              .select('name')
              .eq('id', payload.new.sender_id)
              .single();

            if (senderData) {
              // Create notification in database
              await createNotification(
                userId,
                'friend_request',
                `${senderData.name} sent you a friend request`,
                payload.new.id
              );

              // Show push notification
              sendNotification(`New Friend Request`, {
                body: `${senderData.name} sent you a friend request`,
                tag: 'friend-request',
              });
            }
          } catch (error) {
            console.error('Error sending friend request notification:', error);
          }
        }
      )
      .subscribe();
  }, [sendNotification, createNotification]);

  // Setup for post notifications (likes and comments)
  const setupPostNotifications = useCallback((userId: string) => {
    // Listen for likes on user's posts
    const likesChannel = supabase
      .channel('likes-notifications')
      .on('postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'likes'
        },
        async (payload) => {
          try {
            // Get post details to check if it belongs to current user
            const { data: post } = await supabase
              .from('posts')
              .select('user_id, content')
              .eq('id', payload.new.post_id)
              .single();

            if (post && post.user_id === userId && payload.new.user_id !== userId) {
              const { data: likerProfile } = await supabase
                .from('profiles')
                .select('name')
                .eq('id', payload.new.user_id)
                .single();

              if (likerProfile) {
                // Create notification in database
                await createNotification(
                  userId,
                  'like',
                  `${likerProfile.name} liked your post`,
                  payload.new.post_id
                );

                // Show push notification
                sendNotification('New Like', {
                  body: `${likerProfile.name} liked your post`,
                  tag: 'like',
                });
              }
            }
          } catch (error) {
            console.error('Error sending like notification:', error);
          }
        }
      )
      .subscribe();

    // Listen for comments on user's posts
    const commentsChannel = supabase
      .channel('comments-notifications')
      .on('postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments'
        },
        async (payload) => {
          try {
            // Get post details to check if it belongs to current user
            const { data: post } = await supabase
              .from('posts')
              .select('user_id, content')
              .eq('id', payload.new.post_id)
              .single();

            if (post && post.user_id === userId && payload.new.user_id !== userId) {
              const { data: commenterProfile } = await supabase
                .from('profiles')
                .select('name')
                .eq('id', payload.new.user_id)
                .single();

              if (commenterProfile) {
                // Create notification in database
                await createNotification(
                  userId,
                  'comment',
                  `${commenterProfile.name} commented on your post`,
                  payload.new.post_id
                );

                // Show push notification
                sendNotification('New Comment', {
                  body: `${commenterProfile.name} commented on your post`,
                  tag: 'comment',
                });
              }
            }
          } catch (error) {
            console.error('Error sending comment notification:', error);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(likesChannel);
      supabase.removeChannel(commentsChannel);
    };
  }, [sendNotification, createNotification]);

  // Setup all notifications at once
  const setupAllNotifications = useCallback((userId: string) => {
    const messageChannel = setupMessageNotifications(userId);
    const friendRequestChannel = setupFriendRequestNotifications(userId);
    const postCleanup = setupPostNotifications(userId);
    
    // Return a cleanup function
    return () => {
      supabase.removeChannel(messageChannel);
      supabase.removeChannel(friendRequestChannel);
      postCleanup();
    };
  }, [setupMessageNotifications, setupFriendRequestNotifications, setupPostNotifications]);

  return { 
    isGranted, 
    sendNotification, 
    createNotification,
    setupMessageNotifications,
    setupFriendRequestNotifications,
    setupPostNotifications,
    setupAllNotifications
  };
}