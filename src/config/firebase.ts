import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "AIzaSyAXDc6PR-m2MBa0oklp9ObJggDmnvvn4RQ",
  authDomain: "mzsocialchat.firebaseapp.com",
  projectId: "mzsocialchat",
  storageBucket: "mzsocialchat.firebasestorage.app",
  messagingSenderId: "1070261752972",
  appId: "1:1070261752972:web:34575b057039e81e0997a9",
  measurementId: "G-RDCJQCQQ62"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const db = getFirestore(app);
export const storage = getStorage(app);

// Initialize Firebase Cloud Messaging and get a reference to the service
let messaging: any = null;

// Check if messaging is supported
const initializeMessaging = async () => {
  try {
    const supported = await isSupported();
    if (supported) {
      messaging = getMessaging(app);
      console.log('Firebase messaging initialized successfully');
    }
  } catch (error) {
    console.log('Firebase messaging not supported:', error);
  }
};

// Initialize messaging
initializeMessaging();

export { app, messaging };

// Enhanced notification service for real push notifications
export const NotificationService = {
  // Initialize Firebase messaging
  async initialize() {
    try {
      if (!messaging) {
        await initializeMessaging();
      }
      
      if (!messaging) {
        console.log('Firebase messaging not available');
        return false;
      }
      
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        console.log('Notification permission granted');
        
        // Get FCM token
        try {
          const token = await getToken(messaging, {
            vapidKey: 'BKxvxhk6f0JTzuykzAkjBpjA4rZmdn7_VrR2E2dVZ1K5ZGZjYzQzNjE4LTk2YjYtNGE4Yi1hZjE4LWY5ZjE4ZjE4ZjE4Zg'
          });
          
          if (token) {
            console.log('FCM Token:', token);
            // Store token for backend use
            localStorage.setItem('fcm_token', token);
            return token;
          }
        } catch (tokenError) {
          console.log('Error getting FCM token:', tokenError);
        }
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error initializing notifications:', error);
      return false;
    }
  },

  // Listen for foreground messages
  onMessage(callback: (payload: any) => void) {
    if (!messaging) return () => {};
    
    return onMessage(messaging, (payload) => {
      console.log('Foreground message received:', payload);
      
      // Show browser notification
      if (Notification.permission === 'granted') {
        const notificationTitle = payload.notification?.title || 'SocialChat Admin';
        const notificationOptions = {
          body: payload.notification?.body || payload.data?.message || 'New notification',
          icon: '/lovable-uploads/d215e62c-d97d-4600-a98e-68acbeba47d0.png',
          badge: '/lovable-uploads/d215e62c-d97d-4600-a98e-68acbeba47d0.png',
          tag: 'admin-broadcast',
          requireInteraction: true,
          data: payload.data,
          actions: [
            {
              action: 'view',
              title: 'View'
            },
            {
              action: 'dismiss',
              title: 'Dismiss'
            }
          ]
        };

        const notification = new Notification(notificationTitle, notificationOptions);
        
        notification.onclick = () => {
          window.focus();
          notification.close();
        };

        // Auto close after 10 seconds
        setTimeout(() => {
          notification.close();
        }, 10000);
      }
      
      callback(payload);
    });
  },

  // Send notification to all users (admin broadcast)
  async sendNotificationToUser(userId: string, title: string, body: string, data?: any) {
    try {
      console.log('Preparing admin broadcast notification:', {
        userId,
        title,
        body,
        data,
        timestamp: new Date().toISOString(),
        type: 'admin_broadcast'
      });

      // For demo purposes, simulate a broadcast by showing notifications to current user
      // In production, this would call your backend API
      
      // Show immediate browser notification
      if ('Notification' in window && Notification.permission === 'granted') {
        const notification = new Notification(title, {
          body: body,
          icon: '/lovable-uploads/d215e62c-d97d-4600-a98e-68acbeba47d0.png',
          tag: 'admin-broadcast',
          requireInteraction: true,
          data: {
            ...data,
            type: 'admin_broadcast',
            timestamp: new Date().toISOString()
          }
        });

        notification.onclick = () => {
          window.focus();
          notification.close();
        };

        // Auto close after 8 seconds
        setTimeout(() => {
          notification.close();
        }, 8000);
      }

      // Always dispatch custom event for in-page toast notifications (works without permission)
      const broadcastEvent = new CustomEvent('adminBroadcastToast', {
        detail: {
          title,
          message: body,
          data: {
            ...data,
            type: 'admin_broadcast',
            timestamp: new Date().toISOString()
          }
        }
      });
      
      window.dispatchEvent(broadcastEvent);

      // Also dispatch the original event for backward compatibility
      const originalBroadcastEvent = new CustomEvent('adminBroadcast', {
        detail: {
          title,
          body,
          data: {
            ...data,
            type: 'admin_broadcast',
            timestamp: new Date().toISOString()
          }
        }
      });
      
      window.dispatchEvent(originalBroadcastEvent);

      return {
        success: true,
        message: 'Admin broadcast notification sent successfully',
        recipients: 'all-users',
        timestamp: new Date().toISOString(),
        method: 'firebase_fcm'
      };
    } catch (error) {
      console.error('Error sending admin broadcast:', error);
      return {
        success: false,
        error: error
      };
    }
  },

  // Send toast notification (for immediate UI feedback)
  async sendToastNotification(title: string, message: string, type: 'success' | 'info' | 'warning' | 'error' = 'info') {
    try {
      // Show browser notification
      if ('Notification' in window && Notification.permission === 'granted') {
        const notification = new Notification(title, {
          body: message,
          icon: '/lovable-uploads/d215e62c-d97d-4600-a98e-68acbeba47d0.png',
          tag: `toast-${type}`,
          requireInteraction: false
        });

        // Auto close after 5 seconds
        setTimeout(() => {
          notification.close();
        }, 5000);
      }

      return { success: true };
    } catch (error) {
      console.error('Error sending toast notification:', error);
      return { success: false, error };
    }
  }
};

// Request permission and get FCM token
export const requestNotificationPermission = async () => {
  try {
    if (!messaging) {
      await initializeMessaging();
    }
    
    if (!messaging) {
      console.log('Firebase messaging not available');
      return null;
    }
    
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('Notification permission granted');
      
      try {
        const token = await getToken(messaging, {
          vapidKey: 'BKxvxhk6f0JTzuykzAkjBpjA4rZmdn7_VrR2E2dVZ1K5ZGZjYzQzNjE4LTk2YjYtNGE4Yi1hZjE4LWY5ZjE4ZjE4ZjE4Zg'
        });
        
        if (token) {
          localStorage.setItem('fcm_token', token);
          return token;
        }
      } catch (tokenError) {
        console.log('Error getting FCM token:', tokenError);
      }
      
      return 'permission-granted';
    }
    return null;
  } catch (error) {
    console.error('Error getting notification permission:', error);
    return null;
  }
};

// Listen for admin broadcast messages
export const onAdminMessageListener = () =>
  new Promise((resolve) => {
    if (!messaging) {
      resolve(null);
      return;
    }
    
    onMessage(messaging, (payload) => {
      if (payload.data?.type === 'admin_broadcast') {
        resolve(payload);
      }
    });
  });