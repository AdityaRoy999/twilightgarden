import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionValue } from 'framer-motion';
import { AppIcon } from './ui/Icons';
import { MotionPortal } from './ui/MotionPortal';
import { useCall } from '../contexts/CallContext';
import { useAppMotion } from '../hooks/useAppMotion';
import { useDialogFocus } from '../hooks/useDialogFocus';
import { springs, motionTransition } from '../lib/motion';
import { callFilters, cameraEffectsSupported, type CallFilter } from '../lib/callEffects';
import { callReactionNames } from '../lib/callReactions';
import { CallReactionSymbol } from './CallReactionSymbol';
import { qualityProfiles } from '../lib/callQuality';
import { useCallRingtone } from '../hooks/useCallRingtone';

type ExtendedVideo = HTMLVideoElement & {
  webkitSupportsPresentationMode?: (mode: string) => boolean;
  webkitSetPresentationMode?: (mode: string) => void;
  webkitEnterFullscreen?: () => void;
};
function CallButton({ icon, label, onClick, active, danger, disabled }: {
  icon: string; label: string; onClick: () => void; active?: boolean; danger?: boolean; disabled?: boolean;
}) {
  return <button type="button" className={`call-button${active ? ' is-active' : ''}${danger ? ' is-danger' : ''}`}
    aria-label={label} title={label} onClick={onClick} disabled={disabled} aria-pressed={active}>
    <AppIcon name={icon} size={24}/><span>{label}</span>
  </button>;
}

export function CallStudio() {
  const call = useCall();
  return <CallStudioView call={call}/>;
}
export function CallStudioView({ call }: { call: ReturnType<typeof useCall> }) {
  const { reduced } = useAppMotion();
  const stage = useRef<HTMLDivElement>(null), previewArea = useRef<HTMLDivElement>(null);
  const localVideo = useRef<HTMLVideoElement>(null), remoteVideo = useRef<ExtendedVideo>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const [minimized, setMinimized] = useState(false), [controls, setControls] = useState(true);
  const [panel, setPanel] = useState<'effects' | 'reactions' | 'more' | null>(null);
  const [pipAvailable, setPipAvailable] = useState(false), [fullscreenAvailable, setFullscreenAvailable] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [notice, setNotice] = useState('');
  const ringtone = useCallRingtone(call.callStatus === 'incoming');
  const [seconds, setSeconds] = useState(0), [reactionClock, setReactionClock] = useState(Date.now());
  const connectedAt = useRef(0), hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const previewX = useMotionValue(0), previewY = useMotionValue(0);
  const active = call.callStatus !== 'idle', connected = call.callStatus === 'connected';
  useDialogFocus(stage, active && !minimized);
  useEffect(() => {
    if (!active) { setMinimized(false); setPanel(null); setNotice(''); connectedAt.current = 0; setSeconds(0); }
    setControls(true);
  }, [active]);
  useEffect(() => {
    if (!connected) return;
    connectedAt.current ||= Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - connectedAt.current) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [connected]);
  useEffect(() => {
    const element = localVideo.current;
    if (!element) return;
    element.srcObject = call.localStream;
    if (call.localStream) void element.play().catch(() => {});
    return () => { element.srcObject = null; };
  }, [call.localStream, active]);
  useEffect(() => {
    const video = remoteVideo.current, sound = audio.current;
    if (video) { video.srcObject = call.remoteStream; if (call.remoteStream) void video.play().catch(() => {}); }
    if (sound) { sound.srcObject = call.remoteStream; if (call.remoteStream) void sound.play().catch(() => setNotice('Tap the call to enable audio.')); }
    return () => { if (video) video.srcObject = null; if (sound) sound.srcObject = null; };
  }, [call.remoteStream, active]);
  useEffect(() => {
    const video = remoteVideo.current;
    setPipAvailable(!!video && (document.pictureInPictureEnabled && typeof video.requestPictureInPicture === 'function' || !!video.webkitSupportsPresentationMode?.('picture-in-picture')));
    setFullscreenAvailable(!!document.fullscreenEnabled && !!stage.current?.requestFullscreen);
  }, [active, call.remoteStream]);
  useEffect(() => {
    const changed = () => setFullscreen(document.fullscreenElement === stage.current);
    document.addEventListener('fullscreenchange', changed);
    return () => document.removeEventListener('fullscreenchange', changed);
  }, []);
  useEffect(() => {
    clearTimeout(hideTimer.current);
    if (connected && call.isVideoCall && controls && !panel && !notice && !call.callError)
      hideTimer.current = setTimeout(() => setControls(false), 5000);
    return () => clearTimeout(hideTimer.current);
  }, [connected, call.isVideoCall, controls, panel, notice, call.callError]);
  useEffect(() => {
    if (!call.reactions.length) return;
    setReactionClock(Date.now());
    const timer = setInterval(() => setReactionClock(Date.now()), 500);
    const stop = setTimeout(() => clearInterval(timer), 4000);
    return () => { clearInterval(timer); clearTimeout(stop); };
  }, [call.reactions]);
  useEffect(() => {
    const area = previewArea.current;
    if (!area || !active) return;
    const bound = () => {
      previewX.set(Math.min(Math.max(previewX.get(), 0), Math.max(0, area.clientWidth - 120)));
      previewY.set(Math.min(Math.max(previewY.get(), 0), Math.max(0, area.clientHeight - 168)));
    };
    previewX.set(Math.max(0, area.clientWidth - 120)); previewY.set(0);
    const observer = new ResizeObserver(bound); observer.observe(area);
    return () => observer.disconnect();
  }, [active, call.isVideoCall, previewX, previewY]);
  useEffect(() => {
    if (!active) return;
    const keyboard = (event: KeyboardEvent) => { if (event.key === 'Escape') { setPanel(null); setControls(true); } };
    document.addEventListener('keydown', keyboard);
    return () => document.removeEventListener('keydown', keyboard);
  }, [active]);
  const reveal = () => {
    setControls(true); void audio.current?.play().catch(() => {});
    if (ringtone.blocked) void ringtone.enable();
  };
  const enterFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (stage.current?.requestFullscreen) await stage.current.requestFullscreen();
      else remoteVideo.current?.webkitEnterFullscreen?.();
    } catch { setNotice('Fullscreen is unavailable in this browser. The call already fills your app.'); }
  };
  const enterPip = async () => {
    try {
      const video = remoteVideo.current;
      if (!video || !call.remoteStream) return;
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else if (document.pictureInPictureEnabled && video.requestPictureInPicture) await video.requestPictureInPicture();
      else video.webkitSetPresentationMode?.('picture-in-picture');
      setMinimized(true); setPanel(null);
    } catch { setPipAvailable(false); setNotice('This device cannot open picture-in-picture for this call. You can still minimize inside the app.'); }
  };
  const toggleMinimized = async () => {
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
    setMinimized(value => !value); setPanel(null); setControls(true);
  };
  const togglePanel = (next: typeof panel) => { setControls(true); setPanel(panel === next ? null : next); };
  const showControls = controls || !connected || !!panel || minimized;
  const stateText = call.callStatus === 'incoming' ? `Incoming ${call.isVideoCall ? 'video' : 'voice'} call` :
    call.callStatus === 'calling' ? 'Calling…' : call.callStatus === 'connecting' ? 'Connecting…' :
      `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} · Encrypted`;
  return <MotionPortal><AnimatePresence>{active && <motion.div ref={stage}
    role={minimized ? 'region' : 'dialog'} aria-modal={minimized ? undefined : true} aria-label={`Call with ${call.callerName}`}
    className={`call-room${minimized ? ' is-minimized' : ''}${call.isVideoCall ? ' is-video' : ''}`}
    initial={reduced ? false : { opacity: 0, scale: .985 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={motionTransition(springs.modal, reduced)}>
    <audio ref={audio} autoPlay playsInline/>
    <video ref={remoteVideo} autoPlay playsInline muted className="call-remote" style={{ objectFit: call.remoteSharingScreen ? 'contain' : 'cover' }} hidden={!call.isVideoCall || !call.remoteStream}/>
    <button className="call-stage-hit" aria-label="Show call controls" onClick={reveal}/>
    {(!call.remoteStream || !call.isVideoCall) && <div className="call-person"><div><AppIcon name="UserRound" size={64}/></div><h2>{call.callerName}</h2><p>{stateText}</p></div>}
    <div className="call-preview-area" ref={previewArea}>{call.localStream && call.isVideoCall && <motion.div className="call-preview" drag={!minimized} dragConstraints={previewArea}
      dragMomentum={false} dragElastic={.04} style={{ x: previewX, y: previewY }} tabIndex={minimized ? -1 : 0}
      aria-label="Your video. Drag to move, or use the arrow keys." onKeyDown={event => {
        const direction = { ArrowLeft: [-20, 0], ArrowRight: [20, 0], ArrowUp: [0, -20], ArrowDown: [0, 20] }[event.key];
        if (!direction || !previewArea.current) return;
        event.preventDefault();
        previewX.set(Math.max(0, Math.min(previewArea.current.clientWidth - 120, previewX.get() + direction[0])));
        previewY.set(Math.max(0, Math.min(previewArea.current.clientHeight - 168, previewY.get() + direction[1])));
      }}>
      <video ref={localVideo} autoPlay playsInline muted style={{ transform: call.isFrontCamera && !call.isSharingScreen ? 'scaleX(-1)' : undefined, objectFit: call.isSharingScreen ? 'contain' : 'cover' }}/>
      {call.isVideoOff && !call.isSharingScreen && <div className="call-camera-off"><AppIcon name="VideoOff" size={28}/></div>}<span>{call.isSharingScreen ? 'Your screen' : 'You'}</span>
    </motion.div>}</div>
    <div className="call-reaction-flight" aria-live="polite" aria-atomic="false"><AnimatePresence>{call.reactions.filter(item => reactionClock - item.at < 3200).map(item => <motion.div key={item.id}
      className={`call-flying-reaction${item.mine ? ' is-mine' : ''}`} initial={reduced ? { opacity: 0 } : { opacity: 0, y: 40, scale: .6 }} animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: reduced ? 0 : -80 }} transition={motionTransition(springs.message, reduced)}><CallReactionSymbol name={item.name} size={64}/><span>{item.mine ? 'You' : call.callerName} · {item.name}</span></motion.div>)}</AnimatePresence></div>
    <div className={`call-overlay${showControls ? '' : ' is-hidden'}`} inert={!showControls || undefined}>
      <header className="call-heading"><div><strong>{call.callerName}</strong><p>{stateText}</p></div><div className="call-heading-actions">
        {fullscreenAvailable && <CallButton icon={fullscreen ? 'Minimize' : 'Maximize'} label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'} onClick={() => void enterFullscreen()}/>}
        {connected && <CallButton icon={minimized ? 'Maximize' : 'Minimize'} label={minimized ? 'Expand call' : 'Minimize call'} onClick={() => void toggleMinimized()}/>}</div></header>
      <footer className="call-footer">
        {(call.callError || notice) && <div role="status" className="call-notice"><span>{call.callError || notice}</span><button onClick={() => { call.dismissCallError(); setNotice(''); }}>Dismiss</button></div>}
        {ringtone.blocked && <button className="call-ring-enable" onClick={reveal}>Tap to enable ringtone</button>}
        {call.isSharingScreen && <button className="call-sharing" disabled={call.mediaBusy} onClick={() => void call.toggleScreenShare()}><AppIcon name="ScreenShare"/>Sharing your screen · Stop</button>}
        <AnimatePresence>{panel && <motion.div className="call-options" key={panel} initial={{ opacity: 0, y: reduced ? 0 : 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={motionTransition(springs.sheet, reduced)}>
          <div className="call-options-heading"><strong>{panel === 'effects' ? 'Camera effects' : panel === 'reactions' ? 'Send a reaction' : 'Call options'}</strong><button aria-label="Close call options" onClick={() => setPanel(null)}><AppIcon name="X"/></button></div>
          {panel === 'reactions' ? <div className="call-reaction-choices">{callReactionNames.map(name => <button aria-label={`Send ${name} reaction`} key={name} onClick={() => void call.sendReaction(name)}><CallReactionSymbol name={name}/><span>{name}</span></button>)}</div>
          : panel === 'effects' ? <><div className="call-filter-choices">{Object.entries(callFilters).map(([key, value]) => <button key={key} aria-pressed={call.cameraEffect.filter === key} disabled={call.mediaBusy || call.isSharingScreen}
            onClick={() => void call.setCameraEffect({ ...call.cameraEffect, filter: key as CallFilter })}><span style={{ filter: value.filter }} className={`call-filter-swatch filter-${key}`}><AppIcon name="UserRound" size={26}/></span>{value.label}</button>)}</div>
            <button className="call-blur-toggle" aria-pressed={call.cameraEffect.blur} disabled={call.mediaBusy || call.isSharingScreen} onClick={() => void call.setCameraEffect({ ...call.cameraEffect, blur: !call.cameraEffect.blur })}><AppIcon name="Waves"/>{call.mediaBusy ? 'Preparing camera…' : call.cameraEffect.blur ? 'Background blur on' : 'Blur background'}</button><p>Processed on your device. Effects use up to 720p to keep your call smooth.</p></>
          : <><div className="call-more-grid">
            {call.isVideoCall && <CallButton icon="CameraSwitch" label="Switch camera" disabled={call.mediaBusy || call.isSharingScreen} onClick={() => void call.switchCamera()}/>}
            {call.isVideoCall && typeof navigator.mediaDevices?.getDisplayMedia === 'function' && <CallButton icon="ScreenShare" label={call.isSharingScreen ? 'Stop sharing' : 'Share screen'} disabled={call.mediaBusy} onClick={() => void call.toggleScreenShare()}/>}
            {call.isVideoCall && cameraEffectsSupported() && <CallButton icon="Palette" label="Effects" onClick={() => setPanel('effects')}/>}
            {call.isVideoCall && pipAvailable && call.remoteStream && <CallButton icon="PictureInPicture" label="Picture-in-picture" onClick={() => void enterPip()}/>}
          </div>{call.callNetwork && <p className="call-connection-info">{call.isVideoCall ? qualityProfiles[call.callNetwork.quality].label : 'Adaptive speech'}{call.callNetwork.videoPaused ? ' · Video paused to protect audio' : ''}{call.callLatencyMs !== null ? ` · ${call.callLatencyMs} ms round-trip` : ''}</p>}</>}
        </motion.div>}</AnimatePresence>
        <div className="call-controls">{call.callStatus === 'incoming' ? <><CallButton icon="PhoneOff" label="Decline" danger onClick={call.rejectCall}/><CallButton icon="Phone" label="Answer" active onClick={() => void call.acceptCall()}/></> : <>
          <CallButton icon={call.isMuted ? 'MicOff' : 'Mic'} label={call.isMuted ? 'Unmute' : 'Mute'} active={call.isMuted} onClick={call.toggleMute}/>
          {call.isVideoCall && <CallButton icon={call.isVideoOff ? 'VideoOff' : 'Video'} label={call.isVideoOff ? 'Camera on' : 'Camera off'} active={call.isVideoOff} onClick={call.toggleVideo}/>}
          {connected && <CallButton icon="Smile" label="Reactions" active={panel === 'reactions'} onClick={() => togglePanel('reactions')}/>}
          {connected && <CallButton icon="Ellipsis" label="More" active={panel === 'more'} onClick={() => togglePanel('more')}/>}
          <CallButton icon="PhoneOff" label="End" danger onClick={call.endCall}/>
        </>}</div>
      </footer>
    </div>
  </motion.div>}</AnimatePresence>{!active && call.callError && <div className="call-idle-error" role="alert"><span>{call.callError}</span><button onClick={call.dismissCallError}>Close</button></div>}</MotionPortal>;
}
