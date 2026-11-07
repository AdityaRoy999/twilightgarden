import { describe, expect, it } from 'vitest';
import { finishCall, callDuration } from '../lib/callHistory';
import { previewPosition } from '../lib/callDock';
import { sharedDisplayPoint, validRemoteInput } from '../lib/remoteControl';
import { signCallRoomToken } from '../supabase/functions/_shared/call-room-token';
describe('call history', () => {
  const base = { id:'call',coupleId:'couple',ownerId:'owner',direction:'incoming' as const,video:true,startedAt:'2026-11-07T10:00:00Z' };
  it('records a missed incoming call without inventing duration', () => {
    expect(finishCall(base, undefined, Date.parse('2026-11-07T10:00:45Z'))).toMatchObject({outcome:'missed',durationSeconds:0});
    expect(finishCall(base)).not.toHaveProperty('ownerId');
  });
  it('measures answered duration and preserves explicit unanswered outcomes', () => {
    expect(finishCall({...base,answeredAt:'2026-11-07T10:00:10Z'},undefined,Date.parse('2026-11-07T10:01:20Z'))).toMatchObject({outcome:'answered',durationSeconds:70});
    expect(finishCall(base,'declined').outcome).toBe('declined');
    expect(finishCall({...base,direction:'outgoing'}).outcome).toBe('cancelled');
    expect(callDuration(125)).toBe('2:05');
  });
});
describe('preview edge docking', () => {
  it('docks on either edge, clamps vertical travel and restores inside the viewport', () => {
    expect(previewPosition(-80,900,390,760,120,160,true)).toEqual({x:-128,y:600,side:'left'});
    expect(previewPosition(340,-10,390,760,120,160,true)).toEqual({x:398,y:0,side:'right'});
    expect(previewPosition(340,100,390,760,120,160,false)).toEqual({x:270,y:100,side:null});
  });
});
describe('remote input boundary', () => {
  it('rejects invalid coordinates, control characters, shortcuts and unbounded payloads', () => {
    for (const value of [{kind:'move',x:NaN,y:0},{kind:'move',x:-1,y:0},{kind:'move',x:1,y:2},{kind:'text',text:'\n'},{kind:'text',text:'x'.repeat(33)},{kind:'key',key:'Meta'},{kind:'scroll',delta:99},{kind:'shell',command:'anything'}]) expect(validRemoteInput(value)).toBe(false);
    expect(validRemoteInput({kind:'move',x:.5,y:.5})).toBe(true);
    expect(validRemoteInput({kind:'text',text:'hello'})).toBe(true);
    expect(validRemoteInput({kind:'click'})).toBe(false);
    expect(validRemoteInput({kind:'click',x:.2,y:.6})).toBe(true);
  });
  it('ignores letterboxing and maps the actual display center correctly', () => {
    const rect = {left:10,top:20,width:400,height:800};
    expect(sharedDisplayPoint(210,420,rect,1920,1080)).toEqual({x:.5,y:.5});
    expect(sharedDisplayPoint(210,40,rect,1920,1080)).toBeNull();
    expect(sharedDisplayPoint(210,420,rect,0,0)).toBeNull();
  });
});
describe('media token', () => {
  it('grants only a short-lived room membership and never carries the media key', async () => {
    const jwt = await signCallRoomToken('api','server-test-secret','owner','room',1000);
    const [header,body,signature] = jwt.split('.');
    const payload = JSON.parse(atob(body.replace(/-/g,'+').replace(/_/g,'/')));
    expect(payload).toMatchObject({sub:'owner',exp:1600,video:{room:'room',roomJoin:true,canPublishData:false},roomConfig:{maxParticipants:2}});
    expect(payload).not.toHaveProperty('key'); expect(payload.video).not.toHaveProperty('roomAdmin');
    const key = await crypto.subtle.importKey('raw',new TextEncoder().encode('server-test-secret'),{name:'HMAC',hash:'SHA-256'},false,['verify']);
    expect(await crypto.subtle.verify('HMAC',key,Uint8Array.from(atob(signature.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0)),new TextEncoder().encode(`${header}.${body}`))).toBe(true);
  });
});
