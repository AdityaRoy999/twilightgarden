import {SecurePreferences as Preferences} from '../lib/securePreferences';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Session, User as AuthUser } from '@supabase/supabase-js';
import { supabase, rawSupabase } from '../lib/supabase';
import {optionalVault,installVault} from '../lib/vaultRuntime';
import {readPrivateRows} from '../lib/privateData';
import { User } from '../types';
import { resetPushRegistration } from '../lib/notifications';
import { clearEncryptionCache } from '../lib/encryption';
import {withinDeadline,requestError,retryTransientRead} from '../lib/requestTimeout';

interface AuthContextType {
  user: User | null;
  dataEpoch: string | null;
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
  installVault(null);
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith('tw_') || key.startsWith('twilight')) localStorage.removeItem(key);
  }
}

async function loadProfile(authUser: AuthUser, signal: AbortSignal): Promise<User> {
  let { data, error } = await rawSupabase.from('profiles')
    .select('role, full_name, avatar_url').eq('id', authUser.id)
    .abortSignal(signal).single();
  if(error?.code==='PGRST116'){
    const result=await supabase.rpc('ensure_own_profile').abortSignal(signal);data=result.data;error=result.error;
  }
  if (error) throw error;
  if (!data || !['user', 'partner', 'admin'].includes(data.role)) throw new Error('Your profile could not be verified. Please retry.');
  const privateProfile=optionalVault()?.userId===authUser.id?(await readPrivateRows(authUser.id,'profile'))[0]:null;
  return {
    id: authUser.id, email: authUser.email || '',
    name: privateProfile?.full_name || undefined,
    avatar_url: privateProfile?.avatar_url || undefined,
    role: data.role as User['role'], user_metadata: authUser.user_metadata,
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dataEpoch,setDataEpoch]=useState<string|null>(null);
  const epochRef=useRef<string|null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionVerified, setSessionVerified] = useState(false);
  const [profileRefreshed, setProfileRefreshed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveringPassword, setRecoveringPassword] = useState(false);
  const userIdRef = useRef<string | null>(null);
  const revisionRef = useRef(0);
  const mountedRef = useRef(false);

  const verificationRef = useRef<AbortController|null>(null);
  const pendingRef = useRef<Promise<void>|null>(null);
  const errorRef = useRef(error); errorRef.current = error;

  const applySession = async (session: Session | null, revision: number, signal: AbortSignal) => {
      const current=()=>mountedRef.current && revision===revisionRef.current && !signal.aborted;
      if (!current()) return;
      if (!session?.user) {
        clearPrivateCaches(); userIdRef.current=null;
        setDataEpoch(null); epochRef.current=null;
        setUser(null); setSessionVerified(true); setProfileRefreshed(true); setError(null);
        return;
      }
      // Independent reads run together; neither may hold startup indefinitely.
      const [epoch,profile]=await Promise.all([
        retryTransientRead(async()=>{
          const result=await supabase.rpc('get_data_epoch').abortSignal(signal);
          if(result.error)throw result.error;
          if(typeof result.data!=='string'||!result.data)throw new Error('Application data could not be verified. Please retry.');
          return result.data;
        },signal),
        retryTransientRead(()=>loadProfile(session.user,signal),signal)
      ]);
      if (!current()) return;
      const marker='app-dataset-epoch:'+session.user.id;
      if(localStorage.getItem(marker)!==epoch){
        clearPrivateCaches();
        await Promise.all([Preferences.remove({key:session.user.id+'_private_key'}),Preferences.remove({key:session.user.id+'_public_key'}),Preferences.remove({key:session.user.id+'_chat_identity_generation'}),Preferences.remove({key:session.user.id+'_chat_vault_scope'})]);
        if(!current())return;
        localStorage.setItem(marker,epoch);
      }
      if (userIdRef.current && userIdRef.current !== profile.id) clearPrivateCaches();
      userIdRef.current=profile.id; epochRef.current=epoch;
      setDataEpoch(epoch);
      localStorage.setItem('twilight-cached-user',JSON.stringify({id:profile.id,role:profile.role}));
      setUser(profile); setSessionVerified(true); setProfileRefreshed(true); setError(null);

  };

  const verifySession = useCallback((resolve:()=>Promise<Session|null>, background=false) => {
    verificationRef.current?.abort();
    const controller=new AbortController(); verificationRef.current=controller;
    const revision=++revisionRef.current;
    setError(null); setLoading(!background);
    const job=(async()=>{
      try {
        await withinDeadline(async signal=>{
          const session=await resolve(); signal.throwIfAborted();
          await applySession(session,revision,signal);
        },15000,'Checking your session took too long. Check your connection and retry.',controller.signal);
      } catch(err) {
        if(mountedRef.current && revision===revisionRef.current && !controller.signal.aborted){
          setUser(null); userIdRef.current=null;
          setSessionVerified(false); setProfileRefreshed(false);
          setError(requestError(err,'Unable to verify your session. Please retry.'));
        }
      } finally {
        if(mountedRef.current && revision===revisionRef.current){setLoading(false);pendingRef.current=null;}
      }
    })();
    pendingRef.current=job; return job;
  },[]);

  const refreshUser = useCallback(() => verifySession(async()=>{
    const {data,error}=await supabase.auth.getSession();
    if(error)throw error;
    return data.session;
  }),[verifySession]);

  useEffect(() => {
    mountedRef.current=true;
    let timer:ReturnType<typeof setTimeout>|undefined;
    // INITIAL_SESSION may itself wait on storage/token refresh before any callback.
    const initialRevision=revisionRef.current;
    const startupTimer=setTimeout(()=>{
      if(mountedRef.current && revisionRef.current===initialRevision)void refreshUser();
    },12000);
    const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{
      clearTimeout(startupTimer);
      if(event==='PASSWORD_RECOVERY')setRecoveringPassword(true);
      if(event==='TOKEN_REFRESHED'&&userIdRef.current===session?.user.id&&!errorRef.current)return;
      clearTimeout(timer);
      // Never await a Supabase call while inside the auth callback/lock.
      verificationRef.current?.abort(); revisionRef.current++;
      if(!session||userIdRef.current!==session.user.id){setUser(null);setLoading(true);setSessionVerified(false);setProfileRefreshed(false);}
      timer=setTimeout(()=>{void verifySession(async()=>session,!!session&&session.user.id===userIdRef.current&&!errorRef.current);},0);
    });
    const recover=()=>{if(errorRef.current&&!pendingRef.current&&document.visibilityState==='visible')void refreshUser();};
    window.addEventListener('online',recover);window.addEventListener('focus',recover);
    return()=>{
      mountedRef.current=false;revisionRef.current++;verificationRef.current?.abort();pendingRef.current=null;
      clearTimeout(timer);clearTimeout(startupTimer);subscription.unsubscribe();
      window.removeEventListener('online',recover);window.removeEventListener('focus',recover);
    };
  },[verifySession,refreshUser]);

  useEffect(()=>{
    if(!user?.id)return;
    const check=()=>{void supabase.rpc('get_data_epoch').then(({data,error})=>{if(!error&&data!==epochRef.current)void signOut().catch(()=>{clearPrivateCaches();setUser(null);setError('The application data was reset. Please sign in again.');});});};
    const channel=supabase.channel('dataset-reset').on('postgres_changes',{event:'UPDATE',schema:'public',table:'app_dataset'},check).subscribe();
    const timer=setInterval(check,60000);
    window.addEventListener('focus',check);window.addEventListener('online',check);
    return()=>{clearInterval(timer);window.removeEventListener('focus',check);window.removeEventListener('online',check);void supabase.removeChannel(channel);};
  },[user?.id]);

  const signOut = async () => {
    await resetPushRegistration(userIdRef.current);
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    revisionRef.current++; verificationRef.current?.abort();
    clearPrivateCaches(); userIdRef.current = null;
    setUser(null); setLoading(false); setProfileRefreshed(true); setSessionVerified(true);
    setRecoveringPassword(false); setError(null);
  };

  return <AuthContext.Provider value={{ user, dataEpoch, loading, sessionVerified, profileRefreshed, error,
    recoveringPassword, completePasswordRecovery: () => setRecoveringPassword(false), signOut, refreshUser }}>
    {children}
  </AuthContext.Provider>;
};
