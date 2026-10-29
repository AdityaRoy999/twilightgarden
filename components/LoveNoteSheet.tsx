import React, { useEffect, useRef, useState } from 'react';
import { SpringModal } from './ui/SpringModal';
import { AppIcon } from './ui/Icons';
import { AI_MOODS, generateLoveNote, type AIMood } from '../lib/ai';
import { CallReactionSymbol } from './CallReactionSymbol';
import type { CallReactionName } from '../lib/callReactions';
const moodSymbols: Record<AIMood, CallReactionName> = { missing: 'heart', morning: 'wave', appreciation: 'clap', flirty: 'kiss', apology: 'heart', encouragement: 'celebrate' };
export function LoveNoteSheet({ open, onClose, onGenerated }: { open: boolean; onClose: () => void; onGenerated: (text: string) => void }) {
  const [mood, setMood] = useState<AIMood | null>(null), [context, setContext] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!open) { request.current?.abort(); setBusy(false); setError(''); }
    return () => request.current?.abort();
  }, [open]);
  const generate = async () => {
    if (!mood || busy) return;
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError('');
    try {
      const result = await generateLoveNote(mood, context.trim() || undefined, controller.signal);
      if (controller.signal.aborted) return;
      if (result.error) { setError(result.error); return; }
      onGenerated(result.text); setMood(null); setContext(''); onClose();
    } finally { if (!controller.signal.aborted) setBusy(false); }
  };
  return <SpringModal open={open} onClose={onClose} sheet label="AI love note" className="chat-tool-sheet" backdropClassName="chat-tool-backdrop">
    <div className="chat-tool-heading"><h3><AppIcon name="Sparkles"/>A little help finding words</h3><button aria-label="Close AI love note" onClick={onClose}><AppIcon name="X"/></button></div>
    <p className="text-sm text-secondary">Choose a mood. Review and edit the suggestion before sending.</p>
    <div className="ai-note-moods">{AI_MOODS.map(item => <button key={item.key} aria-pressed={mood === item.key} onClick={() => setMood(item.key)} disabled={busy}>
      <CallReactionSymbol name={moodSymbols[item.key]} size={34}/>{item.label}</button>)}</div>
    <label className="ai-note-context" htmlFor="love-note-context">Add context, if you like</label>
    <input id="love-note-context" value={context} maxLength={1000} placeholder="A memory, a little detail…" onChange={event => setContext(event.target.value)}/>
    {error && <p role="alert" className="gif-feedback">{error}</p>}
    <button className="ai-note-generate" disabled={!mood || busy} onClick={() => void generate()}><AppIcon name={busy ? 'Clock' : 'Sparkles'}/>{busy ? 'Finding the words…' : 'Create message'}</button>
  </SpringModal>;
}
