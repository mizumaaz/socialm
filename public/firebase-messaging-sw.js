// Firebase Cloud Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Initialize Firebase
firebase.initializeApp({
  apiKey: "AIzaSyCUoCrl4lm-eyYn6axfGBRPHmSVIv4AOlQ",
  authDomain: "socialchat-b6382.firebaseapp.com",
  databaseURL: "https://socialchat-b6382-default-rtdb.firebaseio.com",
  projectId: "socialchat-b6382",
  storageBucket: "socialchat-b6382.firebasestorage.app",
  messagingSenderId: "753198655677",
  appId: "1:753198655677:web:942fc9658bfc05e69eafd4",
  measurementId: "G-JQ817X706H"
});

// Retrieve Firebase Messaging object
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage(function(payload) {
  console.log('Received background message:', payload);

  const notificationTitle = payload.notification.title || 'SocialChat';
  const notificationOptions = {
    body: payload.notification.body || 'You have a new notification',
    icon: '/lovable-uploads/d215e62c-d97d-4600-a98e-68acbeba47d0.png',
    badge: '/lovable-uploads/d215e62c-d97d-4600-a98e-68acbeba47d0.png',
    tag: 'socialchat-notification',
    requireInteraction: true,
    data: payload.data,
    actions: [
      {
        action: 'open',
        title: 'Open SocialChat'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks
self.addEventListener('notificationclick', function(event) {
  console.log('Notification click received:', event);

  event.notification.close();

  if (event.action === 'open' || !event.action) {
    // Open the app
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Handle push events
self.addEventListener('push', function(event) {
  console.log('Push event received:', event);

  if (event.data) {
    const data = event.data.json();
    const title = data.title || 'SocialChat';
    const options = {
      body: data.body || 'You have a new notification',
      icon: '/lovable-uploads/d215e62c-d97d-4600-a98e-68acbeba47d0.png',
      badge: '/lovable-uploads/d215e62c-d97d-4600-a98e-68acbeba47d0.png',
      tag: 'socialchat-notification',
      requireInteraction: true,
      data: data.data || {},
      actions: [
        {
          action: 'open',
          title: 'Open SocialChat'
        },
        {
          action: 'dismiss',
          title: 'Dismiss'
        }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  }
});