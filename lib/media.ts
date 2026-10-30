import { supabase } from './supabase';
import { decryptBlob } from './encryption';
import {encryptPrivateAvatar} from './privateData';

const PREFIX = 'chat-media:';

// Persist a storage path, never an expiring signed URL, inside the encrypted note.
export function chatMediaPath(source: string): string | null {
  if (source.startsWith(PREFIX)) return source.slice(PREFIX.length);
  try {
    const url = new URL(source);
    const backend = new URL(import.meta.env.VITE_SUPABASE_URL);
    if (url.origin !== backend.origin) return null;
    const match = url.pathname.match(/^\/storage\/v1\/object\/(?:public|sign|authenticated)\/chat-media\/(.+)$/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch { return null; }
}

export async function loadChatMedia(source: string, partnerKey: string | null, signal?: AbortSignal): Promise<Blob> {
  if (!partnerKey) throw new Error('Unlock your encryption identity to view this attachment.');
  const path = chatMediaPath(source);
  if (!path || path.includes('..') || path.startsWith('/')) throw new Error('Invalid attachment reference.');
  const { data, error } = await supabase.storage.from('chat-media').createSignedUrl(path, 60);
  if (error || !data?.signedUrl) throw error || new Error('Attachment access denied.');
  const response = await fetch(data.signedUrl, { signal });
  if (!response.ok) throw new Error('Attachment download failed.');
  return new Blob([await decryptBlob(await response.arrayBuffer(), partnerKey)]);
}

export function validateAvatar(file: File): void {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPEG, PNG or WebP image.');
  if (!file.size || file.size > 5 * 1024 * 1024) throw new Error('Choose an image smaller than 5 MB.');
}

export async function uploadAvatar(file: File, userId: string): Promise<string> {
  validateAvatar(file);
  return encryptPrivateAvatar(file,userId);
}
