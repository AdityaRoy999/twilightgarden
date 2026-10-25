import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { Session, User as AuthUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { User } from '../types';
import { registerPushNotifications, resetPushRegistration } from '../lib/notifications';
import { clearEncryptionCache } from '../lib/encryption';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  sessionVerified: boolean;
  profileRefreshed: boolean;
  error: string | null;
  recoveringPassword: boolean;
  completePasswordRecovery: () => void;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
};

function clearPrivateCaches() {
  clearEncryptionCache();
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith('tw_') || key.startsWith('twilight')) localStorage.removeItem(key);
  }
}

async function loadProfile(authUser: AuthUser): Promise<User> {
  const { data, error } = await supabase.from('profiles')
    .select('role, full_name, avatar_url').eq('id', authUser.id)
    .abortSignal(AbortSignal.timeout(10000)).single();
  if (error) throw error;
  if (!data || !['user', 'partner', 'admin'].includes(data.role)) throw new Error('Your profile could not be verified. Please retry.');
  return {
    id: authUser.id, email: authUser.email || '',
    name: data.full_name || authUser.user_metadata?.full_name,
    avatar_url: data.avatar_url || undefined,
    role: data.role as User['role'], user_metadata: authUser.user_metadata,
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionVerified, setSessionVerified] = useState(false);
  const [profileRefreshed, setProfileRefreshed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveringPassword, setRecoveringPassword] = useState(false);
  const userIdRef = useRef<string | null>(null);
  const revisionRef = useRef(0);
  const mountedRef = useRef(false);

  const applySession = async (session: Session | null, revision: number) => {
    try {
      if (!session?.user) {
        clearPrivateCaches();
        if (mountedRef.current && revision === revisionRef.current) {
          userIdRef.current = null;
          setUser(null); setSessionVerified(true); setProfileRefreshed(true); setError(null);
        }
        return;
      }
      const profile = await loadProfile(session.user);
      if (!mountedRef.current || revision !== revisionRef.current) return;
      if (userIdRef.current && userIdRef.current !== profile.id) clearPrivateCaches();
      userIdRef.current = profile.id;
      localStorage.setItem('twilight-cached-user', JSON.stringify(profile));
      setUser(profile); setSessionVerified(true); setProfileRefreshed(true); setError(null);
      void registerPushNotifications(profile.id).catch(() => {});
    } catch (err) {
      if (mountedRef.current && revision === revisionRef.current) {
        setUser(null); setSessionVerified(false); setProfileRefreshed(false);
        setError(err instanceof Error ? err.message : 'Unable to verify your session. Please retry.');
      }
    } finally {
      if (mountedRef.current && revision === revisionRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setRecoveringPassword(true);
      if (event === 'TOKEN_REFRESHED' && userIdRef.current === session?.user.id) return;
      const revision = ++revisionRef.current;
      clearTimeout(timer);
      if (!session || userIdRef.current !== session.user.id) {
        setUser(null); setLoading(true); setSessionVerified(false); setProfileRefreshed(false);
      }
      // Return immediately so profile requests cannot deadlock the auth lock.
      timer = setTimeout(() => { void applySession(session, revision); }, 0);
    });
    return () => {
      mountedRef.current = false; revisionRef.current++;
      clearTimeout(timer); subscription.unsubscribe();
    };
  }, []);

  const refreshUser = async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    await applySession(data.session, ++revisionRef.current);
  };

  const signOut = async () => {
    await resetPushRegistration(userIdRef.current);
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    revisionRef.current++;
    clearPrivateCaches(); userIdRef.current = null;
    setUser(null); setLoading(false); setProfileRefreshed(true); setSessionVerified(true);
    setRecoveringPassword(false); setError(null);
  };

  return <AuthContext.Provider value={{ user, loading, sessionVerified, profileRefreshed, error,
    recoveringPassword, completePasswordRecovery: () => setRecoveringPassword(false), signOut, refreshUser }}>
    {children}
  </AuthContext.Provider>;
};
