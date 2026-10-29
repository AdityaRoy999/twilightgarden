import { naturalEffect, type CameraEffect, type ProcessedCamera } from './callEffects';

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
  constructor(camera: MediaStreamTrack,
    private sender: () => RTCRtpSender | undefined,
    private preview: (track: MediaStreamTrack, sharing: boolean, front: boolean) => void,
    private report: (error: unknown) => void) { this.camera = camera; }
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
    } catch (error) { next?.dispose(); throw error; }
  }); }
  switchCamera() { return this.queue(async () => {
    if (this.screen) throw new Error('Stop screen sharing before switching cameras.');
    // iOS commonly cannot open both physical cameras simultaneously. Stop the
    // current camera, then restore its facing mode if acquiring the other fails.
    const enabled = this.camera.enabled, wasFront = this.front;
    this.processed?.dispose(); this.processed = undefined; this.camera.stop();
    const acquire = (front: boolean) => navigator.mediaDevices.getUserMedia({ audio: false,
      video: { facingMode: { ideal: front ? 'user' : 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24, max: 30 } } });
    let stream: MediaStream;
    try { stream = await acquire(!wasFront); this.front = !wasFront; }
    catch (error) { stream = await acquire(wasFront); this.report(error); }
    if (this.stopped) { stream.getTracks().forEach(track => track.stop()); return; }
    this.camera = stream.getVideoTracks()[0]; this.camera.enabled = enabled;
    this.effect = naturalEffect;
    await this.replace(this.camera, false);
  }); }
  // Must call getDisplayMedia inside the initiating click, before any awaits.
  startScreen() {
    if (this.stopped || this.screen || !navigator.mediaDevices.getDisplayMedia) return Promise.reject(new Error('Screen sharing is unavailable on this device.'));
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
        track.onended = () => { void this.stopScreen().catch(this.report); };
      } catch (error) { stream.getTracks().forEach(track => track.stop()); throw error; }
    });
  }
  stopScreen() { return this.queue(async () => {
    if (!this.screen) return;
    await this.replace(this.processed?.track || this.camera, false);
    this.screen.onended = null; this.screen.stop(); this.screen = undefined;
  }); }
  toggleCamera() {
    const enabled = !this.camera.enabled;
    this.camera.enabled = enabled;
    if (this.processed) this.processed.track.enabled = enabled;
    return !enabled;
  }
  dispose() {
    this.stopped = true; this.revision++;
    this.effectsAbort.abort();
    if (this.screen) { this.screen.onended = null; this.screen.stop(); }
    this.processed?.dispose(); this.camera.stop();
  }
}
