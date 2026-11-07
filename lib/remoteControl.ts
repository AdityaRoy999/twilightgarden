export type RemoteInput = { kind: 'move' | 'click'; x: number; y: number } | { kind: 'scroll'; delta: number } | { kind: 'key'; key: 'Backspace' | 'Enter' | 'Tab' | 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' } | { kind: 'text'; text: string };
/** Screen shares are fitted inside the call stage. Letterboxing is not part of
 * the remote display and must never produce a click at an unrelated position. */
export function sharedDisplayPoint(x: number, y: number, rect: {left:number;top:number;width:number;height:number}, videoWidth: number, videoHeight: number) {
  if (!videoWidth || !videoHeight || !rect.width || !rect.height) return null;
  const scale = Math.min(rect.width / videoWidth, rect.height / videoHeight);
  const width = videoWidth * scale, height = videoHeight * scale;
  const left = rect.left + (rect.width - width) / 2, top = rect.top + (rect.height - height) / 2;
  const px = (x - left) / width, py = (y - top) / height;
  return px >= 0 && px <= 1 && py >= 0 && py <= 1 ? {x:px,y:py} : null;
}
export const desktopControlAvailable = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
export function validRemoteInput(value: unknown): value is RemoteInput {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return v.kind === 'move' || v.kind === 'click' ? typeof v.x === 'number' && typeof v.y === 'number' && Number.isFinite(v.x) && Number.isFinite(v.y) && v.x >= 0 && v.x <= 1 && v.y >= 0 && v.y <= 1 :
    v.kind === 'scroll' ? typeof v.delta === 'number' && Number.isInteger(v.delta) && Math.abs(v.delta) <= 5 :
    v.kind === 'key' ? ['Backspace', 'Enter', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(String(v.key)) :
    v.kind === 'text' && typeof v.text === 'string' && [...v.text].length <= 32 && !/[\u0000-\u001f\u007f]/.test(v.text);
}
export async function enableDesktopControl(callId: string, token: string) {
  if (!desktopControlAvailable()) throw new Error('Remote control requires the installed desktop app.');
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('enable_remote_control', { callId, token });
}
export async function revokeDesktopControl() {
  if (!desktopControlAvailable()) return;
  const { invoke } = await import('@tauri-apps/api/core'); await invoke('revoke_remote_control');
}
export async function applyDesktopInput(callId: string, token: string, input: RemoteInput) {
  if (!validRemoteInput(input) || !desktopControlAvailable()) return;
  const { invoke } = await import('@tauri-apps/api/core'); await invoke('apply_remote_input', { callId, token, input });
}
