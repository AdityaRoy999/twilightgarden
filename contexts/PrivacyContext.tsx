import React, {createContext, useCallback, useContext, useEffect, useState} from 'react';
import {useAuth} from './AuthContext';
import {supabase} from '../lib/supabase';
import {clearHealthSnapshots, type PrivacyPreferences} from '../lib/privacy';

type Value={preferences:PrivacyPreferences|null;loading:boolean;error:string;refresh:()=>Promise<void>;save:(p:PrivacyPreferences)=>Promise<void>};
const Context=createContext<Value|null>(null);
export function PrivacyProvider({children}:{children:React.ReactNode}) {
 const {user}=useAuth(); const [preferences,setPreferences]=useState<PrivacyPreferences|null>(null);
 const [loading,setLoading]=useState(true),[error,setError]=useState('');
 const refresh=useCallback(async()=>{
  if(!user){setPreferences(null);setLoading(false);return;}
  setError('');
  const {data,error:failure}=await supabase.from('privacy_preferences').select('*').eq('user_id',user.id).maybeSingle();
  if(failure) setError('Your privacy choices could not be loaded. Please retry.');
  else setPreferences(data as PrivacyPreferences|null);
  setLoading(false);
 },[user?.id]);
 useEffect(()=>{clearHealthSnapshots(localStorage);void refresh();},[refresh]);
 useEffect(()=>{
  const resume=()=>{if(document.visibilityState==='visible')void refresh();};
  document.addEventListener('visibilitychange',resume);return()=>document.removeEventListener('visibilitychange',resume);
 },[refresh]);
 const save=useCallback(async(p:PrivacyPreferences)=>{
  const {error:failure}=await supabase.rpc('save_privacy_preferences',{p_age:p.age_band,p_core:p.core_consent,p_health:p.health_consent,p_share:p.share_health,p_ai:p.ai_consent,p_shopping:p.shopping_consent});
  if(failure)throw new Error('Your choices could not be saved. If you need to correct an age band, send an age-review request.');
  clearHealthSnapshots(localStorage);await refresh();
 },[refresh]);
 return <Context.Provider value={{preferences,loading,error,refresh,save}}>{children}</Context.Provider>;
}
export function usePrivacy(){const value=useContext(Context);if(!value)throw new Error('PrivacyProvider missing');return value;}
