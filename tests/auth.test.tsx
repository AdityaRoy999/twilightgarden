// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({listener:null as null|((event:string,session:unknown)=>void),profile:vi.fn(),register:vi.fn(),epoch:vi.fn(),getSession:vi.fn()}));
vi.mock('../lib/securePreferences',()=>({SecurePreferences:{remove:vi.fn().mockResolvedValue(undefined)}}));
vi.mock('../lib/supabase',()=>{const client={rpc:()=>({abortSignal:()=>mocks.epoch()}),channel:()=>({on(){return this;},subscribe(){return this;}}),removeChannel:vi.fn(),auth:{getSession:mocks.getSession,onAuthStateChange:(listener:typeof mocks.listener)=>{mocks.listener=listener;return {data:{subscription:{unsubscribe:vi.fn()}}};}},from:()=>({select:()=>({eq:()=>({abortSignal:()=>({single:mocks.profile})})})})};return {supabase:client,rawSupabase:client};});
vi.mock('../lib/notifications',()=>({registerPushNotifications:mocks.register,resetPushRegistration:vi.fn()}));
vi.mock('../lib/encryption',()=>({clearEncryptionCache:vi.fn()}));
vi.mock('../lib/privateData',()=>({readPrivateRows:vi.fn().mockResolvedValue([])}));
import { AuthProvider,useAuth } from '../contexts/AuthContext';
const session=(id:string)=>({user:{id,email:'synthetic@example.invalid',user_metadata:{role:'admin',is_partner:true}}});
function Probe(){const a=useAuth();return <><button onClick={()=>void a.refreshUser()}>Retry</button><b>{a.loading?'checking':'idle'}</b><p>{a.user?.id||'signed-out'}|{a.user?.role}|{a.sessionVerified?'verified':'unverified'}|{a.error}</p></>;}
beforeEach(()=>{localStorage.clear();mocks.profile.mockReset();mocks.epoch.mockReset().mockResolvedValue({data:'epoch-test',error:null});mocks.getSession.mockReset().mockResolvedValue({data:{session:session('A')},error:null});mocks.register.mockResolvedValue(undefined);});
afterEach(()=>{cleanup();vi.useRealTimers();});
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

it('shows structured service errors and clears the error while Retry verifies again',async()=>{
 mocks.profile.mockResolvedValue({data:{role:'user',full_name:'QA'},error:null});
 mocks.epoch.mockResolvedValueOnce({data:null,error:{message:'Please retry verification',code:'test'}});
 render(<AuthProvider><Probe/></AuthProvider>);act(()=>mocks.listener?.('INITIAL_SESSION',session('A')));
 await waitFor(()=>expect(screen.getByText(/Please retry verification/)).toBeTruthy());
 let finish!:(value:unknown)=>void;mocks.epoch.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
 await act(async()=>{screen.getByRole('button',{name:'Retry'}).click();});
 expect(screen.getByText('checking')).toBeTruthy();expect(screen.queryByText(/Please retry verification/)).toBeNull();
 await act(async()=>finish({data:'epoch-test',error:null}));
 expect(screen.getByText('A|user|verified|')).toBeTruthy();
});
it('bounds a hung verification, ignores late results, and permits a fresh retry',async()=>{
 vi.useFakeTimers();let finish!:(value:unknown)=>void;
 mocks.profile.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;})).mockResolvedValue({data:{role:'user',full_name:'QA'},error:null});
 render(<AuthProvider><Probe/></AuthProvider>);act(()=>mocks.listener?.('INITIAL_SESSION',session('A')));
 await act(async()=>{await vi.advanceTimersByTimeAsync(0);await vi.advanceTimersByTimeAsync(15001);});
 expect(screen.getByText(/Checking your session took too long/)).toBeTruthy();expect(screen.getByText('idle')).toBeTruthy();
 await act(async()=>finish({data:{role:'admin',full_name:'Late'},error:null}));
 expect(screen.queryByText('A|admin|verified|')).toBeNull();
 await act(async()=>screen.getByRole('button',{name:'Retry'}).click());
 expect(screen.getByText('A|user|verified|')).toBeTruthy();
});
it('recovers when INITIAL_SESSION never arrives and retries a transient epoch failure once',async()=>{
 vi.useFakeTimers();mocks.profile.mockResolvedValue({data:{role:'partner',full_name:'QA'},error:null});
 mocks.epoch.mockResolvedValueOnce({data:null,error:{message:'Network fetch failed',status:503}}).mockResolvedValue({data:'epoch-test',error:null});
 render(<AuthProvider><Probe/></AuthProvider>);
 await act(async()=>{await vi.advanceTimersByTimeAsync(12201);});
 expect(screen.getByText('A|partner|verified|')).toBeTruthy();expect(mocks.epoch).toHaveBeenCalledTimes(2);
});

it('verifies a repeated same-account sign-in without blanking the current screen',async()=>{
 mocks.profile.mockResolvedValue({data:{role:'user',full_name:'QA'},error:null});
 render(<AuthProvider><Probe/></AuthProvider>);act(()=>mocks.listener?.('INITIAL_SESSION',session('A')));
 await waitFor(()=>expect(screen.getByText('A|user|verified|')).toBeTruthy());
 mocks.profile.mockImplementationOnce(()=>new Promise(()=>{}));
 act(()=>mocks.listener?.('SIGNED_IN',session('A')));
 await act(async()=>{await new Promise(resolve=>setTimeout(resolve,10));});
 expect(screen.getByText('idle')).toBeTruthy();expect(screen.getByText('A|user|verified|')).toBeTruthy();
});
