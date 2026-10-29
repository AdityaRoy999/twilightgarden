// Local-only, fictional media. Exercises the actual call controls and processing.
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { CallStudioView } from '../../components/CallStudio';
import { GifPicker } from '../../components/GifPicker';
import { LoveNoteSheet } from '../../components/LoveNoteSheet';
import { CallVideo } from '../../lib/callVideo';
import { naturalEffect, type CameraEffect } from '../../lib/callEffects';
import { appendCallReaction, type CallReaction } from '../../lib/callReactions';
import type { CallStatus } from '../../contexts/CallContext';
import '../../index.css';
import '../../styles/bloom.css';
import '../../styles/spring.css';
import '../../styles/dark.css';
import '../../styles/solar-polish.css';
import '../../styles/finish.css';
import '../../styles/calling.css';
if (!import.meta.env.DEV) throw new Error('Development-only fixture');
function Fixture() {
  const [status, setStatus] = useState<CallStatus>('idle'), [local, setLocal] = useState<MediaStream | null>(null), [remote, setRemote] = useState<MediaStream | null>(null);
  const [effect, setEffect] = useState<CameraEffect>(naturalEffect), [sharing, setSharing] = useState(false), [front, setFront] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [muted, setMuted] = useState(false), [off, setOff] = useState(false), [reactions, setReactions] = useState<CallReaction[]>([]);
  const [gif, setGif] = useState(false), [ai, setAi] = useState(false), [text, setText] = useState('');
  const [metrics, setMetrics] = useState('Collecting frame timings');
  const controller = useRef<CallVideo | null>(null), peers = useRef<RTCPeerConnection[]>([]), stopSource = useRef<() => void>(() => {});
  const end = () => { controller.current?.dispose(); peers.current.forEach(peer => peer.close()); stopSource.current(); setStatus('idle'); setLocal(null); setRemote(null); };
  useEffect(() => end, []);
  useEffect(() => {
    let frame = 0, last = 0; const gaps: number[] = [];
    const sample = (now: number) => { if (last) { gaps.push(now - last); if (gaps.length > 240) gaps.shift(); } last = now; frame = requestAnimationFrame(sample); };
    frame = requestAnimationFrame(sample);
    const timer = setInterval(() => {
      const sorted = [...gaps].sort((a, b) => a - b);
      const mean = gaps.reduce((sum, value) => sum + value, 0) / (gaps.length || 1);
      setMetrics(JSON.stringify({ samples: gaps.length, fps: Math.round(1000 / mean), p95FrameMs: Math.round(sorted[Math.floor(sorted.length * .95)] || 0) }));
    }, 2000);
    return () => { cancelAnimationFrame(frame); clearInterval(timer); };
  }, []);
  const start = async () => {
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 360;
    const ctx = canvas.getContext('2d')!; let frame = 0;
    const draw = () => { ctx.fillStyle = '#ead4e5'; ctx.fillRect(0, 0, 640, 360); ctx.fillStyle = '#a5597f'; ctx.beginPath(); ctx.arc(320, 145, 60, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(240, 210, 160, 150); ctx.fillStyle = '#fff'; ctx.font = '22px sans-serif'; ctx.fillText('Fictional call · local test', 30, 40); ctx.fillRect(30 + (performance.now() / 15) % 560, 310, 15, 15); frame = requestAnimationFrame(draw); };
    draw(); const stream = canvas.captureStream(24);
    stopSource.current = () => { cancelAnimationFrame(frame); stream.getTracks().forEach(track => track.stop()); };
    const a = new RTCPeerConnection(), b = new RTCPeerConnection(); peers.current = [a, b];
    const ac: RTCIceCandidate[] = [], bc: RTCIceCandidate[] = [];
    a.onicecandidate = event => { if (event.candidate) { if (b.remoteDescription) void b.addIceCandidate(event.candidate); else ac.push(event.candidate); } };
    b.onicecandidate = event => { if (event.candidate) { if (a.remoteDescription) void a.addIceCandidate(event.candidate); else bc.push(event.candidate); } };
    b.ontrack = event => setRemote(event.streams[0]);
    const sender = a.addTrack(stream.getVideoTracks()[0], stream);
    controller.current = new CallVideo(stream.getVideoTracks()[0], () => sender, (track, share, facing) => { setLocal(new MediaStream([track])); setSharing(share); setFront(facing); }, reason => setError(String(reason)));
    setLocal(stream); setStatus('connecting');
    await a.setLocalDescription(await a.createOffer()); await b.setRemoteDescription(a.localDescription!);
    for (const candidate of ac) await b.addIceCandidate(candidate);
    await b.setLocalDescription(await b.createAnswer()); await a.setRemoteDescription(b.localDescription!);
    for (const candidate of bc) await a.addIceCandidate(candidate);
    setStatus('connected');
  };
  const change = async (run: () => Promise<void>) => { setBusy(true); setError(''); try { await run(); } catch (reason) { setError(String(reason)); } finally { setBusy(false); } };
  return <><main style={{ padding: 30 }}><h1>Call studio verification</h1><p>Only synthetic media, with a real local WebRTC connection.</p>
    <button className="min-h-11 p-3" onClick={() => void start()}>Start synthetic video call</button><button className="min-h-11 p-3" onClick={() => setGif(true)}>Open GIF picker</button><button className="min-h-11 p-3" onClick={() => setAi(true)}>Open AI note</button><p>{text}</p><output data-testid="frame-metrics">{metrics}</output></main>
    <GifPicker open={gif} onClose={() => setGif(false)} onSend={url => { setText(url); setGif(false); }}/><LoveNoteSheet open={ai} onClose={() => setAi(false)} onGenerated={setText}/>
    <CallStudioView call={{ callStatus: status, localStream: local, remoteStream: remote, isIncomingCall: false, callerName: 'Alex · synthetic QA', isVideoCall: true,
      initiateCall: start, acceptCall: async () => {}, rejectCall: end, endCall: end, toggleMute: () => setMuted(!muted), toggleVideo: () => setOff(controller.current?.toggleCamera() || false),
      isMuted: muted, isVideoOff: off, callError: error || null, dismissCallError: () => setError(''), callLatencyMs: 12, callNetwork: null,
      switchCamera: () => change(async () => { await controller.current?.switchCamera(); setEffect(naturalEffect); }), toggleScreenShare: () => change(async () => { if (sharing) await controller.current?.stopScreen(); else await controller.current?.startScreen(); }),
      setCameraEffect: next => change(async () => { await controller.current?.setEffect(next); setEffect(next); }), cameraEffect: effect, isSharingScreen: sharing, remoteSharingScreen: sharing, isFrontCamera: front, mediaBusy: busy,
      reactions, sendReaction: async name => setReactions(previous => appendCallReaction(previous, { id: crypto.randomUUID(), at: Date.now(), name, mine: true })) }}/>
  </>;
}
const root = createRoot(document.getElementById('root')!);
root.render(<ThemeProvider><Fixture/></ThemeProvider>);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
