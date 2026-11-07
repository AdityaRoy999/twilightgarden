import { supabase } from './supabase';
import { NativeCalls, hasNativeCalls, type NativeCallState } from './nativeCalls';
export type RoomState = NativeCallState & { local?: MediaStream; remote?: MediaStream };
export interface MediaRoom {
  native: boolean;
  attachVideo?(element: HTMLVideoElement): () => void;
  close(): Promise<void>;
  microphone(enabled: boolean): Promise<void>;
  camera(enabled: boolean): Promise<void>;
  screen(enabled: boolean, audio: boolean): Promise<void>;
  switchCamera(): Promise<void>;
}
export async function roomConfigured(coupleId: string) {
  const { data, error } = await supabase.functions.invoke('call-room', { body: { action: 'capabilities', coupleId } });
  // Old deployments continue using P2P. No silent E2EE downgrade after a room was offered.
  return !error && data?.configured === true;
}
export async function connectMediaRoom(coupleId: string, callId: string, key: string, video: boolean, update: (state: RoomState) => void): Promise<MediaRoom> {
  const { data, error } = await supabase.functions.invoke('call-room', { body: { coupleId, callId } });
  if (error || !data?.url || !data?.token) throw new Error('The native media server is unavailable. Check its configuration and retry.');
  if (hasNativeCalls()) {
    const sessionId = crypto.randomUUID();
    const listener = await NativeCalls.addListener('state', state => { if (state.sessionId === sessionId) update(state); });
    try {
      await NativeCalls.connect({ sessionId, url: data.url, token: data.token, key, video });
      return { native: true, close: async () => { await listener.remove(); await NativeCalls.disconnect({sessionId}); },
        microphone: enabled => NativeCalls.microphone({ enabled }), camera: enabled => NativeCalls.camera({ enabled }),
        screen: (enabled, audio) => NativeCalls.screen({ enabled, audio }), switchCamera: () => NativeCalls.switchCamera() };
    } catch (error) { await listener.remove(); await NativeCalls.disconnect({sessionId}).catch(() => {}); throw error; }
  }
  return connectWebMediaRoom(data, key, video, update);
}
/** Also used by the isolated loopback test against the real self-hosted SFU. */
export async function connectWebMediaRoom(data: {url: string; token: string}, key: string, video: boolean, update: (state: RoomState) => void): Promise<MediaRoom> {
  const { Room, RoomEvent, Track, ExternalE2EEKeyProvider, isE2EESupported } = await import('livekit-client');
  if (!isE2EESupported()) throw new Error('This browser cannot join an end-to-end encrypted media room. Use an updated browser or the native app.');
  const keyProvider = new ExternalE2EEKeyProvider();
  await keyProvider.setKey(key);
  const worker = new Worker(new URL('livekit-client/e2ee-worker', import.meta.url), { type: 'module' });
  const room = new Room({ adaptiveStream: true, dynacast: true, e2ee: { keyProvider, worker } });
  const sync = () => {
    const remoteTracks = [...room.remoteParticipants.values()].flatMap(p => [...p.trackPublications.values()]).filter(p => p.track && !p.isMuted);
    const screen = remoteTracks.find(p => p.source === Track.Source.ScreenShare)?.track?.mediaStreamTrack;
    const camera = remoteTracks.find(p => p.source === Track.Source.Camera)?.track?.mediaStreamTrack;
    const audio = remoteTracks.filter(p => p.track?.kind === Track.Kind.Audio).map(p => p.track!.mediaStreamTrack);
    const local = [...room.localParticipant.trackPublications.values()].filter(p => p.track && !p.isMuted);
    const localVideo = (local.find(p => p.source === Track.Source.ScreenShare) || local.find(p => p.source === Track.Source.Camera))?.track?.mediaStreamTrack;
    update({ remotePresent: room.remoteParticipants.size > 0, remote: new MediaStream([...(screen || camera ? [screen || camera!] : []), ...audio]),
      local: new MediaStream(localVideo ? [localVideo] : []), sharing: room.localParticipant.isScreenShareEnabled,
      remoteSharing: !!screen, remoteVideoOff: !screen && !camera });
  };
  for (const event of [RoomEvent.TrackSubscribed, RoomEvent.TrackUnsubscribed, RoomEvent.TrackMuted, RoomEvent.TrackUnmuted,
    RoomEvent.LocalTrackPublished, RoomEvent.LocalTrackUnpublished, RoomEvent.ParticipantConnected, RoomEvent.ParticipantDisconnected]) room.on(event, sync);
  room.on(RoomEvent.Disconnected, () => update({ ended: true }));
  room.on(RoomEvent.EncryptionError, () => update({ error: 'Media encryption failed. End the call and retry.' }));
  try {
    await room.setE2EEEnabled(true);
    await room.connect(data.url, data.token);
    await room.localParticipant.setMicrophoneEnabled(true);
    if (video) await room.localParticipant.setCameraEnabled(true);
    sync(); update({ connected: true });
  } catch (error) { await room.disconnect(); worker.terminate(); throw error; }
  return { native: false, close: async () => { room.removeAllListeners(); await room.disconnect(); worker.terminate(); },
    attachVideo: element => {
      const tracks = [...room.remoteParticipants.values()].flatMap(p => [...p.trackPublications.values()]);
      const video = (tracks.find(p => p.source === Track.Source.ScreenShare && p.track && !p.isMuted) || tracks.find(p => p.source === Track.Source.Camera && p.track && !p.isMuted))?.track;
      // Let adaptive stream observe the actual rendered element and its size.
      if (!video) return () => {};
      video.attach(element);
      element.muted = true;
      return () => { video.detach(element); };
    },
    microphone: async enabled => { await room.localParticipant.setMicrophoneEnabled(enabled); },
    camera: async enabled => { await room.localParticipant.setCameraEnabled(enabled); },
    screen: async (enabled, audio) => { await room.localParticipant.setScreenShareEnabled(enabled, { audio }); sync(); },
    switchCamera: async () => {
      const track = room.localParticipant.getTrackPublication(Track.Source.Camera)?.track;
      const current = track?.mediaStreamTrack.getSettings().facingMode;
      if (!track || !('restartTrack' in track)) throw new Error('Camera is unavailable.');
      await (track as import('livekit-client').LocalVideoTrack).restartTrack({ facingMode: current === 'environment' ? 'user' : 'environment' }); sync();
    } };
}
