// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CallVideo } from '../lib/callVideo';
import { appendCallReaction, isCallReaction } from '../lib/callReactions';
const track = () => ({ enabled: true, kind: 'video', stop: vi.fn(), onended: null, contentHint: '' }) as unknown as MediaStreamTrack;
const stream = (video: MediaStreamTrack) => ({ getVideoTracks: () => [video], getTracks: () => [video] }) as MediaStream;
const deferred = <T>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; };
function fixture() {
  const camera = track(), replaceTrack = vi.fn().mockResolvedValue(undefined), preview = vi.fn(), report = vi.fn();
  const controller = new CallVideo(camera, () => ({ replaceTrack }) as unknown as RTCRtpSender, preview, report);
  return { camera, controller, replaceTrack, preview, report };
}
afterEach(() => vi.restoreAllMocks());
describe('video source lifecycle', () => {
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
