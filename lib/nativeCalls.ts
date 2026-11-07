import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
export type NativeCallState = { sessionId?: string; connected?: boolean; remotePresent?: boolean; sharing?: boolean; remoteSharing?: boolean; remoteVideoOff?: boolean; error?: string; ended?: boolean };
export type CallRect = { x: number; y: number; width: number; height: number; hidden?: boolean };
interface NativeCallsPlugin {
  capabilities(): Promise<{ available: boolean; screen: boolean; audio: boolean; reason?: string }>;
  connect(options: { sessionId: string; url: string; token: string; key: string; video: boolean }): Promise<void>;
  disconnect(options: { sessionId: string }): Promise<void>;
  microphone(options: { enabled: boolean }): Promise<void>;
  camera(options: { enabled: boolean }): Promise<void>;
  switchCamera(): Promise<void>;
  screen(options: { enabled: boolean; audio: boolean }): Promise<void>;
  layout(options: { remote: CallRect; local: CallRect }): Promise<void>;
  addListener(event: 'state', listener: (state: NativeCallState) => void): Promise<PluginListenerHandle>;
}
export const NativeCalls = registerPlugin<NativeCallsPlugin>('TwilightCalls');
export const hasNativeCalls = () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('TwilightCalls');
