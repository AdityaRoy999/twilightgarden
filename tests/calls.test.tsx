vi.mock("../lib/encryption", () => ({
  encryptMessage: vi.fn(async (value) => value),
  decryptMessage: vi.fn(async (value) => value),
}));
vi.mock("../lib/callIce", () => ({
  loadCallIce: vi.fn(async () => ({
    iceServers: [],
    expiresAt: Date.now() + 3600000,
    relayConfigured: true,
  })),
}));
// @vitest-environment jsdom
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  identityReady: true,
  needsSync: false,
  handlers: {} as Record<string, (event: any) => unknown>,
  channel: { on: vi.fn(), subscribe: vi.fn(), send: vi.fn() },
  remove: vi.fn(),
  peer: null as any,
}));
vi.mock("../lib/supabase", () => ({
  supabase: { channel: () => mocks.channel, removeChannel: mocks.remove },
}));
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "A" } }),
}));
vi.mock("../contexts/CouplesContext", () => ({
  useCouples: () => ({
    couple: {
      id: "couple",
      partner_1_id: "A",
      partner_2_id: "B",
      status: "active",
    },
    partnerProfile: { full_name: "Partner" },
    partnerPubKey: "synthetic-key",
    isSyncRequired: mocks.needsSync,
    identityReady: mocks.identityReady,
    hasCloudBackup: false,
  }),
}));
import { CallProvider, useCall } from "../contexts/CallContext";
let getMedia: ReturnType<typeof vi.fn>,
  stop: ReturnType<typeof vi.fn>,
  close: ReturnType<typeof vi.fn>;
function Probe() {
  const call = useCall();
  return (
    <>
      <p>{call.callStatus}</p>
      <button onClick={() => void call.initiateCall(false)}>Call</button>
      <button onClick={call.endCall}>End</button>
      <button onClick={() => void call.sendReaction('heart')}>React</button>
      <output data-testid="call-extras">{JSON.stringify({ reactions: call.reactions, sharing: call.remoteSharingScreen, paused: call.remoteVideoPaused, off: call.remoteVideoOff })}</output>
    </>
  );
}
beforeEach(() => {
  mocks.identityReady = true;
  mocks.needsSync = false;
  mocks.channel.send.mockClear();
  mocks.handlers = {};
  mocks.channel.on.mockImplementation((_kind, filter, handler) => {
    mocks.handlers[filter.event] = handler;
    return mocks.channel;
  });
  mocks.channel.subscribe.mockImplementation((callback) => {
    callback("SUBSCRIBED");
    return mocks.channel;
  });
  mocks.channel.send.mockResolvedValue("ok");
  getMedia = vi.fn();
  stop = vi.fn();
  close = vi.fn();
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: getMedia },
  });
  vi.stubGlobal(
    "RTCPeerConnection",
    class {
      constructor() { mocks.peer = this; }
      connectionState = 'new';
      close = close;
      addTrack = vi.fn();
      createOffer = vi
        .fn()
        .mockResolvedValue({ type: "offer", sdp: "synthetic" });
      setLocalDescription = vi.fn().mockResolvedValue(undefined);
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const stream = () => ({
  getTracks: () => [{ stop }],
  getAudioTracks: () => [],
  getVideoTracks: () => [],
});
describe("call lifecycle", () => {
  it('encrypts call reactions and rejects media state from another call or sender', async () => {
    getMedia.mockResolvedValue(stream());
    render(<CallProvider><Probe/></CallProvider>);
    fireEvent.click(screen.getByText('Call'));
    await waitFor(() => expect(mocks.channel.send).toHaveBeenCalled());
    const offer = mocks.channel.send.mock.calls.find(([message]) => message.event === 'call:offer')![0];
    const id = JSON.parse(offer.payload.sealed).callId;
    await act(async () => { mocks.peer.connectionState = 'connected'; mocks.peer.onconnectionstatechange(); });
    fireEvent.click(screen.getByText('React'));
    await waitFor(() => expect(mocks.channel.send.mock.calls.some(([message]) => message.event === 'call:reaction')).toBe(true));
    const reaction = mocks.channel.send.mock.calls.find(([message]) => message.event === 'call:reaction')![0];
    expect(Object.keys(reaction.payload)).toEqual(['sealed']);
    expect(JSON.parse(reaction.payload.sealed)).toMatchObject({ callId: id, senderId: 'A', reaction: 'heart' });
    for (const [senderId, callId] of [['outsider', id], ['B', 'old-call']]) {
      await act(async () => { await mocks.handlers['call:media']({ payload: { sealed: JSON.stringify({ senderId, callId, sharingScreen: true, videoPaused: true, videoOff: true }) } }); });
    }
    expect(JSON.parse(screen.getByTestId('call-extras').textContent!).sharing).toBe(false);
    expect(JSON.parse(screen.getByTestId('call-extras').textContent!)).toMatchObject({ paused: false, off: false });
    await act(async () => { await mocks.handlers['call:media']({ payload: { sealed: JSON.stringify({ senderId: 'B', callId: id, sharingScreen: true, videoPaused: true, videoOff: true }) } }); });
    expect(JSON.parse(screen.getByTestId('call-extras').textContent!)).toMatchObject({ sharing: true, paused: true, off: true });
    const media = mocks.channel.send.mock.calls.find(([message]) => message.event === 'call:media')![0];
    expect(Object.keys(media.payload)).toEqual(['sealed']);
    expect(JSON.parse(media.payload.sealed)).toMatchObject({ callId: id, senderId: 'A', sharingScreen: false, videoPaused: false, videoOff: false });
    fireEvent.click(screen.getByText('End'));
    expect(JSON.parse(screen.getByTestId('call-extras').textContent!)).toEqual({ reactions: [], sharing: false, paused: false, off: false });
  });
  it("starts an encrypted call on a ready device without requiring a cloud backup", async () => {
    getMedia.mockResolvedValue(stream());
    render(
      <CallProvider>
        <Probe />
      </CallProvider>,
    );
    fireEvent.click(screen.getByText("Call"));
    await waitFor(() =>
      expect(mocks.channel.send).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "call:offer",
          payload: expect.objectContaining({ sealed: expect.any(String) }),
        }),
      ),
    );
    expect(getMedia).toHaveBeenCalledTimes(1);
    expect(screen.getByText("calling")).toBeTruthy();
  });
  it("still blocks a new device that has not restored its identity", () => {
    mocks.needsSync = true;
    render(
      <CallProvider>
        <Probe />
      </CallProvider>,
    );
    fireEvent.click(screen.getByText("Call"));
    expect(getMedia).not.toHaveBeenCalled();
    expect(screen.getByText("idle")).toBeTruthy();
  });
  it("waits for identity initialization before opening media", () => {
    mocks.identityReady = false;
    render(
      <CallProvider>
        <Probe />
      </CallProvider>,
    );
    fireEvent.click(screen.getByText("Call"));
    expect(getMedia).not.toHaveBeenCalled();
    expect(screen.getByText("idle")).toBeTruthy();
  });
  it("stops media granted after the user already ended the call", async () => {
    let grant!: (stream: unknown) => void;
    getMedia.mockImplementation(
      () =>
        new Promise((r) => {
          grant = r;
        }),
    );
    render(
      <CallProvider>
        <Probe />
      </CallProvider>,
    );
    fireEvent.click(screen.getByText("Call"));
    expect(screen.getByText("calling")).toBeTruthy();
    fireEvent.click(screen.getByText("End"));
    await act(async () => grant(stream()));
    expect(stop).toHaveBeenCalledTimes(1);
    expect(screen.getByText("idle")).toBeTruthy();
  });
  it("stops active tracks and closes the peer on unmount", async () => {
    getMedia.mockResolvedValue(stream());
    const view = render(
      <CallProvider>
        <Probe />
      </CallProvider>,
    );
    fireEvent.click(screen.getByText("Call"));
    await waitFor(() => expect(mocks.channel.send).toHaveBeenCalled());
    view.unmount();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });
  it("ignores busy offers and hangups for other call IDs", async () => {
    render(
      <CallProvider>
        <Probe />
      </CallProvider>,
    );
    await act(async () =>
      mocks.handlers["call:offer"]({
        payload: {
          sealed: JSON.stringify({
            senderId: "B",
            callId: "first",
            offer: { type: "offer", sdp: "synthetic" },
          }),
        },
      }),
    );
    expect(screen.getByText("incoming")).toBeTruthy();
    await act(async () =>
      mocks.handlers["call:offer"]({
        payload: {
          sealed: JSON.stringify({
            senderId: "B",
            callId: "second",
            offer: { type: "offer", sdp: "synthetic" },
          }),
        },
      }),
    );
    await act(async () =>
      mocks.handlers["call:hangup"]({
        payload: {
          sealed: JSON.stringify({ senderId: "B", callId: "second" }),
        },
      }),
    );
    expect(screen.getByText("incoming")).toBeTruthy();
    await act(async () =>
      mocks.handlers["call:hangup"]({
        payload: { sealed: JSON.stringify({ senderId: "B", callId: "first" }) },
      }),
    );
    expect(screen.getByText("idle")).toBeTruthy();
  });
});
