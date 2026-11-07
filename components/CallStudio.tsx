import { previewPosition, type DockSide } from '../lib/callDock';
import { sharedDisplayPoint } from '../lib/remoteControl';
import { NativeCalls } from '../lib/nativeCalls';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, animate, motion, useMotionValue } from 'framer-motion';
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
import { screenCaptureAvailability } from '../lib/callCapture';

type ExtendedVideo = HTMLVideoElement & {
  webkitSupportsPresentationMode?: (mode: string) => boolean;
  webkitSetPresentationMode?: (mode: string) => void;
  webkitEnterFullscreen?: () => void;
};
function CallButton({ icon, label, onClick, active, emphasis, danger, disabled }: {
  icon: string; label: string; onClick: () => void; active?: boolean; emphasis?: boolean; danger?: boolean; disabled?: boolean;
}) {
  return <button type="button" className={`call-button${active || emphasis ? ' is-active' : ''}${danger ? ' is-danger' : ''}`}
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
  const preview = useRef<HTMLDivElement>(null);
  const localVideo = useRef<HTMLVideoElement>(null), remoteVideo = useRef<ExtendedVideo>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const audioOutputs = useRef<HTMLAudioElement[]>([]);
  const [minimized, setMinimized] = useState(false), [controls, setControls] = useState(true);
  const [panel, setPanel] = useState<'effects' | 'reactions' | 'more' | null>(null);
  const [pipAvailable, setPipAvailable] = useState(false), [fullscreenAvailable, setFullscreenAvailable] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [notice, setNotice] = useState('');
  const [shareAudio, setShareAudio] = useState(false);
  const [docked, setDocked] = useState<DockSide>(null);
  const dockedRef = useRef<DockSide>(null); dockedRef.current = docked;
  const [nativeCapture, setNativeCapture] = useState(false);
  const [nativeAudio, setNativeAudio] = useState(false);
  const [stalled, setStalled] = useState(false);
  const ringtone = useCallRingtone(call.callStatus === 'incoming');
  const [seconds, setSeconds] = useState(0), [reactionClock, setReactionClock] = useState(Date.now());
  const connectedAt = useRef(0), hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const previewX = useMotionValue(0), previewY = useMotionValue(0);
  const savedPreview = useRef<{ x: number; y: number } | null>(null);
  const active = call.callStatus !== 'idle', connected = call.callStatus === 'connected';
  const capture = screenCaptureAvailability();
  useEffect(() => {
    let live = true;
    if (call.nativeMedia) void NativeCalls.capabilities().then(value => { if (live) { setNativeCapture(value.screen); setNativeAudio(value.audio); } }).catch(() => { if (live) { setNativeCapture(false); setNativeAudio(false); } });
    return () => { live = false; };
  }, [call.nativeMedia]);
  useEffect(() => {
    if (!active || !call.nativeMedia) return;
    document.documentElement.dataset.nativeCall = minimized ? 'mini' : 'full';
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!stage.current) return;
        const rect = stage.current.getBoundingClientRect(), tile = preview.current?.getBoundingClientRect();
        const shape = (r: DOMRect) => ({ x: r.x, y: r.y, width: r.width, height: r.height });
        for (const [key, value] of Object.entries({ x: rect.x, y: rect.y, w: rect.width, h: rect.height })) document.documentElement.style.setProperty(`--native-call-${key}`, `${value}px`);
        void NativeCalls.layout({ remote: { ...shape(rect), hidden: !call.isVideoCall || call.remoteVideoOff }, local: tile ? { ...shape(tile), hidden: minimized || !!docked || call.isVideoOff } : { x:0,y:0,width:0,height:0,hidden:true } }).catch(() => {});
      });
    };
    const resize = new ResizeObserver(update); if (stage.current) resize.observe(stage.current);
    const x = previewX.on('change', update), y = previewY.on('change', update);
    window.addEventListener('resize', update); update();
    return () => { cancelAnimationFrame(frame); resize.disconnect(); x(); y(); window.removeEventListener('resize', update); delete document.documentElement.dataset.nativeCall; };
  }, [active, minimized, docked, call.nativeMedia, call.isVideoCall, call.isVideoOff, call.remoteVideoOff, previewX, previewY]);
  useDialogFocus(stage, active && !minimized);
  useEffect(() => {
    if (!active) { setMinimized(false); setPanel(null); setNotice(''); connectedAt.current = 0; setSeconds(0); savedPreview.current = null; setDocked(null); }
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
    const detach = video && call.mediaTransport === 'sfu' ? call.attachRemoteVideo?.(video) : undefined;
    if (video) { video.srcObject = call.remoteStream; if (call.remoteStream) void video.play().catch(() => {}); }
    const tracks = call.remoteStream?.getAudioTracks?.() || [];
    // A screen share can publish microphone and device audio separately. Each
    // track gets its own output, avoiding browser-dependent track selection.
    const outputs = sound ? [sound, ...tracks.slice(1).map(() => { const element = document.createElement('audio'); element.autoplay = true; stage.current?.append(element); return element; })] : [];
    audioOutputs.current = outputs;
    outputs.forEach((element,index) => {
      element.srcObject = tracks[index] ? new MediaStream([tracks[index]]) : null;
      if (element.srcObject) void element.play().catch(() => setNotice('Tap the call to enable audio.'));
    });
    return () => { detach?.(); if (video) video.srcObject = null; outputs.forEach(element => { element.srcObject = null; if (element !== sound) element.remove(); }); audioOutputs.current = []; };
  }, [call.remoteStream, active, call.mediaTransport]);
  useEffect(() => {
    if (!active) return;
    const resume = () => {
      if (document.hidden) return;
      for (const media of [localVideo.current, remoteVideo.current, ...audioOutputs.current])
        if (media?.srcObject) void media.play().catch(() => {});
      setControls(true);
    };
    document.addEventListener('visibilitychange', resume); window.addEventListener('pageshow', resume);
    return () => { document.removeEventListener('visibilitychange', resume); window.removeEventListener('pageshow', resume); };
  }, [active]);
  useEffect(() => {
    setStalled(false);
    const video = remoteVideo.current;
    if (!connected || !call.isVideoCall || !call.remoteStream || !video) return;
    let lastFrames = -1, lastChange = performance.now();
    const tracks = call.remoteStream.getVideoTracks();
    const sample = () => {
      if (document.hidden) { lastChange = performance.now(); return; }
      const frames = video.getVideoPlaybackQuality?.().totalVideoFrames;
      if (frames !== undefined && frames !== lastFrames) { lastFrames = frames; lastChange = performance.now(); }
      setStalled(tracks.some(track => track.muted || track.readyState === 'ended') ||
        (frames !== undefined && performance.now() - lastChange > 6000));
    };
    tracks.forEach(track => { track.addEventListener('mute', sample); track.addEventListener('unmute', sample); });
    const timer = setInterval(sample, 2000);
    return () => { clearInterval(timer); tracks.forEach(track => { track.removeEventListener('mute', sample); track.removeEventListener('unmute', sample); }); };
  }, [connected, call.isVideoCall, call.remoteStream]);
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
    const tile = preview.current;
    if (!area || !tile || !active) return;
    const bound = () => {
      // A minimized call hides the preview. Preserve its position until its
      // real viewport returns rather than clamping against a zero-sized box.
      if (stage.current?.classList.contains('is-minimized') || !area.clientWidth || !area.clientHeight) return;
      if (dockedRef.current) { previewX.set(dockedRef.current === 'left' ? -tile.clientWidth - 8 : area.clientWidth + 8); return; }
      previewX.set(Math.min(Math.max(previewX.get(), 0), Math.max(0, area.clientWidth - tile.clientWidth)));
      previewY.set(Math.min(Math.max(previewY.get(), 0), Math.max(0, area.clientHeight - tile.clientHeight)));
    };
    previewX.set(Math.max(0, area.clientWidth - tile.clientWidth)); previewY.set(Math.min(80, Math.max(0, area.clientHeight - tile.clientHeight)));
    const observer = new ResizeObserver(bound); observer.observe(area); observer.observe(tile);
    return () => observer.disconnect();
  }, [active, call.isVideoCall, !!call.localStream, call.nativeMedia, previewX, previewY]);
  useLayoutEffect(() => {
    const area = previewArea.current, tile = preview.current, saved = savedPreview.current;
    if (minimized || !saved || !area || !tile) return;
    if (dockedRef.current) return;
    previewX.set(Math.max(0, Math.min(area.clientWidth - tile.clientWidth, saved.x)));
    previewY.set(Math.max(0, Math.min(area.clientHeight - tile.clientHeight, saved.y)));
  }, [minimized, previewX, previewY]);
  useEffect(() => {
    if (!active) return;
    const keyboard = (event: KeyboardEvent) => { if (event.key === 'Escape') { setPanel(null); setControls(true); } };
    document.addEventListener('keydown', keyboard);
    return () => document.removeEventListener('keydown', keyboard);
  }, [active]);
  const movePreview = (side?: DockSide) => {
    const area = previewArea.current, tile = preview.current;
    if (!area || !tile) return;
    const point = previewPosition(side === 'left' ? -tile.clientWidth : side === 'right' ? area.clientWidth : previewX.get(), previewY.get(), area.clientWidth, area.clientHeight, tile.clientWidth, tile.clientHeight, side !== null);
    setDocked(point.side);
    animate(previewX, point.x, motionTransition(springs.sheet, reduced));
    animate(previewY, point.y, motionTransition(springs.sheet, reduced));
  };
  const reveal = () => {
    setControls(true); audioOutputs.current.forEach(element => { void element.play().catch(() => {}); });
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
    if (!minimized) savedPreview.current = { x: previewX.get(), y: previewY.get() };
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
    setMinimized(value => !value); setPanel(null); setControls(true);
  };
  const togglePanel = (next: typeof panel) => { setControls(true); setPanel(panel === next ? null : next); };
  const showControls = controls || !connected || !!panel || minimized;
  const remotePaused = call.remoteVideoPaused || stalled;
  const remoteOff = call.remoteVideoOff && !call.remoteSharingScreen;
  const stateText = call.callStatus === 'incoming' ? `Incoming ${call.isVideoCall ? 'video' : 'voice'} call` :
    call.callStatus === 'calling' ? 'Calling…' : call.callStatus === 'connecting' ? 'Connecting…' :
      `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} · Encrypted`;
  return <MotionPortal><AnimatePresence>{active && <motion.div ref={stage}
    role={minimized ? 'region' : 'dialog'} aria-modal={minimized ? undefined : true} aria-label={`Call with ${call.callerName}`}
    className={`call-room${minimized ? ' is-minimized' : ''}${call.isVideoCall ? ' is-video' : ''}`} data-incoming={call.callStatus === 'incoming'} data-native={call.nativeMedia || undefined}
    initial={reduced ? false : { opacity: 0, scale: .985 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={motionTransition(springs.modal, reduced)}>
    <audio ref={audio} autoPlay playsInline/>
    <video ref={remoteVideo} autoPlay playsInline muted className="call-remote" style={{ objectFit: call.remoteSharingScreen ? 'contain' : 'cover' }} hidden={!call.isVideoCall || !call.remoteStream}/>
    <button className="call-stage-hit" aria-label={call.remoteControl === 'controlling' ? 'Control your partner’s shared primary display' : 'Show call controls'} onClick={event => { reveal(); if (call.remoteControl === 'controlling' && remoteVideo.current) { const video = remoteVideo.current; const point = sharedDisplayPoint(event.clientX,event.clientY,video.getBoundingClientRect(),video.videoWidth,video.videoHeight); if (point) call.sendRemoteInput({kind:'click',...point}); } }} onPointerMove={event => {
      if (call.remoteControl !== 'controlling' || !remoteVideo.current || event.pointerType !== 'mouse') return;
      const video = remoteVideo.current, point = sharedDisplayPoint(event.clientX,event.clientY,video.getBoundingClientRect(),video.videoWidth,video.videoHeight);
      if (point) call.sendRemoteInput({kind:'move',...point});
    }} onWheel={event => { if (call.remoteControl === 'controlling') call.sendRemoteInput({kind:'scroll',delta:Math.sign(event.deltaY)}); }} onKeyDown={event => {
      if (call.remoteControl !== 'controlling') return;
      if (['Backspace','Enter','Tab','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) { event.preventDefault(); call.sendRemoteInput({kind:'key',key:event.key as 'Enter'}); }
      else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) { event.preventDefault(); call.sendRemoteInput({kind:'text',text:event.key}); }
    }}/>
    {((!call.remoteStream && !(call.nativeMedia && connected)) || !call.isVideoCall) && <div className="call-person"><div><AppIcon name="UserRound" size={64}/></div><h2>{call.callerName}</h2><p>{stateText}</p></div>}
    {call.isVideoCall && (call.remoteStream || call.nativeMedia) && (remotePaused || remoteOff) && <div className="call-person call-paused" role="status"><div><AppIcon name="VideoOff" size={40}/></div><h2>{remoteOff ? 'Camera is off' : call.remoteSharingScreen ? 'Screen sharing paused' : 'Video paused'}</h2><p>{remoteOff ? `${call.callerName} turned off their camera.` : 'Waiting for your partner’s video to resume.'}</p></div>}
    <div className="call-preview-area" ref={previewArea}>{(call.localStream || call.nativeMedia) && call.isVideoCall && <motion.div ref={preview} className="call-preview" drag={!minimized} dragConstraints={{ left: -(preview.current?.clientWidth || 144), right: previewArea.current?.clientWidth || innerWidth, top: 0, bottom: Math.max(0, (previewArea.current?.clientHeight || innerHeight) - (preview.current?.clientHeight || 180)) }} onDragEnd={() => movePreview()}
      dragMomentum={false} dragElastic={.04} style={{ x: previewX, y: previewY }} tabIndex={minimized || docked ? -1 : 0}
      aria-label="Your video. Drag to move or slide it to an edge to hide." aria-hidden={!!docked} onKeyDown={event => {
        const direction = { ArrowLeft: [-20, 0], ArrowRight: [20, 0], ArrowUp: [0, -20], ArrowDown: [0, 20] }[event.key];
        if (!direction || !previewArea.current) return;
        event.preventDefault();
        previewX.set(Math.max(0, Math.min(previewArea.current.clientWidth - (preview.current?.clientWidth || 0), previewX.get() + direction[0])));
        previewY.set(Math.max(0, Math.min(previewArea.current.clientHeight - (preview.current?.clientHeight || 0), previewY.get() + direction[1])));
      }}>
      <button className="call-preview-hide" aria-label="Hide your preview" tabIndex={docked ? -1 : 0} onPointerDown={event => event.stopPropagation()} onClick={() => movePreview(previewX.get() < innerWidth / 2 ? 'left' : 'right')}><AppIcon name="ChevronRight" size={18}/></button>
      <video ref={localVideo} autoPlay playsInline muted style={{ transform: call.isFrontCamera && !call.isSharingScreen ? 'scaleX(-1)' : undefined, objectFit: call.isSharingScreen ? 'contain' : 'cover' }}/>
      {(call.capturePaused || call.isVideoOff && (!call.isSharingScreen || call.nativeMedia)) && <div className="call-camera-off"><AppIcon name="VideoOff" size={28}/></div>}<span>{call.capturePaused ? 'Video paused' : call.isSharingScreen && !call.nativeMedia ? 'Your screen' : 'You'}</span>
    </motion.div>}{docked && !minimized && <button className={`call-preview-restore on-${docked}`} style={{ top: previewY.get() }} aria-label="Restore your video preview" onClick={() => { const area = previewArea.current, tile = preview.current; if (area && tile) previewX.set(docked === 'left' ? 0 : Math.max(0, area.clientWidth - tile.clientWidth)); setDocked(null); }}><AppIcon name={docked === 'left' ? 'ChevronRight' : 'ChevronLeft'} size={22}/></button>}</div>
    <div className="call-reaction-flight" aria-live="polite" aria-atomic="false"><AnimatePresence>{call.reactions.filter(item => reactionClock - item.at < 3200).map(item => <motion.div key={item.id}
      className={`call-flying-reaction${item.mine ? ' is-mine' : ''}`} initial={reduced ? { opacity: 0 } : { opacity: 0, y: 40, scale: .6 }} animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: reduced ? 0 : -80 }} transition={motionTransition(springs.message, reduced)}><CallReactionSymbol name={item.name} size={64}/><span>{item.mine ? 'You' : call.callerName} · {item.name}</span></motion.div>)}</AnimatePresence></div>
    <div className={`call-overlay${showControls ? '' : ' is-hidden'}`} inert={!showControls || undefined}>
      <header className="call-heading"><div><strong>{call.callerName}</strong><p>{stateText}</p></div><div className="call-heading-actions">
        <CallButton icon={minimized ? 'Maximize' : 'Minimize'} label={minimized ? 'Expand call' : 'Minimize call'} onClick={() => void toggleMinimized()}/></div></header>
      <footer className="call-footer">
        {call.remoteControl === 'requested' && <div className="call-notice"><span>Your partner requests mouse and keyboard control of your shared primary display.</span><button onClick={() => void call.grantRemoteControl()}>Review</button><button onClick={call.stopRemoteControl}>Decline</button></div>}
        {(call.remoteControl === 'controlling' || call.remoteControl === 'sharing' || call.remoteControl === 'granting') && <div className="call-notice"><span>{call.remoteControl === 'granting' ? 'Waiting for control approval…' : call.remoteControl === 'sharing' ? 'Your partner can control this display. Permission expires in five minutes.' : 'Tap the shared display to click. Use your keyboard to type.'}</span><button onClick={call.stopRemoteControl}>Stop control</button></div>}
        {(call.callError || notice) && <div role="status" className="call-notice"><span>{call.callError || notice}</span><button onClick={() => { call.dismissCallError(); setNotice(''); }}>Dismiss</button></div>}
        {call.callStatus === 'incoming' && ringtone.blocked && <button className="call-ring-enable" onClick={reveal}>Tap to enable ringtone</button>}
        {call.isSharingScreen && <button className="call-sharing" disabled={call.mediaBusy} onClick={() => void call.toggleScreenShare()}><AppIcon name="ScreenShare"/>Sharing your screen · Stop</button>}
        <AnimatePresence>{panel && <motion.div className="call-options" key={panel} initial={{ opacity: 0, y: reduced ? 0 : 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={motionTransition(springs.sheet, reduced)}>
          <div className="call-options-heading"><strong>{panel === 'effects' ? 'Camera effects' : panel === 'reactions' ? 'Send a reaction' : 'Call options'}</strong><button aria-label="Close call options" onClick={() => setPanel(null)}><AppIcon name="X"/></button></div>
          {panel === 'reactions' ? <div className="call-reaction-choices">{callReactionNames.map(name => <button aria-label={`Send ${name} reaction`} key={name} onClick={() => void call.sendReaction(name)}><CallReactionSymbol name={name}/><span>{name}</span></button>)}</div>
          : panel === 'effects' ? <><div className="call-filter-choices">{Object.entries(callFilters).map(([key, value]) => <button key={key} aria-pressed={call.cameraEffect.filter === key} disabled={call.mediaBusy || call.isSharingScreen}
            onClick={() => void call.setCameraEffect({ ...call.cameraEffect, filter: key as CallFilter })}><span style={{ filter: value.filter }} className={`call-filter-swatch filter-${key}`}><AppIcon name="UserRound" size={26}/></span>{value.label}</button>)}</div>
            <button className="call-blur-toggle" aria-pressed={call.cameraEffect.blur} disabled={call.mediaBusy || call.isSharingScreen} onClick={() => void call.setCameraEffect({ ...call.cameraEffect, blur: !call.cameraEffect.blur })}><AppIcon name="Waves"/>{call.mediaBusy ? 'Preparing camera…' : call.cameraEffect.blur ? 'Background blur on' : 'Blur background'}</button><p>Processed on your device. Effects use up to 720p to keep your call smooth.</p></>
          : <><div className="call-more-grid">
            {call.isVideoCall && <CallButton icon="CameraSwitch" label="Switch camera" disabled={call.mediaBusy || call.isSharingScreen} onClick={() => void call.switchCamera()}/>}
            {call.isVideoCall && <CallButton icon="ScreenShare" label={call.isSharingScreen ? 'Stop sharing' : 'Share screen'} disabled={call.mediaBusy} onClick={() => (call.nativeMedia ? nativeCapture : capture.available) || call.isSharingScreen ? void call.toggleScreenShare(shareAudio) : setNotice(call.nativeMedia ? 'System-wide sharing requires iOS 27 or a configured native broadcast extension.' : capture.reason)}/>}
            {call.isVideoCall && call.mediaTransport === 'p2p' && cameraEffectsSupported() && <CallButton icon="Palette" label="Effects" onClick={() => setPanel('effects')}/>}
            {call.isVideoCall && pipAvailable && call.remoteStream && <CallButton icon="PictureInPicture" label="Picture-in-picture" onClick={() => void enterPip()}/>}
            {fullscreenAvailable && <CallButton icon={fullscreen ? 'Minimize' : 'Maximize'} label={fullscreen ? 'Exit browser fullscreen' : 'Browser fullscreen'} onClick={() => void enterFullscreen()}/>}
            {call.remoteSharingScreen && !call.nativeMedia && call.remoteControl === 'idle' && <CallButton icon="Monitor" label="Request remote control" onClick={() => void call.requestRemoteControl()}/>}
          </div><button className="call-blur-toggle" aria-pressed={shareAudio} disabled={call.isSharingScreen || call.nativeMedia && !nativeAudio} onClick={() => setShareAudio(value => !value)}><AppIcon name={shareAudio ? 'CheckCircle' : 'Mic'}/>{call.nativeMedia && !nativeAudio ? 'Device audio unavailable on this OS' : shareAudio ? 'Share device audio: on' : 'Share device audio: off'}</button><p>Choose audio before starting screen sharing. Some apps protect their audio. Microphone controls remain separate.</p>{call.callNetwork && <p className="call-connection-info">{call.isVideoCall ? qualityProfiles[call.callNetwork.quality].label : 'Adaptive speech'}{call.callNetwork.videoPaused ? ' · Video paused to protect audio' : ''}{call.callLatencyMs !== null ? ` · ${call.callLatencyMs} ms round-trip` : ''}</p>}</>}
        </motion.div>}</AnimatePresence>
        <div className="call-controls" style={{ '--call-control-count': call.callStatus === 'incoming' ? 2 : minimized ? 1 : 2 + Number(call.isVideoCall) + (connected ? 2 : 0) } as React.CSSProperties}>{call.callStatus === 'incoming' ? <><CallButton icon="PhoneOff" label="Decline" danger onClick={call.rejectCall}/><CallButton icon="Phone" label="Answer" emphasis onClick={() => void call.acceptCall()}/></> : <>
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
