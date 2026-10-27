import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useCouples } from './CouplesContext';
import { decryptData } from '../lib/encryption';
import type { Database } from '../types';
import { presentNativeGameInvitation } from '../lib/gameAlerts';

export type Notification = Database['public']['Tables']['notifications']['Row'];
interface NotificationState {
  notifications: Notification[]; unreadCount: number; error: string | null;
  markAsRead: (id: string) => Promise<void>; markAllAsRead: () => Promise<void>;
  arrival: Notification | null; dismissArrival: () => void;
}
const Context = createContext<NotificationState | undefined>(undefined);
export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { partnerPubKey, keyVersion } = useCouples();
  const [state, setState] = useState<{ userId: string | null; notifications: Notification[]; unreadCount: number }>({ userId: null, notifications: [], unreadCount: 0 });
  const [error, setError] = useState<string | null>(null);
  const [arrival, setArrival] = useState<{userId:string; note:Notification} | null>(null);
  const revision = useRef(0);
  const load = useCallback(async () => {
    if (!user) return;
    const current = ++revision.current;
    try {
      const [rows, count] = await Promise.all([
        supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100),
        supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', false),
      ]);
      if (rows.error) throw rows.error; if (count.error) throw count.error;
      const notifications = await Promise.all((rows.data || []).map(async n => {
        if (!n.encrypted_payload) return n;
        const payload = partnerPubKey ? await decryptData<{ message: string }>(n.encrypted_payload, partnerPubKey, user.id) : null;
        return { ...n, message: payload?.message || 'Encrypted notification — restore your identity to read it.' };
      }));
      if (current === revision.current) { setState({ userId: user.id, notifications, unreadCount: count.count || 0 }); setError(null); }
    } catch { if (current === revision.current) setError('Could not load notifications.'); }
  }, [user?.id, partnerPubKey, keyVersion]);

  useEffect(() => {
    setState({ userId: user?.id || null, notifications: [], unreadCount: 0 }); setError(null);
    setArrival(null);
    if (!user) return;
    let active = true;
    const seen = new Set<string>();
    const channel = supabase.channel(`notifications_${user.id}`).on('postgres_changes', {
      event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}`,
    }, (payload) => {
      if (!active) return;
      const note = payload.new as Notification;
      if (payload.eventType === 'INSERT' && note?.user_id === user.id && note.type === 'game' && !note.is_read && !seen.has(note.id)) {
        seen.add(note.id);
        if (seen.size > 200) seen.delete(seen.values().next().value!);
        setArrival({userId:user.id,note});
        void presentNativeGameInvitation(note,user.role,()=>active).catch(()=>{});
      }
      void load();
    }).subscribe(status => { if (status === 'SUBSCRIBED') void load(); });
    void load();
    const resume = () => { if (document.visibilityState === 'visible') void load(); };
    window.addEventListener('online',load);
    document.addEventListener('visibilitychange',resume);
    return () => { active=false; revision.current++; void supabase.removeChannel(channel); window.removeEventListener('online',load); document.removeEventListener('visibilitychange',resume); };
  }, [user?.id, load]);

  const markAsRead = async (id: string) => {
    if (!user || state.userId !== user.id || state.notifications.find(n => n.id === id)?.is_read) return;
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id).eq('user_id', user.id);
    if (error) { setError('Could not mark this notification as read. Please retry.'); return; }
    await load();
  };
  const markAllAsRead = async () => {
    if (!user) return;
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    if (error) { setError('Could not mark notifications as read. Please retry.'); return; }
    await load();
  };
  const own = state.userId === user?.id;
  return <Context.Provider value={{ notifications: own ? state.notifications : [], unreadCount: own ? state.unreadCount : 0, error, markAsRead, markAllAsRead, arrival:arrival?.userId === user?.id ? arrival?.note ?? null : null, dismissArrival:()=>setArrival(null) }}>{children}</Context.Provider>;
};
export const useNotifications = () => { const context = useContext(Context); if (!context) throw new Error('useNotifications must be used within NotificationProvider'); return context; };
