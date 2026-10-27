import {notificationPath} from './notificationRoutes';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from './supabase';

// Guard to prevent concurrent/repeated push registration attempts
let pushRegistrationInProgress = false;
let pushRegistrationDone = false;
let registeredUserId: string | null = null;
let registeredToken: string | null = null;
let registrationRevision = 0;
let foregroundUnsubscribe: (() => void) | undefined;
let listenersInitialized = false;
const listenerHandles: Promise<{ remove: () => Promise<void> }>[] = [];
const trackLocalListener: typeof LocalNotifications.addListener = ((...args: Parameters<typeof LocalNotifications.addListener>) => {
  const handle = LocalNotifications.addListener(...args); listenerHandles.push(handle); return handle;
}) as typeof LocalNotifications.addListener;
const trackPushListener: typeof PushNotifications.addListener = ((...args: Parameters<typeof PushNotifications.addListener>) => {
  const handle = PushNotifications.addListener(...args); listenerHandles.push(handle); return handle;
}) as typeof PushNotifications.addListener;

// Check if running in Capacitor (mobile)
const isCapacitor = () => {
  return Capacitor.isNativePlatform();
};

// Request notification permissions
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isCapacitor()) {
    // Fallback to web notifications
    if ('Notification' in window) {
      const result = await Notification.requestPermission();
      return result === 'granted';
    }
    return false;
  }

  try {
    const result = await LocalNotifications.requestPermissions();
    return result.display === 'granted';
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return false;
  }
}

// Check if notifications are enabled
export async function checkNotificationPermission(): Promise<boolean> {
  if (!isCapacitor()) {
    return 'Notification' in window && Notification.permission === 'granted';
  }

  try {
    const result = await LocalNotifications.checkPermissions();
    return result.display === 'granted';
  } catch (error) {
    console.error('Error checking notification permission:', error);
    return false;
  }
}

// Scheduled reminders are delivered by the authenticated server job. Retire old
// device schedules so one preference does not produce six daily alerts.
// Cancel all scheduled notifications
export async function cancelAllNotifications(): Promise<void> {
  if (!isCapacitor()) return;

  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.notifications });
    }
    console.log('All notifications cancelled');
  } catch (error) {
    console.error('Error cancelling notifications:', error);
  }
}

// Get pending notifications
export async function getPendingNotifications(): Promise<number> {
  if (!isCapacitor()) return 0;

  try {
    const pending = await LocalNotifications.getPending();
    return pending.notifications.length;
  } catch (error) {
    console.error('Error getting pending notifications:', error);
    return 0;
  }
}

// Initialize notification listeners (Local + Push)
export function initNotificationListeners(): void {
  if (listenersInitialized || !isCapacitor()) return;
  listenersInitialized = true;
  if (!isCapacitor()) return;

  // Local Notifications
  trackLocalListener('localNotificationReceived', (notification) => {
    console.log('Local Notification received:', notification);
  });

  trackLocalListener('localNotificationActionPerformed', (action) => {
    console.log('Local Notification action performed:', action);
    const path=notificationPath(action.notification.extra?.url,action.notification.id===1?'/log/details':'/dashboard');
    window.dispatchEvent(new CustomEvent('appNotificationClick',{detail:{url:path}}));
    window.location.hash='#'+path;
  });

  // Push Notifications
  trackPushListener('pushNotificationReceived', (notification) => {
    console.log('Push received:', notification);
    // Show local notification when app is in foreground
    LocalNotifications.schedule({
      notifications: [{
        title: notification.title || 'Twilight Garden',
        body: notification.body || '',
        id: Math.floor(Date.now() / 1000),
        schedule: { at: new Date(Date.now() + 100) },
        sound: 'default',
        extra: notification.data
      }]
    });
  });

  trackPushListener('pushNotificationActionPerformed', (notification) => {
    console.log('Push action performed:', notification);
    const data = notification.notification.data;

    // Use a custom event to notify App.tsx about the navigation target
    if (data?.url) {
      const navEvent = new CustomEvent('appNotificationClick', { detail: { url: notificationPath(data.url) } });
      window.dispatchEvent(navEvent);

      // Fallback: still set hash but the event is primary
      window.location.hash = '#' + notificationPath(data.url);
    }
  });
}

export async function resetPushRegistration(userId: string | null) {
  registrationRevision++;
  await cancelAllNotifications();
  foregroundUnsubscribe?.(); foregroundUnsubscribe = undefined;
  const handles = listenerHandles.splice(0);
  await Promise.allSettled(handles.map(async handle => (await handle).remove()));
  if (userId && registeredToken) {
    const { error } = await supabase.from('user_fcm_tokens').delete().eq('user_id', userId).eq('token', registeredToken);
    if (error) console.warn('Could not remove the previous push-token association');
  }
  if (isCapacitor()) {
    try { await PushNotifications.unregister(); } catch { /* Platform may not support unregister. */ }
  } else if (registeredToken) {
    try {
      const { messaging } = await import('./firebase');
      const { deleteToken } = await import('firebase/messaging');
      await deleteToken(messaging);
    } catch { /* Token expiry is also handled by the server. */ }
  }
  registeredUserId = null; registeredToken = null;
  pushRegistrationDone = false; pushRegistrationInProgress = false; listenersInitialized = false;
}

export async function registerPushNotifications(userId: string, requestPermission = false) {
  // This iOS sideload build has no APNs entitlement/provider. APNs device tokens
  // must never be stored as FCM tokens; foreground/local notifications still work.
  if (Capacitor.getPlatform() === 'ios') return;
  if (registeredUserId && registeredUserId !== userId) await resetPushRegistration(registeredUserId);
  if ((pushRegistrationDone || pushRegistrationInProgress) && registeredUserId === userId) return;
  registeredUserId = userId;
  const revision = registrationRevision;
  pushRegistrationInProgress = true;
  try {
    if (!isCapacitor()) {
      if (!('Notification' in window)) return;
      if (Notification.permission !== 'granted') {
        if (!requestPermission || await Notification.requestPermission() !== 'granted') return;
      }
      const { isSupported } = await import('firebase/messaging');
      if (!await isSupported()) return;
      await registerWebPush(userId, revision);
      pushRegistrationDone = registeredToken !== null && revision === registrationRevision;
      return;
    }
    let permissions = await PushNotifications.checkPermissions();
    if (permissions.receive === 'prompt' && requestPermission) permissions = await PushNotifications.requestPermissions();
    if (permissions.receive !== 'granted') return;
    initNotificationListeners();
    if (Capacitor.getPlatform() === 'android') {
      await PushNotifications.createChannel({ id: 'PushNotifications', name: 'Twilight Garden', importance: 5, visibility: 0, vibration: true });
    }
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Push registration timed out')), 15000);
      trackPushListener('registration', async token => {
        clearTimeout(timeout);
        if (revision !== registrationRevision || registeredUserId !== userId) { resolve(); return; }
        const { error } = await supabase.from('user_fcm_tokens').upsert({user_id:userId, token:token.value, device_type:Capacitor.getPlatform(), updated_at:new Date().toISOString()}, {onConflict:'user_id,token'});
        if (error) { reject(error); return; }
        registeredToken = token.value; pushRegistrationDone = true; resolve();
      });
      trackPushListener('registrationError', () => { clearTimeout(timeout); reject(new Error('Push registration failed')); });
      // Both listeners are attached before registration can emit a token.
      void Promise.all(listenerHandles).then(() => PushNotifications.register()).catch(err => { clearTimeout(timeout); reject(err); });
    });
  } finally {
    if (revision === registrationRevision) pushRegistrationInProgress = false;
  }
}

// Web Push via Firebase Cloud Messaging
async function registerWebPush(userId: string, revision: number) {
    if (!('serviceWorker' in navigator)) {
        console.log('[FCM-Web] Service workers not supported');
        return;
    }

    // 1. Ensure notification permission
    console.log('[FCM-Web] Step 1: Checking notification permission...');
    const permission = Notification.permission;
    if (permission !== 'granted') {
        console.log('[FCM-Web] Permission denied:', permission);
        return;
    }
    console.log('[FCM-Web] Permission granted');

    // 2. Register the Firebase messaging SW explicitly and get its registration
    console.log('[FCM-Web] Step 2: Registering Firebase messaging SW...');
    let swRegistration: ServiceWorkerRegistration;
    try {
        swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        console.log('[FCM-Web] SW registered, scope:', swRegistration.scope);

        // Wait for SW to become active (with 10s timeout)
        if (swRegistration.installing) {
            console.log('[FCM-Web] SW installing, waiting for activation...');
            await new Promise<void>((resolve) => {
                const timeout = setTimeout(() => {
                    console.warn('[FCM-Web] SW activation timed out after 10s');
                    resolve();
                }, 10000);
                swRegistration.installing!.addEventListener('statechange', function handler(e: any) {
                    if (e.target.state === 'activated') {
                        clearTimeout(timeout);
                        console.log('[FCM-Web] SW activated');
                        resolve();
                    }
                });
            });
        } else if (swRegistration.active) {
            console.log('[FCM-Web] SW already active');
        }
    } catch (swErr: any) {
        console.error('[FCM-Web] ❌ SW registration failed:', swErr.message);
        return;
    }

    // 3. Quick push service health check
    console.log('[FCM-Web] Step 3: Checking push service availability...');
    try {
        const permState = await swRegistration.pushManager.permissionState({ userVisibleOnly: true });
        console.log('[FCM-Web] Push permission state:', permState);
    } catch (permErr: any) {
        console.error('[FCM-Web] Push permission check failed:', permErr.message);
    }

    // 4. Get FCM token
    console.log('[FCM-Web] Step 4: Getting FCM token...');
    try {
        const { messaging, getToken, onMessage } = await import('./firebase');

        const token = await getToken(messaging, {
            vapidKey: 'BDFuOMVDuIBiI-aki2NHbFS7qXLYqlj7Fy1LFW7WQ7yIp5E8f7tMp_N46lQHNmAh8LpWslQ6O7ucMzoRr9ZMa5A',
            serviceWorkerRegistration: swRegistration,
        });

        if (!token) {
            console.error('[FCM-Web] Failed to get FCM token (null)');
            return;
        }
        console.log('[FCM-Web] ✅ FCM token obtained:', token.substring(0, 20) + '...');

        if (revision !== registrationRevision || registeredUserId !== userId) return;
        // 5. Save to user_fcm_tokens (same table as mobile)
        const { error } = await supabase.from('user_fcm_tokens').upsert({
            user_id: userId,
            token: token,
            device_type: 'web',
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,token' });

        if (error) {
            throw error;
        } else {
            registeredToken = token;
        }

        if (revision !== registrationRevision || registeredUserId !== userId) {
            await supabase.from('user_fcm_tokens').delete().eq('user_id', userId).eq('token', token);
            return;
        }
        // 6. Listen for foreground messages
        foregroundUnsubscribe?.();
        foregroundUnsubscribe = onMessage(messaging, async (payload) => {
            console.log('[FCM-Web] Foreground message:', payload);
            if (payload.notification) {
                const title = payload.notification.title || 'Twilight Garden';
                const body = payload.notification.body || 'New notification';

                // If running in Tauri Desktop app, send native OS notification
                if (!!(window as any).__TAURI_INTERNALS__ || !!(window as any).__TAURI__) {
                    try {
                        const { isPermissionGranted, sendNotification } = await import('@tauri-apps/plugin-notification');
                        let permissionGranted = await isPermissionGranted();
                        if (permissionGranted) {
                            sendNotification({ title, body });
                            return; // Early return to prevent fallback
                        }
                    } catch (e) {
                        console.warn('[FCM-Web] Tauri native notification skipped/failed, falling back to Web API:', e);
                    }
                }

                // Fallback for standard Web/PWA
                const foregroundNotification = new Notification(title, {
                    body,
                    icon: '/twilight.png',
                });
                foregroundNotification.onclick=()=>{window.focus();window.location.hash='#'+notificationPath(payload.data?.url);};
            }
        });

    } catch (err: any) {
        console.error('[FCM-Web] ❌ Failed to get FCM token:', err.message || err);
        console.error('[FCM-Web] Full error:', err);

        // Specific advice based on error
        if (err.message?.includes('push service')) {
            console.error('[FCM-Web] 🔧 DIAGNOSIS: Browser cannot contact FCM push servers.');
            console.error('[FCM-Web] Checklist:');
            console.error('[FCM-Web]   1. Are you signed into Chrome with a Google account?');
            console.error('[FCM-Web]   2. Check chrome://settings/content/notifications — is localhost blocked?');
            console.error('[FCM-Web]   3. Windows Settings → System → Notifications → is Chrome allowed?');
            console.error('[FCM-Web]   4. Can you reach https://fcm.googleapis.com ? (try in a new tab)');
            console.error('[FCM-Web]   5. Disable VPN / firewall temporarily');
            console.error('[FCM-Web]   6. Try in Microsoft Edge instead');
        }
    }
}
