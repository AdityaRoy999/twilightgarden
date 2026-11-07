import { connectWebMediaRoom, type MediaRoom } from '../../lib/callRoom';
import { signCallRoomToken } from '../../supabase/functions/_shared/call-room-token';
if (!import.meta.env.DEV) throw new Error('Development-only local media fixture');
let room: MediaRoom | undefined;
let remote: MediaStream | undefined;
let detachVideo: (() => void) | undefined;
const attachVideo = () => { detachVideo?.(); detachVideo = room?.attachVideo?.(document.querySelector('video')!); };
let analyser: AnalyserNode | undefined;
(window as any).decodedAudio = async () => {
  if (!remote?.getAudioTracks().length) return 0;
  if (!analyser) { const context = new AudioContext(); await context.resume(); analyser = context.createAnalyser(); context.createMediaStreamSource(remote).connect(analyser); }
  const samples = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(samples);
  return samples.reduce((sum,value) => sum + value * value,0) / samples.length;
};
const query = new URLSearchParams(location.search), identity = query.get('identity') || 'alice';
document.getElementById('join')!.onclick = async () => {
  const status = document.getElementById('status')!;
  try {
    const cloud = (window as any).__twilightCloudMedia as {url:string;token:string;key:string} | undefined;
    if (query.has('cloud') && !cloud) throw new Error('Synthetic cloud credentials are missing.');
    const credentials = cloud || {url:'ws://127.0.0.1:7880', token:await signCallRoomToken('devkey','secret',identity,'twilight-local-test')};
    room = await connectWebMediaRoom(credentials,cloud?.key || query.get('key') || 'test-key-same-for-both-participants',true,value => {
      if (value.remote) { remote = value.remote; const video = document.querySelector('video')!; video.srcObject = value.remote; attachVideo(); void video.play(); }
      status.textContent = value.error || (value.remotePresent ? 'Partner connected' : value.connected ? 'Connected' : value.ended ? 'Ended' : status.textContent);
    });
    (window as any).testRoom = room;
    attachVideo();
  } catch (error) { status.textContent = String(error); }
};
document.getElementById('leave')!.onclick = () => { void room?.close(); document.getElementById('status')!.textContent = 'Ended'; };
