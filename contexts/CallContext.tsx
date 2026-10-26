import { encryptMessage, decryptMessage } from "../lib/encryption";
import { loadCallIce, type CallIce } from "../lib/callIce";
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";
import { useCouples } from "./CouplesContext";

export type CallStatus =
  "idle" | "calling" | "incoming" | "connecting" | "connected" | "ended";
interface CallContextType {
  callStatus: CallStatus;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isIncomingCall: boolean;
  callerName: string;
  isVideoCall: boolean;
  initiateCall: (video: boolean) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  isMuted: boolean;
  isVideoOff: boolean;
  callError: string | null;
  dismissCallError: () => void;
  callLatencyMs: number | null;
}
interface Signal {
  callId: string;
  senderId: string;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  isVideo?: boolean;
}
const CallContext = createContext<CallContextType | undefined>(undefined);

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const {
    couple,
    partnerProfile,
    partnerPubKey,
    isSyncRequired,
    hasCloudBackup,
  } = useCouples();
  const [callError, setCallError] = useState<string | null>(null);
  const [callLatencyMs, setCallLatencyMs] = useState<number | null>(null);
  const localCandidates = useRef<RTCIceCandidateInit[]>([]);
  const descriptionSent = useRef(false);
  const statsTimer = useRef<ReturnType<typeof setInterval> | undefined>(
    undefined,
  );
  const initiated = useRef(false);
  const iceCache = useRef<{ key: string; value: CallIce } | null>(null);
  const icePending = useRef<{ key: string; promise: Promise<CallIce> } | null>(
    null,
  );
  const iceScope = useRef("");
  iceScope.current = (user?.id || "") + ":" + (couple?.id || "");
  const credentialTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const restarting = useRef(false);
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isVideoCall, setIsVideoCall] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const status = useRef<CallStatus>("idle");
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
  const partnerId =
    couple?.partner_1_id === user?.id
      ? couple?.partner_2_id
      : couple?.partner_1_id;

  const updateStatus = (next: CallStatus) => {
    status.current = next;
    setCallStatus(next);
  };
  const cleanup = useCallback(() => {
    generation.current++;
    restarting.current = false;
    clearTimeout(timeout.current);
    clearTimeout(credentialTimer.current);
    clearInterval(statsTimer.current);
    localCandidates.current = [];
    descriptionSent.current = false;
    setCallLatencyMs(null);
    const pc = pcRef.current;
    pcRef.current = null;
    if (pc) {
      pc.ontrack = null;
      pc.onicecandidate = null;
      pc.onconnectionstatechange = null;
      pc.close();
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    callId.current = null;
    offerRef.current = null;
    candidates.current = [];
    setLocalStream(null);
    setRemoteStream(null);
    setIsMuted(false);
    setIsVideoOff(false);
    status.current = "idle";
    setCallStatus("idle");
  }, []);

  const signal = async (event: string, data: Partial<Signal> = {}) => {
    if (!channelRef.current || !ready.current || !callId.current || !user)
      throw new Error("Call connection is unavailable. Please retry.");
    if (!partnerPubKey)
      throw new Error("Unlock your encrypted identity before calling.");
    const id = callId.current;
    const sealed = await encryptMessage(
      JSON.stringify({ ...data, callId: id, senderId: user.id }),
      partnerPubKey,
    );
    if (event !== "call:hangup" && id !== callId.current) return;
    const result = await channelRef.current.send({
      type: "broadcast",
      event,
      payload: { sealed },
    });
    if (result !== "ok") throw new Error("Could not send the call signal.");
  };
  const stopCall = () => {
    void signal("call:hangup").catch(() => {});
    cleanup();
  };
  const armTimeout = () => {
    clearTimeout(timeout.current);
    timeout.current = setTimeout(stopCall, 45000);
  };
  const flushCandidates = async (pc: RTCPeerConnection) => {
    const pending = candidates.current.splice(0);
    for (const candidate of pending) await pc.addIceCandidate(candidate);
  };
  const flushLocalCandidates = async () => {
    descriptionSent.current = true;
    for (const candidate of localCandidates.current.splice(0))
      await signal("call:ice-candidate", { candidate });
  };
  const connecting = () => {
    if (pcRef.current?.connectionState === "connected") {
      clearTimeout(timeout.current);
      updateStatus("connected");
      return;
    }
    updateStatus("connecting");
    clearTimeout(timeout.current);
    timeout.current = setTimeout(() => {
      setCallError(
        "Could not establish a media connection. Please retry on a stable network.",
      );
      stopCall();
    }, 20000);
  };
  const restartConnection = async () => {
    const pc = pcRef.current;
    if (
      !pc ||
      !initiated.current ||
      restarting.current ||
      pc.signalingState !== "stable"
    )
      return;
    restarting.current = true;
    connecting();
    descriptionSent.current = false;
    localCandidates.current = [];
    try {
      pc.restartIce();
      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offer);
      await signal("call:renegotiate", { offer });
      await flushLocalCandidates();
    } catch {
      stopCall();
    } finally {
      restarting.current = false;
    }
  };
  const recoverConnection = () => {
    if (!pcRef.current || !["connected", "connecting"].includes(status.current))
      return;
    if (initiated.current) void restartConnection();
    else {
      connecting();
      void signal("call:restart-request").catch(() => {});
    }
  };
  const getIce = async () => {
    if (!couple?.id) throw new Error("Connect to your partner first.");
    const key = (user?.id || "") + ":" + couple.id;
    if (
      iceCache.current?.key === key &&
      iceCache.current.value.expiresAt > Date.now() + 60000
    )
      return iceCache.current.value;
    if (icePending.current?.key === key) return icePending.current.promise;
    const promise = loadCallIce(couple.id).then((value) => {
      if (iceScope.current === key) iceCache.current = { key, value };
      return value;
    });
    icePending.current = { key, promise };
    try {
      return await promise;
    } finally {
      if (icePending.current?.promise === promise) icePending.current = null;
    }
  };
  const refreshCredentials = async (pc: RTCPeerConnection) => {
    if (pcRef.current !== pc) return;
    try {
      const ice = await getIce();
      if (pcRef.current !== pc) return;
      pc.setConfiguration({ iceServers: ice.iceServers });
      credentialTimer.current = setTimeout(
        () => {
          void refreshCredentials(pc);
        },
        Math.max(10000, ice.expiresAt - Date.now() - 60000),
      );
    } catch {
      if (pcRef.current === pc)
        credentialTimer.current = setTimeout(() => {
          void refreshCredentials(pc);
        }, 15000);
    }
  };
  const makePeer = async (revision: number) => {
    const ice = await getIce();
    if (generation.current !== revision) return null;
    const pc = new RTCPeerConnection({ iceServers: ice.iceServers });
    pcRef.current = pc;
    credentialTimer.current = setTimeout(
      () => {
        void refreshCredentials(pc);
      },
      Math.max(10000, ice.expiresAt - Date.now() - 60000),
    );
    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      const candidate = event.candidate.toJSON();
      if (descriptionSent.current)
        void signal("call:ice-candidate", { candidate }).catch(() => {});
      else localCandidates.current.push(candidate);
    };
    pc.ontrack = (event) => {
      if (pcRef.current === pc)
        setRemoteStream(
          (previous) =>
            event.streams[0] ||
            new MediaStream([
              ...(previous
                ?.getTracks()
                .filter((track) => track.id !== event.track.id) || []),
              event.track,
            ]),
        );
    };
    pc.onconnectionstatechange = () => {
      if (pcRef.current !== pc) return;
      if (pc.connectionState === "connected") {
        clearTimeout(timeout.current);
        updateStatus("connected");
        clearInterval(statsTimer.current);
        statsTimer.current = setInterval(() => {
          if (pcRef.current !== pc || !pc.getStats) return;
          void pc
            .getStats()
            .then((report) => {
              report.forEach((entry) => {
                if (
                  entry.type === "candidate-pair" &&
                  entry.state === "succeeded" &&
                  entry.nominated &&
                  typeof entry.currentRoundTripTime === "number"
                )
                  setCallLatencyMs(
                    Math.round(entry.currentRoundTripTime * 1000),
                  );
              });
            })
            .catch(() => {});
        }, 2000);
      } else if (pc.connectionState === "failed") {
        setCallError(
          "The media connection failed. Check your network and try again.",
        );
        stopCall();
      } else if (pc.connectionState === "disconnected") {
        recoverConnection();
      }
    };
    return pc;
  };

  useEffect(() => {
    if (!user?.id || !couple?.id || couple.status !== "active" || !partnerId)
      return;
    let active = true;
    const onSignal =
      (handler: (value: { payload: Signal }) => unknown) =>
      async (event: { payload: { sealed?: string } }) => {
        if (
          !partnerPubKey ||
          !event.payload ||
          typeof event.payload.sealed !== "string" ||
          event.payload.sealed.length > 150000
        )
          return;
        try {
          const value = JSON.parse(
            await decryptMessage(event.payload.sealed, partnerPubKey, user.id),
          );
          if (active) await handler({ payload: value });
        } catch {
          /* Invalid encrypted signal. */
        }
      };
    const channel = supabase.channel(`call:${couple.id}`, {
      config: { private: true, broadcast: { self: false } },
    });
    channelRef.current = channel;
    const valid = (payload: Signal) =>
      payload &&
      payload.senderId === partnerId &&
      typeof payload.callId === "string" &&
      payload.callId.length <= 64;
    channel
      .on(
        "broadcast",
        { event: "call:offer" },
        onSignal(({ payload }: { payload: Signal }) => {
          if (
            !valid(payload) ||
            payload.offer?.type !== "offer" ||
            !payload.offer.sdp
          )
            return;
          const simultaneous =
            status.current === "calling" && initiated.current;
          if (simultaneous && user.id > partnerId) {
            cleanup();
          } else if (status.current !== "idle") return;
          initiated.current = false;
          setCallError(null);
          callId.current = payload.callId;
          offerRef.current = payload.offer;
          videoRef.current = !!payload.isVideo;
          setIsVideoCall(!!payload.isVideo);
          updateStatus("incoming");
          armTimeout();
          if (simultaneous)
            queueMicrotask(() => {
              void acceptCall();
            });
        }),
      )
      .on(
        "broadcast",
        { event: "call:answer" },
        onSignal(async ({ payload }: { payload: Signal }) => {
          if (
            !valid(payload) ||
            payload.callId !== callId.current ||
            !["calling", "connecting"].includes(status.current) ||
            payload.answer?.type !== "answer" ||
            !pcRef.current
          )
            return;
          try {
            const pc = pcRef.current;
            await pc.setRemoteDescription(payload.answer);
            await flushCandidates(pc);
            if (pcRef.current === pc) connecting();
          } catch {
            stopCall();
          }
        }),
      )
      .on(
        "broadcast",
        { event: "call:ice-candidate" },
        onSignal(async ({ payload }: { payload: Signal }) => {
          if (
            !valid(payload) ||
            payload.callId !== callId.current ||
            !payload.candidate
          )
            return;
          try {
            if (pcRef.current?.remoteDescription)
              await pcRef.current.addIceCandidate(payload.candidate);
            else if (candidates.current.length < 128)
              candidates.current.push(payload.candidate);
          } catch {
            /* A superseded ICE candidate may arrive after hangup. */
          }
        }),
      )
      .on(
        "broadcast",
        { event: "call:hangup" },
        onSignal(({ payload }: { payload: Signal }) => {
          if (valid(payload) && payload.callId === callId.current) cleanup();
        }),
      )
      .on(
        "broadcast",
        { event: "call:restart-request" },
        onSignal(async ({ payload }) => {
          if (
            !valid(payload) ||
            payload.callId !== callId.current ||
            !pcRef.current ||
            !initiated.current ||
            pcRef.current.signalingState !== "stable"
          )
            return;
          await restartConnection();
        }),
      )
      .on(
        "broadcast",
        { event: "call:renegotiate" },
        onSignal(async ({ payload }) => {
          if (
            !valid(payload) ||
            payload.callId !== callId.current ||
            !pcRef.current ||
            payload.offer?.type !== "offer"
          )
            return;
          try {
            const pc = pcRef.current;
            connecting();
            descriptionSent.current = false;
            localCandidates.current = [];
            await pc.setRemoteDescription(payload.offer);
            await flushCandidates(pc);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await signal("call:answer", { answer });
            await flushLocalCandidates();
          } catch {
            stopCall();
          }
        }),
      )
      .subscribe((state) => {
        ready.current = state === "SUBSCRIBED";
        if (ready.current && !isSyncRequired && hasCloudBackup)
          void getIce().catch(() => {});
      });
    window.addEventListener("online", recoverConnection);
    return () => {
      window.removeEventListener("online", recoverConnection);
      active = false;
      ready.current = false;
      channelRef.current = null;
      void supabase.removeChannel(channel);
      cleanup();
    };
  }, [
    user?.id,
    couple?.id,
    couple?.status,
    partnerId,
    partnerPubKey,
    isSyncRequired,
    hasCloudBackup,
    cleanup,
  ]);

  const acquireMedia = async (video: boolean, revision: number) => {
    if (!navigator.mediaDevices?.getUserMedia)
      throw new Error(
        "Camera and microphone access requires a supported browser and HTTPS.",
      );
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: video ? { facingMode: "user" } : false,
    });
    // A user can hang up or sign out while the permission prompt is open.
    if (generation.current !== revision) {
      stream.getTracks().forEach((track) => track.stop());
      return null;
    }
    streamRef.current = stream;
    setLocalStream(stream);
    return stream;
  };
  const reportError = (error: unknown) => {
    stopCall();
    setCallError(
      error instanceof Error
        ? error.message
        : "Could not connect the call. Please retry.",
    );
  };
  const initiateCall = async (video: boolean) => {
    if (status.current !== "idle") return;
    if (!ready.current) {
      setCallError(
        "The private call connection is reconnecting. Please retry shortly.",
      );
      return;
    }
    if (isSyncRequired || !hasCloudBackup || !partnerPubKey) {
      setCallError("Unlock and protect your chat history before calling.");
      return;
    }
    setCallError(null);
    initiated.current = true;
    callId.current = crypto.randomUUID();
    videoRef.current = video;
    setIsVideoCall(video);
    updateStatus("calling");
    armTimeout();
    const revision = generation.current;
    try {
      const stream = await acquireMedia(video, revision);
      if (!stream) return;
      const pc = await makePeer(revision);
      if (!pc) return;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      if (revision !== generation.current) return;
      await signal("call:offer", { offer, isVideo: video });
      await flushLocalCandidates();
    } catch (error) {
      if (revision === generation.current) reportError(error);
    }
  };
  const acceptCall = async () => {
    if (status.current !== "incoming" || !offerRef.current) return;
    if (isSyncRequired || !hasCloudBackup || !partnerPubKey || !ready.current) {
      setCallError(
        "Unlock your chat history and wait for the private connection before accepting.",
      );
      stopCall();
      return;
    }
    const offer = offerRef.current;
    updateStatus("connecting");
    const revision = generation.current;
    try {
      const stream = await acquireMedia(videoRef.current, revision);
      if (!stream) return;
      const pc = await makePeer(revision);
      if (!pc) return;
      await pc.setRemoteDescription(offer);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      await flushCandidates(pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      if (revision !== generation.current) return;
      await signal("call:answer", { answer });
      await flushLocalCandidates();
      connecting();
    } catch (error) {
      if (revision === generation.current) reportError(error);
    }
  };
  const toggleMute = () => {
    const tracks = streamRef.current?.getAudioTracks() || [];
    const muted = tracks[0]?.enabled ?? false;
    tracks.forEach((track) => {
      track.enabled = !muted;
    });
    setIsMuted(muted);
  };
  const toggleVideo = () => {
    const tracks = streamRef.current?.getVideoTracks() || [];
    const off = tracks[0]?.enabled ?? false;
    tracks.forEach((track) => {
      track.enabled = !off;
    });
    setIsVideoOff(off);
  };
  return (
    <CallContext.Provider
      value={{
        callError,
        dismissCallError: () => setCallError(null),
        callLatencyMs,
        callStatus,
        localStream,
        remoteStream,
        isIncomingCall: callStatus === "incoming",
        callerName: partnerProfile?.full_name || "Partner",
        isVideoCall,
        initiateCall,
        acceptCall,
        rejectCall: stopCall,
        endCall: stopCall,
        toggleMute,
        toggleVideo,
        isMuted,
        isVideoOff,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};
export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) throw new Error("useCall must be used within a CallProvider");
  return context;
};
