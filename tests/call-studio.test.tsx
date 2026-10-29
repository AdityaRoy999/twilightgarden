// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CallStudioView } from '../components/CallStudio';
import type { useCall } from '../contexts/CallContext';
vi.mock('../contexts/CallContext', () => ({ useCall: vi.fn() }));
vi.mock('../hooks/useAppMotion', () => ({ useAppMotion: () => ({ reduced: true }) }));
vi.mock('../hooks/useDialogFocus', () => ({ useDialogFocus: () => {} }));
vi.mock('../hooks/useCallRingtone', () => ({ useCallRingtone: () => ({ blocked: false, enable: vi.fn() }) }));

function call(overrides: Partial<ReturnType<typeof useCall>> = {}): ReturnType<typeof useCall> {
  return {
    callStatus: 'connected', callerName: 'Synthetic partner', localStream: null, remoteStream: null,
    isIncomingCall: false, isVideoCall: true, isMuted: false, isVideoOff: false,
    initiateCall: vi.fn(), acceptCall: vi.fn(), rejectCall: vi.fn(), endCall: vi.fn(),
    toggleMute: vi.fn(), toggleVideo: vi.fn(), switchCamera: vi.fn(), toggleScreenShare: vi.fn(),
    setCameraEffect: vi.fn(), cameraEffect: { filter: 'original', blur: false },
    isSharingScreen: false, remoteSharingScreen: false, capturePaused: false,
    remoteVideoPaused: false, remoteVideoOff: false, isFrontCamera: true, mediaBusy: false,
    reactions: [], sendReaction: vi.fn(), callError: null, dismissCallError: vi.fn(),
    callLatencyMs: null, callNetwork: null, ...overrides,
  };
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

it('retains both incoming actions while compact, using one size toggle', async () => {
  const value = call({ callStatus: 'incoming', isIncomingCall: true });
  render(<CallStudioView call={value}/>);
  expect(document.querySelectorAll('.call-heading-actions button')).toHaveLength(1);
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Minimize call' })));
  expect(screen.getByRole('button', { name: 'Expand call' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Answer' }).getAttribute('aria-pressed')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Answer' }));
  expect(value.acceptCall).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
  expect(value.rejectCall).toHaveBeenCalledOnce();
});

it('shows interrupted screen capture without stopping the receiving video decoder', () => {
  const remote = { getVideoTracks: () => [] } as unknown as MediaStream;
  const value = call({ remoteStream: remote, remoteSharingScreen: true, remoteVideoPaused: true, remoteVideoOff: true });
  const view = render(<CallStudioView call={value}/>);
  expect(screen.getByRole('heading', { name: 'Screen sharing paused' })).toBeTruthy();
  expect((document.querySelector('.call-remote') as HTMLVideoElement).hidden).toBe(false);
  view.rerender(<CallStudioView call={{ ...value, remoteVideoPaused: false }}/>);
  expect(screen.queryByRole('heading', { name: 'Camera is off' })).toBeNull();
  expect(screen.queryByRole('heading', { name: 'Screen sharing paused' })).toBeNull();
});

it('detects frozen decoded video and clears the notice once new frames arrive', () => {
  let frames = 0;
  const remote = { getVideoTracks: () => [] } as unknown as MediaStream;
  render(<CallStudioView call={call({ remoteStream: remote })}/>);
  Object.defineProperty(document.querySelector('.call-remote'), 'getVideoPlaybackQuality', { value: () => ({ totalVideoFrames: frames }) });
  act(() => vi.advanceTimersByTime(10000));
  expect(screen.getByRole('heading', { name: 'Video paused' })).toBeTruthy();
  expect((document.querySelector('.call-remote') as HTMLVideoElement).hidden).toBe(false);
  frames++;
  act(() => vi.advanceTimersByTime(2000));
  expect(screen.queryByRole('heading', { name: 'Video paused' })).toBeNull();
});
