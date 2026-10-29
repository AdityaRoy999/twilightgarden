import { naturalEffect, type CameraEffect, type ProcessedCamera } from './callEffects';
import { screenCaptureAvailability } from './callCapture';
import { Capacitor } from '@capacitor/core';

/** Owns video sources independently of React renders. All async changes are
 * serialized and invalidated by hangup; microphone ownership stays with the call. */
export class CallVideo {
  private camera: MediaStreamTrack;
  private screen?: MediaStreamTrack;
  private processed?: ProcessedCamera;
  private stopped = false;
  private revision = 0;
  private pending: Promise<unknown> = Promise.resolve();
  private effectsAbort = new AbortController();
  private effect: CameraEffect = naturalEffect;
  private front = true;
  private backgrounded = false;
  private unwatch: () => void = () => {};
  private lastPaused = false;
  constructor(camera: MediaStreamTrack,
    private sender: () => RTCRtpSender | undefined,
    private preview: (track: MediaStreamTrack, sharing: boolean, front: boolean) => void,
    private report: (error: unknown) => void,
    private captureState: (paused: boolean) => void = () => {}) {
    this.camera = camera; this.watch(camera);
  }
  private publishState = () => {
    if (this.stopped) return;
    const source = this.screen || this.camera;
    const paused = !!source.muted || source.readyState === 'ended' ||
      (this.backgrounded && (!this.screen && (!!this.processed || Capacitor.getPlatform() === 'ios')));
    if (paused !== this.lastPaused) { this.lastPaused = paused; this.captureState(paused); }
  };
  private watch(track: MediaStreamTrack) {
    this.unwatch();
    track.addEventListener?.('mute', this.publishState);
    track.addEventListener?.('unmute', this.publishState);
    track.addEventListener?.('ended', this.publishState);
    this.unwatch = () => {
      track.removeEventListener?.('mute', this.publishState);
      track.removeEventListener?.('unmute', this.publishState);
      track.removeEventListener?.('ended', this.publishState);
    };
    this.publishState();
  }
  /** Do not stop display capture on visibility changes: desktop display tracks
   * keep running across apps. OS track mute/unmute is the source of truth. */
  setBackgrounded(backgrounded: boolean) {
    this.backgrounded = backgrounded;
    if (backgrounded) { this.publishState(); return Promise.resolve(); }
    return this.queue(async () => {
      if (this.screen) { this.publishState(); return; }
      if (this.camera.readyState === 'ended') {
        const enabled = this.camera.enabled;
        const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: {
          facingMode: { ideal: this.front ? 'user' : 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24, max: 30 },
        } });
        let next: ProcessedCamera | undefined;
        const camera = stream.getVideoTracks()[0];
        try {
          if (this.stopped || !camera) throw new Error('Call ended');
          camera.enabled = enabled;
          if (this.effect.filter !== 'original' || this.effect.blur) {
            const { processCamera } = await import('./processCamera');
            next = await processCamera(camera, this.effect, this.effectsAbort.signal);
          }
          await this.replace(next?.track || camera, false);
          this.processed?.dispose(); this.processed = next; this.camera = camera;
          this.watch(camera);
        } catch (error) { next?.dispose(); stream.getTracks().forEach(track => track.stop()); throw error; }
      }
      // Resume the existing processor, preserving blur and the user's video-off
      // choice. Never expose the raw camera as a background-effect fallback.
      await this.processed?.resume();
      this.publishState();
    });
  }
  private queue<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.pending.then(() => { if (this.stopped) throw new Error('Call ended'); return operation(); });
    this.pending = run.catch(() => {}); return run;
  }
  private async replace(track: MediaStreamTrack, sharing: boolean) {
    const sender = this.sender();
    if (!sender || this.stopped) throw new Error('Video connection is unavailable.');
    await sender.replaceTrack(track);
    if (this.stopped) throw new Error('Call ended');
    this.preview(track, sharing, this.front);
  }
  setEffect(effect: CameraEffect) { return this.queue(async () => {
    if (this.screen) throw new Error('Stop screen sharing before changing camera effects.');
    const revision = this.revision;
    let next: ProcessedCamera | undefined;
    try {
      if (effect.filter !== 'original' || effect.blur) {
        const { processCamera } = await import('./processCamera');
        next = await processCamera(this.camera, effect, this.effectsAbort.signal);
      }
      if (this.stopped || revision !== this.revision) throw new Error('Call ended');
      await this.replace(next?.track || this.camera, false);
      this.processed?.dispose(); this.processed = next; this.effect = effect;
      this.publishState();
    } catch (error) { next?.dispose(); throw error; }
  }); }
  switchCamera() { return this.queue(async () => {
    if (this.screen) throw new Error('Stop screen sharing before switching cameras.');
    const settings = this.camera.getSettings?.() || {};
    const devices = navigator.mediaDevices.enumerateDevices
      ? (await navigator.mediaDevices.enumerateDevices()).filter(device => device.kind === 'videoinput') : [];
    const alternate = devices.find(device => device.deviceId !== settings.deviceId);
    if (devices.length === 1 && (!settings.deviceId || devices[0].deviceId === settings.deviceId))
      throw new Error('No second camera was found. Your current camera stays on.');
    if (this.stopped) return;
    // iOS commonly cannot open both physical cameras simultaneously. Stop the
    // current camera, then restore its facing mode if acquiring the other fails.
    const enabled = this.camera.enabled, wasFront = this.front;
    this.processed?.dispose(); this.processed = undefined; this.camera.stop();
    const acquire = (front: boolean, deviceId?: string, exact = true) => navigator.mediaDevices.getUserMedia({ audio: false,
      video: { ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: exact ? { exact: front ? 'user' : 'environment' } : { ideal: front ? 'user' : 'environment' } }), width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24, max: 30 } } });
    let stream: MediaStream;
    try {
      try { stream = await acquire(!wasFront); }
      catch (error) { if (!alternate?.deviceId) throw error; stream = await acquire(!wasFront, alternate.deviceId); }
      this.front = !wasFront;
    } catch (error) { stream = await acquire(wasFront, settings.deviceId, false); this.report(error); }
    if (this.stopped) { stream.getTracks().forEach(track => track.stop()); return; }
    this.camera = stream.getVideoTracks()[0]; this.camera.enabled = enabled;
    const facing = this.camera.getSettings?.().facingMode;
    if (facing) this.front = facing === 'user';
    this.effect = naturalEffect;
    await this.replace(this.camera, false);
    this.watch(this.camera);
  }); }
  // Must call getDisplayMedia inside the initiating click, before any awaits.
  startScreen() {
    const availability = screenCaptureAvailability();
    if (!availability.available) return Promise.reject(new Error(availability.reason));
    if (this.stopped || this.screen) return Promise.reject(new Error('Screen sharing is already active or the call has ended.'));
    const revision = this.revision;
    const capture = navigator.mediaDevices.getDisplayMedia({ video: { width: { max: 1920 }, height: { max: 1080 }, frameRate: { max: 24 } }, audio: false })
      .then(stream => {
        if (this.stopped || revision !== this.revision) stream.getTracks().forEach(track => track.stop());
        return { stream, error: undefined };
      }, (error: unknown) => ({ stream: undefined, error }));
    return this.queue(async () => {
      const result = await capture;
      if (result.error) throw result.error;
      const stream = result.stream!;
      const track = stream.getVideoTracks()[0];
      try {
        if (!track || this.stopped || revision !== this.revision) throw new Error('Call ended');
        track.contentHint = 'detail';
        await this.replace(track, true);
        this.screen = track;
        this.watch(track);
        track.onended = () => { void this.stopScreen().catch(this.report); };
      } catch (error) { stream.getTracks().forEach(track => track.stop()); throw error; }
    });
  }
  stopScreen() { return this.queue(async () => {
    if (!this.screen) return;
    await this.replace(this.processed?.track || this.camera, false);
    this.screen.onended = null; this.screen.stop(); this.screen = undefined;
    this.watch(this.camera);
  }); }
  toggleCamera() {
    const enabled = !this.camera.enabled;
    this.camera.enabled = enabled;
    if (this.processed) this.processed.track.enabled = enabled;
    return !enabled;
  }
  dispose() {
    this.stopped = true; this.revision++;
    this.unwatch();
    this.effectsAbort.abort();
    if (this.screen) { this.screen.onended = null; this.screen.stop(); }
    this.processed?.dispose(); this.camera.stop();
  }
}
