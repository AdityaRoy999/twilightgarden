import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCouples } from '../contexts/CouplesContext';
import { useCall } from '../contexts/CallContext';
import { AppIcon } from './ui/Icons';
import { SpringModal } from './ui/SpringModal';
import { SecureAudio, SecureImage } from './SecureMedia';
import { loadCallHistory, callDuration, type CallRecord } from '../lib/callHistory';
import { chatThemes, loadChatSettings, saveChatSettings, type ChatTheme } from '../lib/chatSettings';
import { rawSupabase } from '../lib/supabase';
import { invalidatePrivateRecords } from '../lib/privateData';

type Section = 'details' | 'media' | 'links' | 'starred' | 'search' | 'calls' | 'theme';
export function ChatDetails({ open, onClose, verify, disconnect }: { open: boolean; onClose: () => void; verify: () => void; disconnect: () => void }) {
  const { user } = useAuth(), { couple, partnerProfile, notes, partnerPubKey, hasMoreNotes, loadingOlder, loadOlderNotes } = useCouples();
  const { initiateCall } = useCall();
  const navigate = useNavigate();
  const [section, setSection] = useState<Section>('details'), [query, setQuery] = useState('');
  const [history, setHistory] = useState<CallRecord[]>([]), [loading, setLoading] = useState(false), [error, setError] = useState('');
  const [theme, setTheme] = useState<ChatTheme>('garden'), [saving, setSaving] = useState(false);
  useEffect(() => { if (!open) { setSection('details'); setQuery(''); setError(''); } }, [open]);
  useEffect(() => {
    if (!open || !couple) return;
    let live = true;
    void loadChatSettings(couple.id).then(value => { if (live) setTheme(value.theme); }).catch(() => {});
    return () => { live = false; };
  }, [open, couple?.id]);
  useEffect(() => {
    if (!open || section !== 'calls' || !user || !couple) return;
    let live = true, serial = 0;
    const refresh = async () => {
      const current = ++serial; setLoading(true); setError('');
      try { const rows = await loadCallHistory(user.id, couple.id); if (live && current === serial) setHistory(rows); }
      catch { if (live && current === serial) setError('Could not load call history. Please retry.'); }
      finally { if (live && current === serial) setLoading(false); }
    };
    void refresh(); window.addEventListener('twilight-calls-changed', refresh);
    const channel = rawSupabase.channel(`history:${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'private_records', filter: `owner_id=eq.${user.id}` }, value => {
      if (value.eventType === 'DELETE' || value.new.kind === 'call_history') { invalidatePrivateRecords(user.id, 'call_history'); void refresh(); }
    }).subscribe();
    return () => { live = false; window.removeEventListener('twilight-calls-changed', refresh); void rawSupabase.removeChannel(channel); };
  }, [open, section, user?.id, couple?.id]);
  const selected = useMemo(() => notes.filter(note => {
    if (note.deleted_by?.includes(user?.id || '')) return false;
    if (section === 'starred') return note.starred_by?.includes(user?.id || '');
    if (section === 'media') return note.type !== 'text';
    if (section === 'links') return /https?:\/\//i.test(note.content);
    if (section === 'search') return !!query.trim() && note.content.toLowerCase().includes(query.trim().toLowerCase());
    return false;
  }), [section, notes, user?.id, query]);
  const chooseTheme = async (value: ChatTheme) => {
    if (!couple || saving) return; setSaving(true); setError('');
    try { await saveChatSettings({ coupleId: couple.id, theme: value, muted: false }); setTheme(value); }
    catch { setError('The chat theme could not be saved. Please retry.'); }
    finally { setSaving(false); }
  };
  const startCall = (video: boolean) => { onClose(); void initiateCall(video); };
  const row = (icon: string, title: string, action: () => void, detail?: string) => <button className="chat-detail-row" onClick={action}><span className="chat-detail-symbol"><AppIcon name={icon} size={23}/></span><span><strong>{title}</strong>{detail && <small>{detail}</small>}</span><AppIcon name="ChevronRight" size={19}/></button>;
  return <SpringModal open={open} onClose={onClose} label="Chat details" className="chat-details-panel" sheet>
    <header className="chat-detail-heading"><button aria-label={section === 'details' ? 'Close chat details' : 'Back to chat details'} onClick={() => section === 'details' ? onClose() : setSection('details')}><AppIcon name={section === 'details' ? 'X' : 'ArrowLeft'} size={23}/></button><h2>{({ details: 'Your connection', media: 'Shared media', links: 'Shared links', starred: 'Starred messages', search: 'Search conversation', calls: 'Call history', theme: 'Chat theme' })[section]}</h2></header>
    <div className="chat-details-scroll">
      {error && <p role="alert" className="chat-detail-feedback">{error}</p>}
      {section === 'details' ? <>
        <div className="chat-detail-person">{partnerProfile?.avatar_url ? <img src={partnerProfile.avatar_url} alt="Partner profile"/> : <span><AppIcon name="UserRound" size={48}/></span>}<h3>{partnerProfile?.full_name || 'Your partner'}</h3><p>A private space for the two of you.</p></div>
        <div className="chat-detail-actions"><button onClick={() => startCall(false)}><AppIcon name="Phone" size={24}/>Voice call</button><button onClick={() => startCall(true)}><AppIcon name="Video" size={24}/>Video call</button><button onClick={() => setSection('search')}><AppIcon name="Search" size={24}/>Search</button></div>
        <section className="chat-detail-group">{row('Image', 'Media', () => setSection('media'))}{row('Link', 'Links', () => setSection('links'))}{row('Star', 'Starred messages', () => setSection('starred'))}{row('Clock', 'Call history', () => setSection('calls'), 'Voice, video and missed calls')}</section>
        <section className="chat-detail-group">{row('Palette', 'Chat theme', () => setSection('theme'), 'Your own view of this conversation')}{row('BellRing', 'Notifications', () => { onClose(); navigate('/settings/notifications'); })}{row('UserRound', 'Edit my photo and profile', () => { onClose(); navigate('/settings/profile'); })}</section>
        <section className="chat-detail-group">{row('Shield', 'Verify encryption', () => { onClose(); verify(); }, 'Compare your connection code')}{row('Lock', 'Backup and privacy', () => { onClose(); navigate(user?.role === 'partner' ? '/partner/profile' : '/settings'); })}{row('LinkOff', 'Disconnect partner', () => { onClose(); disconnect(); }, 'Delete this connection’s shared content')}</section>
      </> : section === 'theme' ? <div className="chat-theme-choices">{chatThemes.map(value => <button data-theme-choice={value} key={value} aria-pressed={theme === value} disabled={saving} onClick={() => void chooseTheme(value)}><span className="chat-theme-sample"><i/><i/></span><strong>{value}</strong>{theme === value && <AppIcon name="Check" size={20}/>}</button>)}</div>
      : section === 'calls' ? <><p className="chat-detail-feedback">Encrypted history starts with calls made on this version. No calls are recorded.</p>{loading && <p role="status">Loading call history…</p>}{!loading && !history.length && !error && <p className="chat-detail-empty">Your calls will appear here.</p>}{history.map(item => <article className="chat-history-row" key={item.id}><span className="chat-detail-symbol"><AppIcon name={item.video ? 'Video' : 'Phone'} size={23}/></span><div><strong>{item.direction === 'incoming' ? 'Incoming' : 'Outgoing'} {item.video ? 'video' : 'voice'} call</strong><p>{new Date(item.startedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</p><small>{item.outcome === 'answered' ? callDuration(item.durationSeconds) : item.outcome}</small></div><button aria-label={`Return ${item.video ? 'video' : 'voice'} call`} onClick={() => startCall(item.video)}><AppIcon name={item.video ? 'Video' : 'Phone'} size={24}/></button></article>)}</>
      : <>{section === 'search' && <label className="chat-detail-search"><AppIcon name="Search" size={22}/><input aria-label="Search messages" value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a message…"/></label>}
        <p className="chat-detail-feedback">{selected.length} matching {selected.length === 1 ? 'message' : 'messages'} in loaded history{hasMoreNotes ? ' · Load earlier messages to search further.' : '.'}</p>
        <div className={section === 'media' ? 'chat-detail-media' : 'chat-detail-results'}>{selected.map(note => <article key={note.id}>
          {note.type === 'image' && note.media_url ? <SecureImage src={note.media_url} partnerPubKey={partnerPubKey} alt="Shared photo"/> : note.type === 'audio' && note.media_url ? <SecureAudio src={note.media_url} partnerPubKey={partnerPubKey} isMe={note.sender_id === user?.id}/> : note.type === 'gif' && note.media_url ? <img src={note.media_url} alt="Shared GIF" loading="lazy"/> : <p>{note.content}</p>}
          {section === 'links' && (note.content.match(/https?:\/\/[^\s<>"']+/g) || []).map(url => <a key={url} href={url} target="_blank" rel="noopener noreferrer">{url}</a>)}
          <time dateTime={note.created_at}>{new Date(note.created_at).toLocaleString(undefined, { dateStyle:'medium', timeStyle:'short' })}</time>
        </article>)}</div>{!selected.length && <p className="chat-detail-empty">{section === 'search' && !query ? 'Type to search your conversation.' : 'Nothing here yet.'}</p>}
        {hasMoreNotes && <button className="chat-detail-load" disabled={loadingOlder} onClick={() => void loadOlderNotes()}>{loadingOlder ? 'Loading earlier messages…' : 'Load earlier messages'}</button>}
      </>}
    </div>
  </SpringModal>;
}
