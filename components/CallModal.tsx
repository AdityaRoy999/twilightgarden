import {qualityProfiles} from '../lib/callQuality';
import { MotionPortal } from './ui/MotionPortal';
import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, User } from './ui/Icons';
import { useCall } from '../contexts/CallContext';

export const CallModal: React.FC = () => {
    const { 
        callStatus,callError,dismissCallError,callLatencyMs,callNetwork,
        localStream, 
        remoteStream, 
        callerName, 
        isVideoCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
        toggleVideo,
        isMuted,
        isVideoOff
    } = useCall();

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const bgVideoRef = useRef<HTMLVideoElement>(null);
    const remoteAudioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
            localVideoRef.current.play().catch(e => console.error('Local play error:', e));
        }
    }, [localStream]);

    useEffect(() => {
        if (remoteStream) {
            if (remoteAudioRef.current && !isVideoCall) {
                remoteAudioRef.current.srcObject = remoteStream;
                remoteAudioRef.current.play().catch(e => console.error('Remote audio play error:', e));
            }
            if (remoteVideoRef.current && isVideoCall) {
                remoteVideoRef.current.srcObject = remoteStream;
                remoteVideoRef.current.play().catch(e => console.error('Remote video play error:', e));
            }
            if (bgVideoRef.current && isVideoCall) {
                bgVideoRef.current.srcObject = remoteStream;
                bgVideoRef.current.play().catch(e => console.error('Bg video play error:', e));
            }
        }
    }, [remoteStream, isVideoCall]);

    if(callStatus==='idle')return callError?<div role="alert" className="fixed bottom-24 left-4 right-4 z-[1000] mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-amber-400/30 bg-surface-dark p-4 text-sm text-white shadow-xl"><span>{callError}</span><button aria-label="Dismiss call error" onClick={dismissCallError} className="min-h-11 px-3">Close</button></div>:null;

    return (
        <AnimatePresence>
            <MotionPortal><motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="fixed inset-0 z-[1000] flex flex-col items-center justify-center bg-background-dark text-white overflow-hidden"
            >
                {/* ALWAYS render remote audio element for ALL calls */}
                <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

                {/* Background (Blurry Video or Dark Gradient) */}
                <div className="absolute inset-0 z-0">
                    <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-background-dark opacity-90" />
                    {remoteStream && isVideoCall && (
                        <video 
                            ref={bgVideoRef} 
                            autoPlay 
                            playsInline 
                            muted
                            className="w-full h-full object-cover opacity-30 blur-xl"
                        />
                    )}
                </div>

                {/* Main Content */}
                <div className="relative z-10 w-full max-w-md h-full flex flex-col items-center p-8">
                    
                    {/* Remote Screen */}
                    <div className="relative flex-1 w-full rounded-3xl overflow-hidden bg-surface-dark border border-white/10 shadow-2xl">
                        <video 
                            ref={remoteVideoRef} 
                            autoPlay 
                            playsInline 
                            className={`w-full h-full object-cover ${(!remoteStream || !isVideoCall) ? 'hidden' : 'block'}`}
                        />
                        
                        {(!remoteStream || !isVideoCall) && (
                            <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center space-y-4 bg-surface-dark">
                                <div className="p-8 rounded-full bg-purple-500/20 text-purple-400">
                                    <User size={64} />
                                </div>
                                <h2 className="text-2xl font-semibold">{callerName || 'Partner'}</h2>
                                <p className="text-white/40">
                                    {callStatus === 'calling' ? 'Calling...' : 
                                     callStatus === 'incoming' ? 'Incoming Call' : callStatus==='connecting'?'Connecting media…':
                                     'Connected'}
                                </p>
                            </div>
                        )}

                        {/* Local PIP */}
                        {localStream && isVideoCall && (
                            <div className="absolute top-4 right-4 w-32 h-44 rounded-2xl overflow-hidden border border-white/20 shadow-xl bg-black">
                                <video 
                                    ref={localVideoRef} 
                                    autoPlay 
                                    playsInline 
                                    muted 
                                    className="w-full h-full object-cover scale-x-[-1]"
                                />
                                {isVideoOff && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                                        <VideoOff size={24} className="text-white/20" />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {callNetwork&&<p className="mt-2 text-xs text-white/70">{isVideoCall?(callNetwork.videoPaused?'Weak connection · video paused to protect audio':qualityProfiles[callNetwork.quality].label):'Adaptive speech'}{isVideoCall&&callNetwork.videoHeight?` · sending ${callNetwork.videoHeight}p`:""}{isVideoCall&&callNetwork.sentKbps!==undefined?` · ${callNetwork.sentKbps} kbps`:""}{callNetwork.receivedJitterMs!==undefined?` · ${callNetwork.receivedJitterMs} ms audio jitter`:""}</p>}
                    {callLatencyMs!==null&&<p className="mt-3 text-xs text-white/60" aria-live="polite">{callLatencyMs} ms round-trip{callLatencyMs>350?' · Network delay':''}</p>}
                    {/* Controls */}
                    <div className="w-full mt-8 flex flex-col items-center space-y-8">
                        
                        {callStatus === 'incoming' ? (
                            <div className="flex space-x-12">
                                <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    aria-label="Decline call" onClick={rejectCall}
                                    className="on-brand p-5 rounded-full bg-red-500 text-white shadow-lg shadow-red-500/30"
                                >
                                    <PhoneOff size={32} />
                                </motion.button>
                                <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    aria-label="Accept call" onClick={acceptCall}
                                    className="on-brand p-5 rounded-full bg-green-500 text-white shadow-lg shadow-green-500/30 animate-pulse"
                                >
                                    <Phone size={32} />
                                </motion.button>
                            </div>
                        ) : (
                            <div className="flex items-center space-x-6 bg-white/5 backdrop-blur-xl p-4 px-8 rounded-full border border-white/10">
                                <button 
                                    aria-label={isMuted?"Unmute microphone":"Mute microphone"} onClick={toggleMute}
                                    className={`p-3 rounded-full transition-colors ${isMuted ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white'}`}
                                >
                                    {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                                </button>
                                
                                {isVideoCall && (
                                    <button 
                                        aria-label={isVideoOff?"Enable camera":"Disable camera"} onClick={toggleVideo}
                                        className={`p-3 rounded-full transition-colors ${isVideoOff ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white'}`}
                                    >
                                        {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
                                    </button>
                                )}

                                <button 
                                    aria-label="End call" onClick={endCall}
                                    className="on-brand p-4 rounded-full bg-red-500 text-white shadow-lg shadow-red-500/40"
                                >
                                    <PhoneOff size={28} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </motion.div></MotionPortal>
        </AnimatePresence>
    );
};
