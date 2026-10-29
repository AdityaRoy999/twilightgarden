export const callFilters = {
  original: { label: 'Natural', filter: 'none' },
  soft: { label: 'Soft light', filter: 'brightness(1.06) contrast(.94) saturate(.94)' },
  glow: { label: 'Glow', filter: 'brightness(1.08) contrast(.97) saturate(1.08)' },
  warm: { label: 'Warm', filter: 'sepia(.18) saturate(1.12) brightness(1.03)' },
  cool: { label: 'Cool', filter: 'saturate(.85) hue-rotate(12deg) brightness(1.04)' },
  mono: { label: 'Mono', filter: 'grayscale(1) contrast(1.06)' },
} as const;
export type CallFilter = keyof typeof callFilters;
export type CameraEffect = { filter: CallFilter; blur: boolean };
export const naturalEffect: CameraEffect = { filter: 'original', blur: false };
export type ProcessedCamera = { track: MediaStreamTrack; resume: () => Promise<void>; dispose: () => void };

export function cameraEffectsSupported() {
  return typeof HTMLCanvasElement !== 'undefined' &&
    typeof HTMLCanvasElement.prototype.captureStream === 'function' &&
    typeof Worker !== 'undefined';
}
