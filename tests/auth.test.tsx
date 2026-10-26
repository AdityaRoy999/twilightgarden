// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({listener:null as null|((event:string,session:unknown)=>void),profile:vi.fn(),register:vi.fn()}));
vi.mock('@capacitor/preferences',()=>({Preferences:{remove:vi.fn().mockResolvedValue(undefined)}}));
vi.mock('../lib/supabase',()=>({supabase:{rpc:vi.fn().mockResolvedValue({data:'epoch-test',error:null}),channel:()=>({on(){return this;},subscribe(){return this;}}),removeChannel:vi.fn(),auth:{onAuthStateChange:(listener:typeof mocks.listener)=>{mocks.listener=listener;return {data:{subscription:{unsubscribe:vi.fn()}}};}},from:()=>({select:()=>({eq:()=>({abortSignal:()=>({single:mocks.profile})})})})}}));
vi.mock('../lib/notifications',()=>({registerPushNotifications:mocks.register,resetPushRegistration:vi.fn()}));
vi.mock('../lib/encryption',()=>({clearEncryptionCache:vi.fn()}));
import { AuthProvider,useAuth } from '../contexts/AuthContext';
const session=(id:string)=>({user:{id,email:'synthetic@example.invalid',user_metadata:{role:'admin',is_partner:true}}});
function Probe(){const a=useAuth();return <p>{a.user?.id||'signed-out'}|{a.user?.role}|{a.sessionVerified?'verified':'unverified'}|{a.error}</p>;}
beforeEach(()=>{localStorage.clear();mocks.profile.mockReset();mocks.register.mockResolvedValue(undefined);});
afterEach(()=>cleanup());
describe('verified authentication state',()=>{
 it('uses the database role instead of editable signup metadata',async()=>{
  mocks.profile.mockResolvedValue({data:{role:'user',full_name:'QA',avatar_url:null},error:null});
  localStorage.setItem('twilight-cached-user',JSON.stringify({id:'forged',role:'admin'}));
  render(<AuthProvider><Probe/></AuthProvider>);
  expect(screen.getByText(/signed-out\|\|unverified/)).toBeTruthy();
  act(()=>mocks.listener?.('INITIAL_SESSION',session('A')));
  await waitFor(()=>expect(screen.getByText('A|user|verified|')).toBeTruthy());
 });
 it('fails closed when the authoritative profile cannot be read',async()=>{
  mocks.profile.mockResolvedValue({data:null,error:new Error('Profile unavailable')});
  render(<AuthProvider><Probe/></AuthProvider>);act(()=>mocks.listener?.('INITIAL_SESSION',session('A')));
  await waitFor(()=>expect(screen.getByText(/signed-out\|\|unverified\|Profile unavailable/)).toBeTruthy());
 });
 it('ignores an old account profile response after account switching',async()=>{
  let resolveA!:(value:unknown)=>void;
  mocks.profile.mockImplementationOnce(()=>new Promise(r=>{resolveA=r;})).mockResolvedValue({data:{role:'partner',full_name:'QA B'},error:null});
  render(<AuthProvider><Probe/></AuthProvider>);act(()=>mocks.listener?.('INITIAL_SESSION',session('A')));
  await waitFor(()=>expect(mocks.profile).toHaveBeenCalledTimes(1));
  act(()=>mocks.listener?.('SIGNED_IN',session('B')));
  await waitFor(()=>expect(screen.getByText('B|partner|verified|')).toBeTruthy());
  await act(async()=>resolveA({data:{role:'admin',full_name:'Stale A'},error:null}));
  expect(screen.getByText('B|partner|verified|')).toBeTruthy();
  act(()=>mocks.listener?.('SIGNED_OUT',null));
  await waitFor(()=>expect(screen.getByText('signed-out||verified|')).toBeTruthy());
  expect(localStorage.getItem('twilight-cached-user')).toBeNull();
 });
});
