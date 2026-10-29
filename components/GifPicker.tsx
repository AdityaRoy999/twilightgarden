import React, { useEffect, useRef, useState } from 'react';
import { SpringModal } from './ui/SpringModal';
import { AppIcon } from './ui/Icons';
import { useAppMotion } from '../hooks/useAppMotion';
import { searchGiphy, type GiphyGif } from '../lib/giphySearch';
import { requestSignal } from '../lib/requestSignal';
import { useTheme } from '../contexts/ThemeContext';

function GifTile({ gif, onSend, reduced }: { gif: GiphyGif; onSend: (url: string) => void; reduced: boolean }) {
  const tile = useRef<HTMLButtonElement>(null), [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!tile.current) return;
    const observer = new IntersectionObserver(entries => setVisible(entries[0].isIntersecting), { rootMargin: '30px' });
    observer.observe(tile.current); return () => observer.disconnect();
  }, []);
  const small = gif.images.fixed_width_small || gif.images.fixed_width;
  const poster = gif.images.fixed_width_small_still?.url || gif.images.fixed_width_still?.url;
  const source = visible && !reduced ? small?.webp || small?.url : poster;
  const sendUrl = gif.images.fixed_width?.url || gif.images.fixed_height?.url;
  return <button ref={tile} aria-label={`Send ${gif.title || 'GIF'}`} onClick={() => sendUrl && onSend(sendUrl)}>
    {source && <img src={source} alt={gif.title || 'GIF'} width="160" height="160" decoding="async" loading="lazy"/>}
  </button>;
}
export function GifPicker({ open, onClose, onSend }: { open: boolean; onClose: () => void; onSend: (url: string) => void }) {
  const [query, setQuery] = useState(''), [gifs, setGifs] = useState<GiphyGif[]>([]);
  const [loading, setLoading] = useState(false), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  const { reduced } = useAppMotion();
  const { theme } = useTheme();
  useEffect(() => {
    if (!open) { setGifs([]); setQuery(''); return; }
    let current = true;
    const controller = new AbortController();
    const request = requestSignal(12000, controller.signal);
    setLoading(true); setError('');
    const timer = setTimeout(() => {
      void searchGiphy(query, import.meta.env.VITE_GIPHY_API_KEY || '', request.signal)
        .then(results => { if (current) setGifs(results); })
        .catch(reason => { if (current) { setGifs([]); setError(reason?.name === 'TimeoutError' ? 'GIF search took too long. Please retry.' : reason.message || 'Could not load GIFs.'); } })
        .finally(() => { request.dispose(); if (current) setLoading(false); });
    }, query ? 250 : 0);
    return () => { current = false; controller.abort(); request.dispose(); clearTimeout(timer); };
  }, [open, query, retry]);
  return <SpringModal open={open} onClose={onClose} label="Choose a GIF" sheet className="chat-tool-sheet gif-sheet" backdropClassName="chat-tool-backdrop">
    <div className="chat-tool-heading"><h3><AppIcon name="Gif"/>GIFs</h3><button aria-label="Close GIF picker" onClick={onClose}><AppIcon name="X"/></button></div>
    <input aria-label="Search GIFs" placeholder="Search GIPHY" value={query} maxLength={50} onChange={event => setQuery(event.target.value)} autoComplete="off"/>
    {error ? <div role="status" className="gif-feedback">{error}<button className="block min-h-11 underline" onClick={() => setRetry(value => value + 1)}>Retry</button></div>
      : <><div className="gif-grid" aria-busy={loading}>{gifs.map(gif => <GifTile key={gif.id} gif={gif} onSend={onSend} reduced={reduced}/>)}</div>
        {loading ? <p role="status" className="gif-feedback">Finding GIFs…</p> : !gifs.length && <p role="status" className="gif-feedback">No GIFs found. Try another search.</p>}</>}
    <img className="giphy-credit" src={`${import.meta.env.BASE_URL}brand/giphy-${theme}.png`} width="120" alt="Powered By GIPHY"/>
  </SpringModal>;
}
