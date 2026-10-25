import React, { useState, useEffect } from 'react';
import { loadChatMedia } from '../lib/media';
import { AudioPlayer } from './ui/AudioPlayer';

interface SecureMediaProps { src: string; partnerPubKey: string | null; }

function useSecureMedia(src: string, partnerKey: string | null): { url?: string; error?: boolean } {
  const [state, setState] = useState<{ source: string; key: string | null; url?: string; error?: boolean }>({ source: '', key: null });
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | undefined;
    loadChatMedia(src, partnerKey, controller.signal).then(blob => {
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(blob);
      setState({ source: src, key: partnerKey, url: objectUrl });
    }).catch(() => {
      if (!controller.signal.aborted) setState({ source: src, key: partnerKey, error: true });
    });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [src, partnerKey]);
  return state.source === src && state.key === partnerKey ? state : {};
}

export const SecureImage: React.FC<SecureMediaProps & { alt?: string; className?: string; onClick?: () => void }> = ({ src, partnerPubKey, alt, className, onClick }) => {
  const { url, error } = useSecureMedia(src, partnerPubKey);
  if (error) return <div role="status" className="p-4 text-xs text-gray-500">Attachment locked or unavailable. Restore your encryption identity and retry.</div>;
  if (!url) return <div className={`animate-pulse bg-gray-100 dark:bg-white/5 rounded-lg ${className}`} style={{ minHeight: 100 }} />;
  return <img src={url} alt={alt || 'Shared image'} className={className} onClick={onClick} loading="lazy" />;
};

export const SecureAudio: React.FC<SecureMediaProps & { isMe: boolean }> = ({ src, partnerPubKey, isMe }) => {
  const { url, error } = useSecureMedia(src, partnerPubKey);
  if (error) return <p role="status" className="p-4 text-xs text-gray-500">Audio locked or unavailable. Restore your encryption identity and retry.</p>;
  if (!url) return <div className="h-14 w-60 animate-pulse bg-gray-100 dark:bg-white/5 rounded-xl" />;
  return <AudioPlayer src={url} isMe={isMe} />;
};
