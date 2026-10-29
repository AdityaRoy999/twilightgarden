import { Capacitor } from '@capacitor/core';

/** A WebView method is not a native ReplayKit broadcast integration. Keep this
 * check shared by the action and its UI so unsupported capture is never offered. */
export function screenCaptureAvailability(): { available: boolean; reason: string } {
  if (Capacitor.isNativePlatform()) return {
    available: false,
    reason: 'Screen sharing in the installed app needs a native screen-capture integration. You can share from a supported desktop browser and view it here.',
  };
  if (typeof navigator === 'undefined' || typeof navigator.mediaDevices?.getDisplayMedia !== 'function') return {
    available: false,
    reason: 'This browser cannot share your screen. Use a supported desktop browser; you can still view your partner’s shared screen here.',
  };
  return { available: true, reason: '' };
}
