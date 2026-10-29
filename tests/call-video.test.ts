// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CallVideo } from '../lib/callVideo';
import { appendCallReaction, isCallReaction } from '../lib/callReactions';
import { Capacitor } from '@capacitor/core';
import { processCamera } from '../lib/processCamera';
vi.mock('../lib/processCamera', () => ({ processCamera: vi.fn() }));
const track = () => Object.assign(new EventTarget(), { enabled: true, muted: false, readyState: 'live', kind: 'video', stop: vi.fn(), onended: null, contentHint: '' }) as unknown as MediaStreamTrack;
const stream = (video: MediaStreamTrack) => ({ getVideoTracks: () => [video], getTracks: () => [video] }) as MediaStream;
const deferred = <T>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; };
function fixture() {
  const camera = track(), replaceTrack = vi.fn().mockResolvedValue(undefined), preview = vi.fn(), report = vi.fn();
  const captureState = vi.fn();
  const controller = new CallVideo(camera, () => ({ replaceTrack }) as unknown as RTCRtpSender, preview, report, captureState);
  return { camera, controller, replaceTrack, preview, report, captureState };
}
afterEach(() => vi.restoreAllMocks());
describe('video source lifecycle', () => {
  it('rejects native WebView sharing even when a display-capture stub exists', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    const f = fixture(), capture = vi.fn();
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getDisplayMedia: capture } });
    await expect(f.controller.startScreen()).rejects.toThrow('native screen-capture integration');
    expect(capture).not.toHaveBeenCalled(); f.controller.dispose();
  });
  it('keeps desktop screen capture attached when its page is backgrounded', async () => {
    const f = fixture(), screen = track();
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getDisplayMedia: vi.fn().mockResolvedValue(stream(screen)) } });
    await f.controller.startScreen(); f.replaceTrack.mockClear();
    await f.controller.setBackgrounded(true); await f.controller.setBackgrounded(false);
    expect(f.replaceTrack).not.toHaveBeenCalled(); expect(screen.stop).not.toHaveBeenCalled();
    expect(f.captureState).not.toHaveBeenCalled(); f.controller.dispose();
  });
  it('reports capture mute and recovery once, and detaches observers on hangup', async () => {
    const f = fixture(), screen = track();
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getDisplayMedia: vi.fn().mockResolvedValue(stream(screen)) } });
    await f.controller.startScreen();
    Object.assign(screen, { muted: true }); screen.dispatchEvent(new Event('mute')); screen.dispatchEvent(new Event('mute'));
    expect(f.captureState).toHaveBeenCalledExactlyOnceWith(true);
    Object.assign(screen, { muted: false }); screen.dispatchEvent(new Event('unmute'));
    expect(f.captureState).toHaveBeenLastCalledWith(false);
    f.controller.dispose(); Object.assign(screen, { muted: true }); screen.dispatchEvent(new Event('mute'));
    expect(f.captureState).toHaveBeenCalledTimes(2);
  });
  it('resumes the protected effect instead of exposing the natural background', async () => {
    const f = fixture(), processed = track(), resume = vi.fn().mockResolvedValue(undefined), dispose = vi.fn();
    vi.mocked(processCamera).mockResolvedValueOnce({ track: processed, resume, dispose });
    await f.controller.setEffect({ filter: 'original', blur: true }); f.replaceTrack.mockClear();
    f.controller.toggleCamera();
    await f.controller.setBackgrounded(true); expect(f.captureState).toHaveBeenLastCalledWith(true);
    await f.controller.setBackgrounded(false); expect(resume).toHaveBeenCalledOnce();
    expect(f.captureState).toHaveBeenLastCalledWith(false); expect(f.replaceTrack).not.toHaveBeenCalled();
    expect(f.camera.enabled).toBe(false); expect(processed.enabled).toBe(false); f.controller.dispose();
  });
  it('reacquires an OS-ended camera on return while preserving camera-off privacy', async () => {
    const f = fixture(), restored = track(); f.controller.toggleCamera();
    Object.assign(f.camera, { readyState: 'ended' }); f.camera.dispatchEvent(new Event('ended'));
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue(stream(restored)) } });
    await f.controller.setBackgrounded(false);
    expect(restored.enabled).toBe(false); expect(f.replaceTrack).toHaveBeenLastCalledWith(restored);
    expect(f.captureState).toHaveBeenLastCalledWith(false); f.controller.dispose();
  });
  it('does not interrupt the current camera on a single-camera device', async () => {
    const f = fixture(), media = vi.fn();
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: media, enumerateDevices: vi.fn().mockResolvedValue([{ kind: 'videoinput', deviceId: 'only-camera' }]) } });
    await expect(f.controller.switchCamera()).rejects.toThrow('No second camera');
    expect(f.camera.stop).not.toHaveBeenCalled(); expect(media).not.toHaveBeenCalled(); f.controller.dispose();
  });
  it('stops screen permission granted after hangup and never replaces the sender', async () => {
    const grant = deferred<MediaStream>(), screen = track(), f = fixture();
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getDisplayMedia: vi.fn(() => grant.promise) } });
    const pending = f.controller.startScreen();
    const result = pending.catch(() => {});
    f.controller.dispose(); grant.resolve(stream(screen)); await result;
    expect(screen.stop).toHaveBeenCalled(); expect(f.replaceTrack).not.toHaveBeenCalled();
  });
  it('handles picker cancellation without stopping camera or replacing the sender', async () => {
    const f = fixture();
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getDisplayMedia: vi.fn().mockRejectedValue(new DOMException('Cancelled', 'NotAllowedError')) } });
    await expect(f.controller.startScreen()).rejects.toMatchObject({ name: 'NotAllowedError' });
    expect(f.camera.stop).not.toHaveBeenCalled(); expect(f.replaceTrack).not.toHaveBeenCalled(); f.controller.dispose();
  });
  it('restores the same camera sender when screen sharing ends', async () => {
    const f = fixture(), screen = track();
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getDisplayMedia: vi.fn().mockResolvedValue(stream(screen)) } });
    await f.controller.startScreen(); expect(f.replaceTrack).toHaveBeenLastCalledWith(screen);
    await f.controller.stopScreen(); expect(f.replaceTrack).toHaveBeenLastCalledWith(f.camera);
    expect(screen.stop).toHaveBeenCalledOnce(); expect(f.preview).toHaveBeenLastCalledWith(f.camera, false, true); f.controller.dispose();
  });
  it('stops a new camera granted after hangup', async () => {
    const f = fixture(), grant = deferred<MediaStream>(), camera = track();
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn(() => grant.promise) } });
    const pending = f.controller.switchCamera(); await Promise.resolve(); f.controller.dispose(); grant.resolve(stream(camera)); await pending;
    expect(camera.stop).toHaveBeenCalledOnce(); expect(f.replaceTrack).not.toHaveBeenCalled();
  });
  it('restores the previous camera if the alternate camera cannot open', async () => {
    const f = fixture(), restored = track();
    const media = vi.fn().mockRejectedValueOnce(new Error('Camera unavailable')).mockResolvedValueOnce(stream(restored));
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: media } });
    await f.controller.switchCamera(); expect(f.replaceTrack).toHaveBeenCalledWith(restored);
    expect(f.preview).toHaveBeenCalledWith(restored, false, true); expect(f.report).toHaveBeenCalledOnce(); f.controller.dispose();
  });
  it('keeps video privacy off across a camera switch', async () => {
    const f = fixture(), other = track(); f.controller.toggleCamera();
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue(stream(other)) } });
    await f.controller.switchCamera(); expect(other.enabled).toBe(false); f.controller.dispose();
  });
  it('stops a captured screen if replacing its sender fails', async () => {
    const f = fixture(), screen = track(); f.replaceTrack.mockRejectedValue(new Error('Sender closed'));
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getDisplayMedia: vi.fn().mockResolvedValue(stream(screen)) } });
    await expect(f.controller.startScreen()).rejects.toThrow('Sender closed'); expect(screen.stop).toHaveBeenCalledOnce(); f.controller.dispose();
  });
});
describe('ephemeral call reactions', () => {
  it('accepts only the original sticker vocabulary', () => { expect(isCallReaction('heart')).toBe(true); expect(isCallReaction('<script>')).toBe(false); });
  it('bounds reactions, removes duplicates and expires older arrivals', () => {
    const history = Array.from({ length: 20 }, (_, index) => ({ id: String(index), name: 'heart' as const, mine: false, at: index * 1000 }));
    const result = appendCallReaction(history, { id: '19', name: 'wave', mine: true, at: 20000 });
    expect(result.length).toBe(3); expect(new Set(result.map(item => item.id)).size).toBe(3); expect(result.at(-1)?.name).toBe('wave');
  });
});
