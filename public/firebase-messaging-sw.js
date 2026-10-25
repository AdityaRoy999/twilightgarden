// Register before the SDK so notification clicks preserve HashRouter routes.
self.addEventListener('notificationclick', function(event) {
  event.stopImmediatePropagation();
  event.notification.close();
  const raw = event.notification.data?.url || event.notification.data?.FCM_MSG?.data?.url || '/dashboard';
  let path = typeof raw === 'string' ? raw : '/dashboard';
  try {
    const parsed = new URL(path, self.location.origin);
    if (parsed.origin !== self.location.origin) path = '/dashboard';
    else path = parsed.hash ? parsed.hash.slice(1) : parsed.pathname;
  } catch { path = '/dashboard'; }
  if (!path.startsWith('/') || path.startsWith('//')) path = '/dashboard';
  const target = self.location.origin + '/#' + path;
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(async list => {
    const existing = list.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) { await existing.navigate(target); return existing.focus(); }
    return clients.openWindow(target);
  }));
});

// Firebase Messaging Service Worker
// This file MUST be named firebase-messaging-sw.js and live at the root

importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBVC3lzmNdnQPGIbZx9Sg2HOa6B9SXN2fs",
  authDomain: "twilight-d25bb.firebaseapp.com",
  projectId: "twilight-d25bb",
  storageBucket: "twilight-d25bb.firebasestorage.app",
  messagingSenderId: "475915477527",
  appId: "1:475915477527:web:fcb08ef15505dd24c33252",
  measurementId: "G-L9L96K1KVC"
});

const messaging = firebase.messaging();

// Handle background messages (when app is not in focus)
messaging.onBackgroundMessage(function(payload) {
  // Notification payloads are displayed by FCM itself.
  if (payload.notification) return;

  const notificationTitle = payload.notification?.title || payload.data?.title || 'Twilight Garden';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'New notification',
    icon: payload.notification?.icon || '/twilight.png',
    badge: '/twilight.png',
    data: {
      url: payload.data?.url || '/'
    }
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});
