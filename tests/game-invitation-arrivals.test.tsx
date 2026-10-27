// @vitest-environment jsdom
import React from 'react';
import {act,cleanup,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const fixture=vi.hoisted(()=>({rows:[] as any[],listener:null as any,user:{id:'recipient',role:'partner'},native:vi.fn().mockResolvedValue(undefined)}));
vi.mock('../contexts/AuthContext',()=>({useAuth:()=>({user:fixture.user})}));
vi.mock('../contexts/CouplesContext',()=>({useCouples:()=>({partnerPubKey:null,keyVersion:1})}));
vi.mock('../lib/encryption',()=>({decryptData:vi.fn()}));
vi.mock('../lib/gameAlerts',()=>({presentNativeGameInvitation:fixture.native}));
vi.mock('../lib/supabase',()=>({supabase:{from:()=>({select(){return this;},eq(){return this;},order(){return this;},limit(){return this;},update(){return this;},then(resolve:any){return Promise.resolve({data:fixture.rows,count:fixture.rows.filter(n=>!n.is_read).length,error:null}).then(resolve);}}),channel:()=>({on(_kind:any,_filter:any,fn:any){fixture.listener=fn;return this;},subscribe(fn:any){fn('SUBSCRIBED');return this;}}),removeChannel:vi.fn()}}));
import {NotificationProvider,useNotifications} from '../contexts/NotificationContext';
function Probe(){const n=useNotifications();return <><p>{n.arrival?.message||'No new invitation'}</p><output>{n.unreadCount}</output></>;}
const note={id:'invite',user_id:'recipient',type:'game',message:'Play Tic Tac Toe',is_read:false,data:{url:'/games/tictactoe'}};
beforeEach(()=>{fixture.rows=[];fixture.user={id:'recipient',role:'partner'};fixture.native.mockClear();});afterEach(cleanup);
it('loads unread history without replaying alerts',async()=>{fixture.rows=[note];render(<NotificationProvider><Probe/></NotificationProvider>);await waitFor(()=>expect(screen.getByText('1')).toBeTruthy());expect(screen.getByText('No new invitation')).toBeTruthy();expect(fixture.native).not.toHaveBeenCalled();});
it('announces a new game once and ignores duplicate events and read updates',async()=>{render(<NotificationProvider><Probe/></NotificationProvider>);await act(async()=>fixture.listener({eventType:'INSERT',new:note}));expect(screen.getByText('Play Tic Tac Toe')).toBeTruthy();await act(async()=>{fixture.listener({eventType:'INSERT',new:note});fixture.listener({eventType:'UPDATE',new:note});});expect(fixture.native).toHaveBeenCalledTimes(1);});
it('ignores another account and a late callback after account switching',async()=>{const view=render(<NotificationProvider><Probe/></NotificationProvider>);const previous=fixture.listener;fixture.user={id:'different-account',role:'partner'};view.rerender(<NotificationProvider><Probe/></NotificationProvider>);await act(async()=>{previous({eventType:'INSERT',new:note});fixture.listener({eventType:'INSERT',new:note});});expect(screen.getByText('No new invitation')).toBeTruthy();expect(fixture.native).not.toHaveBeenCalled();});
