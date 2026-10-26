// Development-only harness: actual CallContext, Auth, encryption, private signaling
// and browser WebRTC, with generated media instead of microphone/camera access.
import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider, useAuth } from "../../contexts/AuthContext";
import { CouplesProvider, useCouples } from "../../contexts/CouplesContext";
import { CallProvider, useCall } from "../../contexts/CallContext";
import { supabase } from "../../lib/supabase";
if (!import.meta.env.DEV) throw new Error("Development harness only");
const peers: RTCPeerConnection[] = [];
const iceErrors: number[] = [];
let relayCandidates = 0;
const NativePeer = window.RTCPeerConnection;
window.RTCPeerConnection = class extends NativePeer {
  constructor(configuration?: RTCConfiguration) {
    super({
      ...configuration,
      ...(new URLSearchParams(location.search).get("relay") === "1"
        ? { iceTransportPolicy: "relay" as const }
        : {}),
    });
    this.addEventListener("icecandidateerror", (event) =>
      iceErrors.push(event.errorCode),
    );
    this.addEventListener("icecandidate", (event) => {
      if (event.candidate?.type === "relay") relayCandidates++;
    });
    peers.push(this);
  }
};
Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
  configurable: true,
  value: async (constraints: MediaStreamConstraints) => {
    const stream = new MediaStream();
    const audio = new AudioContext();
    await audio.resume();
    const source = audio.createOscillator(),
      destination = audio.createMediaStreamDestination();
    source.frequency.value = 440;
    source.connect(destination);
    source.start();
    stream.addTrack(destination.stream.getAudioTracks()[0]);
    if (constraints.video) {
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 180;
      const context = canvas.getContext("2d")!;
      const draw = () => {
        context.fillStyle = `hsl(${(performance.now() / 20) % 360},60%,45%)`;
        context.fillRect(0, 0, 320, 180);
        context.fillStyle = "white";
        context.font = "20px sans-serif";
        context.fillText("Synthetic QA media", 30, 90);
        requestAnimationFrame(draw);
      };
      draw();
      canvas
        .captureStream(15)
        .getVideoTracks()
        .forEach((track) => stream.addTrack(track));
    }
    const cleanup = setInterval(() => {
      if (stream.getTracks().every((track) => track.readyState === "ended")) {
        source.stop();
        void audio.close();
        clearInterval(cleanup);
      }
    }, 250);
    return stream;
  },
});
function Harness() {
  const auth = useAuth(),
    couples = useCouples(),
    call = useCall();
  const [error, setError] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const [metrics, setMetrics] = useState<Record<string, unknown>>({});
  useEffect(() => {
    if (video.current) video.current.srcObject = call.remoteStream;
  }, [call.remoteStream]);
  useEffect(() => {
    const timer = setInterval(() => {
      void (async () => {
        const pc = peers.at(-1);
        if (!pc) return;
        let audioPackets = 0,
          videoFrames = 0,
          roundTripMs: number | null = null,
          relay = false;
        const stats = await pc.getStats();
        stats.forEach((entry) => {
          if (entry.type === "inbound-rtp") {
            if (entry.kind === "audio")
              audioPackets += entry.packetsReceived || 0;
            if (entry.kind === "video") videoFrames += entry.framesDecoded || 0;
          }
          if (
            entry.type === "candidate-pair" &&
            entry.state === "succeeded" &&
            entry.nominated
          ) {
            roundTripMs = Math.round((entry.currentRoundTripTime || 0) * 1000);
            relay =
              stats.get(entry.localCandidateId)?.candidateType === "relay";
          }
        });
        setMetrics({
          iceErrors,
          relayCandidates,
          connection: pc.connectionState,
          audioPackets,
          videoFrames,
          roundTripMs,
          relay,
          liveLocalTracks:
            call.localStream
              ?.getTracks()
              .filter((track) => track.readyState === "live").length || 0,
        });
      })();
    }, 500);
    return () => clearInterval(timer);
  }, [call.localStream]);
  const act = (action: () => Promise<unknown>) => {
    setError("");
    void action().catch((e) => setError(e.message));
  };
  return (
    <main
      style={{
        fontFamily: "sans-serif",
        maxWidth: 720,
        margin: "24px auto",
        padding: 16,
        lineHeight: 1.6,
      }}
    >
      <h1>Synthetic voice/video verification</h1>
      <p>
        No microphone or camera is accessed. Generated audio/video exercises the
        real encrypted call path.
      </p>
      <p role="status">
        Account: {auth.user?.role || "signed out"} · identity:{" "}
        {couples.isSyncRequired
          ? "locked"
          : couples.hasCloudBackup
            ? "ready"
            : "initializing"}{" "}
        · call: {call.callStatus}
      </p>
      {auth.error && <p role="alert">{auth.error}</p>}
      {error && <p role="alert">{error}</p>}
      {call.callError && <p role="alert">{call.callError}</p>}
      {!auth.user ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            act(async () => {
              const { error } = await supabase.auth.signInWithPassword({
                email: String(form.get("email")),
                password: String(form.get("password")),
              });
              if (error) throw error;
            });
          }}
        >
          <label>
            Email
            <input
              name="email"
              type="email"
              autoComplete="off"
              required
              style={{ display: "block", padding: 10 }}
            />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete="off"
              required
              style={{ display: "block", padding: 10 }}
            />
          </label>
          <button>Sign in QA account</button>
        </form>
      ) : (
        <>
          {couples.isSyncRequired && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const passphrase = String(
                  new FormData(event.currentTarget).get("passphrase"),
                );
                act(() => couples.restoreFromCloudBackup(passphrase));
              }}
            >
              <label>
                Recovery passphrase
                <input
                  name="passphrase"
                  type="password"
                  autoComplete="off"
                  required
                  style={{ display: "block", padding: 10 }}
                />
              </label>
              <button>Unlock QA identity</button>
            </form>
          )}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              margin: "20px 0",
            }}
          >
            <button onClick={() => act(() => call.initiateCall(false))}>
              Start synthetic voice call
            </button>
            <button onClick={() => act(() => call.initiateCall(true))}>
              Start synthetic video call
            </button>
            <button onClick={() => act(call.acceptCall)}>
              Accept synthetic call
            </button>
            <button onClick={call.endCall}>End synthetic call</button>
            <button onClick={() => act(auth.signOut)}>
              Sign out QA account
            </button>
          </div>
          <video
            ref={video}
            autoPlay
            muted
            playsInline
            style={{ width: 320, height: 180, background: "#111" }}
          />
          <pre aria-label="Call diagnostics">
            {JSON.stringify(metrics, null, 2)}
          </pre>
        </>
      )}
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <CouplesProvider>
      <CallProvider>
        <Harness />
      </CallProvider>
    </CouplesProvider>
  </AuthProvider>,
);
