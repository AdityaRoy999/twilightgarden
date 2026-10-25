import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useCouples } from './CouplesContext';
import { decryptData } from '../lib/encryption';
import type { Database } from '../types';

export type Notification = Database['public']['Tables']['notifications']['Row'];
interface NotificationState {
  notifications: Notification[]; unreadCount: number; error: string | null;
  markAsRead: (id: string) => Promise<void>; markAllAsRead: () => Promise<void>;
}
const Context = createContext<NotificationState | undefined>(undefined);
export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { partnerPubKey, keyVersion } = useCouples();
  const [state, setState] = useState<{ userId: string | null; notifications: Notification[]; unreadCount: number }>({ userId: null, notifications: [], unreadCount: 0 });
  const [error, setError] = useState<string | null>(null);
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
    if (!user) return;
    const channel = supabase.channel(`notifications_${user.id}`).on('postgres_changes', {
      event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}`,
    }, () => { void load(); }).subscribe(status => { if (status === 'SUBSCRIBED') void load(); });
    void load();
    return () => { revision.current++; void supabase.removeChannel(channel); };
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
  return <Context.Provider value={{ notifications: own ? state.notifications : [], unreadCount: own ? state.unreadCount : 0, error, markAsRead, markAllAsRead }}>{children}</Context.Provider>;
};
export const useNotifications = () => { const context = useContext(Context); if (!context) throw new Error('useNotifications must be used within NotificationProvider'); return context; };
