import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useCouples } from './CouplesContext';

export type CallStatus = 'idle' | 'calling' | 'incoming' | 'connected' | 'ended';
interface CallContextType {
  callStatus: CallStatus; localStream: MediaStream | null; remoteStream: MediaStream | null;
  isIncomingCall: boolean; callerName: string; isVideoCall: boolean;
  initiateCall: (video: boolean) => Promise<void>; acceptCall: () => Promise<void>;
  rejectCall: () => void; endCall: () => void; toggleMute: () => void; toggleVideo: () => void;
  isMuted: boolean; isVideoOff: boolean;
}
interface Signal { callId: string; senderId: string; offer?: RTCSessionDescriptionInit; answer?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit; isVideo?: boolean; }
const CallContext = createContext<CallContextType | undefined>(undefined);
const ICE_SERVERS: RTCConfiguration = { iceServers: [
  { urls: ['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302'] },
  ...(import.meta.env.VITE_TURN_URL ? [{ urls: import.meta.env.VITE_TURN_URL, username: import.meta.env.VITE_TURN_USERNAME, credential: import.meta.env.VITE_TURN_CREDENTIAL }] : []),
] };

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { couple, partnerProfile } = useCouples();
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isVideoCall, setIsVideoCall] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const status = useRef<CallStatus>('idle');
  const streamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const ready = useRef(false);
  const generation = useRef(0);
  const callId = useRef<string | null>(null);
  const offerRef = useRef<RTCSessionDescriptionInit | null>(null);
  const videoRef = useRef(true);
  const candidates = useRef<RTCIceCandidateInit[]>([]);
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const partnerId = couple?.partner_1_id === user?.id ? couple?.partner_2_id : couple?.partner_1_id;

  const updateStatus = (next: CallStatus) => { status.current = next; setCallStatus(next); };
  const cleanup = useCallback(() => {
    generation.current++;
    clearTimeout(timeout.current);
    const pc = pcRef.current; pcRef.current = null;
    if (pc) { pc.ontrack = null; pc.onicecandidate = null; pc.onconnectionstatechange = null; pc.close(); }
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null; callId.current = null; offerRef.current = null; candidates.current = [];
    setLocalStream(null); setRemoteStream(null); setIsMuted(false); setIsVideoOff(false);
    status.current = 'idle'; setCallStatus('idle');
  }, []);

  const signal = async (event: string, data: Partial<Signal> = {}) => {
    if (!channelRef.current || !ready.current || !callId.current || !user) throw new Error('Call connection is unavailable. Please retry.');
    const result = await channelRef.current.send({ type: 'broadcast', event, payload: { ...data, callId: callId.current, senderId: user.id } });
    if (result !== 'ok') throw new Error('Could not send the call signal.');
  };
  const stopCall = () => { void signal('call:hangup').catch(() => {}); cleanup(); };
  const armTimeout = () => { clearTimeout(timeout.current); timeout.current = setTimeout(stopCall, 45000); };
  const flushCandidates = async (pc: RTCPeerConnection) => {
    const pending = candidates.current.splice(0);
    for (const candidate of pending) await pc.addIceCandidate(candidate);
  };
  const makePeer = () => {
    const pc = new RTCPeerConnection(ICE_SERVERS); pcRef.current = pc;
    pc.onicecandidate = event => { if (event.candidate) void signal('call:ice-candidate', { candidate: event.candidate.toJSON() }).catch(() => {}); };
    pc.ontrack = event => {
      if (pcRef.current === pc) setRemoteStream(event.streams[0] || new MediaStream([event.track]));
    };
    pc.onconnectionstatechange = () => { if (pcRef.current === pc && pc.connectionState === 'failed') stopCall(); };
    return pc;
  };

  useEffect(() => {
    if (!user?.id || !couple?.id || couple.status !== 'active' || !partnerId) return;
    const channel = supabase.channel(`call:${couple.id}`, { config: { private: true, broadcast: { self: false } } });
    channelRef.current = channel;
    const valid = (payload: Signal) => payload && payload.senderId === partnerId && typeof payload.callId === 'string' && payload.callId.length <= 64;
    channel.on('broadcast', { event: 'call:offer' }, ({ payload }: { payload: Signal }) => {
      if (!valid(payload) || status.current !== 'idle' || payload.offer?.type !== 'offer' || !payload.offer.sdp) return;
      callId.current = payload.callId; offerRef.current = payload.offer;
      videoRef.current = !!payload.isVideo; setIsVideoCall(!!payload.isVideo);
      updateStatus('incoming'); armTimeout();
    }).on('broadcast', { event: 'call:answer' }, async ({ payload }: { payload: Signal }) => {
      if (!valid(payload) || payload.callId !== callId.current || status.current !== 'calling' || payload.answer?.type !== 'answer' || !pcRef.current) return;
      try {
        const pc = pcRef.current;
        await pc.setRemoteDescription(payload.answer); await flushCandidates(pc);
        if (pcRef.current === pc) { clearTimeout(timeout.current); updateStatus('connected'); }
      } catch { stopCall(); }
    }).on('broadcast', { event: 'call:ice-candidate' }, async ({ payload }: { payload: Signal }) => {
      if (!valid(payload) || payload.callId !== callId.current || !payload.candidate) return;
      try {
        if (pcRef.current?.remoteDescription) await pcRef.current.addIceCandidate(payload.candidate);
        else if (candidates.current.length < 128) candidates.current.push(payload.candidate);
      } catch { /* A superseded ICE candidate may arrive after hangup. */ }
    }).on('broadcast', { event: 'call:hangup' }, ({ payload }: { payload: Signal }) => {
      if (valid(payload) && payload.callId === callId.current) cleanup();
    }).subscribe(state => { ready.current = state === 'SUBSCRIBED'; });
    return () => { ready.current = false; channelRef.current = null; void supabase.removeChannel(channel); cleanup(); };
  }, [user?.id, couple?.id, couple?.status, partnerId, cleanup]);

  const acquireMedia = async (video: boolean, revision: number) => {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera and microphone access requires a supported browser and HTTPS.');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: video ? { facingMode: 'user' } : false });
    // A user can hang up or sign out while the permission prompt is open.
    if (generation.current !== revision) { stream.getTracks().forEach(track => track.stop()); return null; }
    streamRef.current = stream; setLocalStream(stream); return stream;
  };
  const reportError = (error: unknown) => {
    stopCall();
    alert(error instanceof Error ? error.message : 'Could not connect the call. Please retry.');
  };
  const initiateCall = async (video: boolean) => {
    if (status.current !== 'idle') return;
    if (!ready.current) { alert('The call connection is still connecting. Please retry shortly.'); return; }
    callId.current = crypto.randomUUID(); videoRef.current = video; setIsVideoCall(video);
    updateStatus('calling'); armTimeout();
    const revision = generation.current;
    try {
      const stream = await acquireMedia(video, revision); if (!stream) return;
      const pc = makePeer(); stream.getTracks().forEach(track => pc.addTrack(track, stream));
      const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
      if (revision !== generation.current) return;
      await signal('call:offer', { offer, isVideo: video });
    } catch (error) { if (revision === generation.current) reportError(error); }
  };
  const acceptCall = async () => {
    if (status.current !== 'incoming' || !offerRef.current) return;
    const offer = offerRef.current; updateStatus('calling'); const revision = generation.current;
    try {
      const stream = await acquireMedia(videoRef.current, revision); if (!stream) return;
      const pc = makePeer(); await pc.setRemoteDescription(offer);
      stream.getTracks().forEach(track => pc.addTrack(track, stream)); await flushCandidates(pc);
      const answer = await pc.createAnswer(); await pc.setLocalDescription(answer);
      if (revision !== generation.current) return;
      await signal('call:answer', { answer }); clearTimeout(timeout.current); updateStatus('connected');
    } catch (error) { if (revision === generation.current) reportError(error); }
  };
  const toggleMute = () => { const tracks = streamRef.current?.getAudioTracks() || []; const muted = tracks[0]?.enabled ?? false; tracks.forEach(track => { track.enabled = !muted; }); setIsMuted(muted); };
  const toggleVideo = () => { const tracks = streamRef.current?.getVideoTracks() || []; const off = tracks[0]?.enabled ?? false; tracks.forEach(track => { track.enabled = !off; }); setIsVideoOff(off); };
  return <CallContext.Provider value={{ callStatus, localStream, remoteStream, isIncomingCall: callStatus === 'incoming', callerName: partnerProfile?.full_name || 'Partner', isVideoCall, initiateCall, acceptCall, rejectCall: stopCall, endCall: stopCall, toggleMute, toggleVideo, isMuted, isVideoOff }}>{children}</CallContext.Provider>;
};
export const useCall = () => { const context = useContext(CallContext); if (!context) throw new Error('useCall must be used within a CallProvider'); return context; };
