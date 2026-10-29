import { cameraEffectsSupported, type CameraEffect, type ProcessedCamera } from './callEffects';
import { createCallFrameRenderer } from './callFrameRenderer';

/** Local-only processing. Segmentation stays in a worker; no camera frame leaves
 * this device except the resulting encrypted WebRTC video stream. */
export async function processCamera(track: MediaStreamTrack, effect: CameraEffect, signal?: AbortSignal): Promise<ProcessedCamera> {
  if (!cameraEffectsSupported()) throw new Error('Camera effects are unavailable on this device. Your natural camera stays on.');
  const video = document.createElement('video');
  video.muted = true; video.playsInline = true;
  video.srcObject = new MediaStream([track]);
  const canvas = document.createElement('canvas');
  const settings = track.getSettings();
  // Cap optional effects at 720p/24fps to reserve CPU and battery for the call.
  const aspect = (settings.width || 1280) / (settings.height || 720);
  canvas.width = Math.min(settings.width || 1280, 1280);
  canvas.height = Math.round(canvas.width / aspect);
  const renderer = createCallFrameRenderer(canvas, effect);
  const mask = document.createElement('canvas');
  const maskContext = mask.getContext('2d')!;
  let worker: Worker | undefined, frame = 0, stopped = false, busy = false;
  let lastFrame = -Infinity, lastMask = -Infinity, maskReady = false, maskDirty = false;
  let loadingTimer: ReturnType<typeof setTimeout> | undefined;
  let rejectLoading: ((reason: Error) => void) | undefined;
  const output = canvas.captureStream(24);
  const dispose = () => {
    if (stopped) return;
    stopped = true; cancelAnimationFrame(frame); worker?.terminate();
    clearTimeout(loadingTimer);
    signal?.removeEventListener('abort', abort);
    output.getTracks().forEach(value => value.stop());
    video.pause(); video.srcObject = null;
    renderer.dispose(); canvas.width = canvas.height = mask.width = mask.height = 0;
  };
  const abort = () => { rejectLoading?.(new Error('Call ended')); dispose(); };
  signal?.addEventListener('abort', abort, { once: true });
  try {
    if (signal?.aborted) throw new Error('Call ended');
    await video.play();
    if (stopped) throw new Error('Call ended');
    if (effect.blur) {
      worker = new Worker(new URL('./callSegmentation.worker.ts', import.meta.url), { type: 'module' });
      await new Promise<void>((resolve, reject) => {
        rejectLoading = reject;
        loadingTimer = setTimeout(() => reject(new Error('Background blur could not load. Try again on a faster connection.')), 20000);
        worker!.onerror = () => { clearTimeout(loadingTimer); reject(new Error('Background blur is unavailable on this device.')); };
        worker!.onmessage = ({ data }) => {
          if (data.type === 'ready') { clearTimeout(loadingTimer); resolve(); }
          if (data.type === 'error') { clearTimeout(loadingTimer); reject(new Error('Background blur could not start.')); }
        };
        worker!.postMessage({ type: 'init', base: new URL(import.meta.env.BASE_URL, location.href).href });
      });
      rejectLoading = undefined;
      worker.onmessage = ({ data }) => {
        busy = false;
        if (data.type === 'error') { maskReady = false; worker?.terminate(); worker = undefined; return; }
        if (stopped || data.type !== 'mask') return;
        mask.width = data.width; mask.height = data.height;
        maskContext.putImageData(new ImageData(new Uint8ClampedArray(data.pixels), data.width, data.height), 0, 0);
        maskReady = true; maskDirty = true;
      };
    }
    const draw = (now: number) => {
      if (stopped) return;
      frame = requestAnimationFrame(draw);
      const interval = 1000 / 24;
      if (now - lastFrame < interval || video.readyState < 2) return;
      // Carry the remainder across display frames. Resetting to `now` would
      // quantize a 24fps target to 20fps on a 60Hz display.
      lastFrame = Number.isFinite(lastFrame) ? now - ((now - lastFrame) % interval) : now;
      // Until the first mask is ready (or after inference fails), blur the whole
      // frame rather than briefly exposing the unprocessed background.
      renderer.draw(video, maskDirty ? mask : null, maskReady); maskDirty = false;
      if (worker && !busy && now - lastMask >= 100) {
        busy = true; lastMask = now;
        void createImageBitmap(video, { resizeWidth: 256, resizeHeight: Math.max(1, Math.round(256 / aspect)) })
          .then(bitmap => { if (stopped) bitmap.close(); else worker!.postMessage({ type: 'frame', bitmap, now }, [bitmap]); })
          .catch(() => { busy = false; });
      }
    };
    frame = requestAnimationFrame(draw);
    const processed = output.getVideoTracks()[0];
    processed.contentHint = 'motion'; processed.enabled = track.enabled;
    return { track: processed, dispose };
  } catch (error) { dispose(); throw error; }
}
