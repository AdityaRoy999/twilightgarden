// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ChatDetails } from '../components/ChatDetails';
import { loadCallHistory } from '../lib/callHistory';
import { saveChatSettings } from '../lib/chatSettings';
const fixture = vi.hoisted(() => ({ navigate:vi.fn(), initiateCall:vi.fn(), loadOlderNotes:vi.fn(), subscribe:vi.fn(), notes:[
  {id:'one',sender_id:'owner',type:'text',content:'A lovely afternoon',created_at:'2026-11-07T10:00:00Z',starred_by:['owner']},
  {id:'two',sender_id:'partner',type:'text',content:'Visit https://example.com',created_at:'2026-11-07T10:10:00Z'},
  {id:'hidden',sender_id:'owner',type:'text',content:'hidden',created_at:'2026-11-07T10:00:00Z',deleted_by:['owner']},
] }));
vi.mock('react-router-dom',()=>({useNavigate:()=>fixture.navigate}));
vi.mock('../contexts/AuthContext',()=>({useAuth:()=>({user:{id:'owner',role:'partner'}})}));
vi.mock('../contexts/CouplesContext',()=>({useCouples:()=>({couple:{id:'pair'},partnerProfile:{full_name:'Alex'},notes:fixture.notes,partnerPubKey:'test',hasMoreNotes:true,loadingOlder:false,loadOlderNotes:fixture.loadOlderNotes})}));
vi.mock('../contexts/CallContext',()=>({useCall:()=>({initiateCall:fixture.initiateCall})}));
vi.mock('../hooks/useAppMotion',()=>({useAppMotion:()=>({reduced:true})}));
vi.mock('../hooks/useDialogFocus',()=>({useDialogFocus:()=>{}}));
vi.mock('../components/SecureMedia',()=>({SecureImage:()=>null,SecureAudio:()=>null}));
vi.mock('../lib/callHistory',()=>({loadCallHistory:vi.fn(),callDuration:(seconds:number)=>`${seconds} seconds`}));
vi.mock('../lib/chatSettings',()=>({chatThemes:['garden','mint'],loadChatSettings:vi.fn().mockResolvedValue({theme:'garden'}),saveChatSettings:vi.fn().mockResolvedValue(undefined)}));
vi.mock('../lib/privateData',()=>({invalidatePrivateRecords:vi.fn()}));
vi.mock('../lib/supabase',()=>({rawSupabase:{channel:()=>({on:()=>({subscribe:fixture.subscribe})}),removeChannel:vi.fn()}}));
beforeEach(()=> { vi.mocked(loadCallHistory).mockResolvedValue([]); });
afterEach(()=>{cleanup();vi.clearAllMocks();});
const show = () => { const actions={onClose:vi.fn(),verify:vi.fn(),disconnect:vi.fn()}; render(<ChatDetails open {...actions}/>); return actions; };
it('starts a call from connection details and closes the sheet',()=>{
  const actions=show();fireEvent.click(screen.getByRole('button',{name:'Video call'}));
  expect(fixture.initiateCall).toHaveBeenCalledWith(true);expect(actions.onClose).toHaveBeenCalledOnce();
});
it('searches loaded history without surfacing locally deleted messages',()=>{
  show();fireEvent.click(screen.getByRole('button',{name:'Search'}));
  fireEvent.change(screen.getByLabelText('Search messages'),{target:{value:'afternoon'}});
  expect(screen.getByText('A lovely afternoon')).toBeTruthy();expect(screen.queryByText('hidden')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Load earlier messages'}));expect(fixture.loadOlderNotes).toHaveBeenCalledOnce();
});
it('shows real dates, outcomes and durations in call history and supports calling back',async()=>{
  vi.mocked(loadCallHistory).mockResolvedValue([{id:'call',coupleId:'pair',direction:'incoming',video:false,startedAt:'2026-11-07T10:00:00Z',endedAt:'2026-11-07T10:01:00Z',outcome:'answered',durationSeconds:60}]);
  show();fireEvent.click(screen.getByRole('button',{name:/Call history/}));
  await screen.findByText('60 seconds');expect(screen.getByText('Incoming voice call')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Return voice call'}));expect(fixture.initiateCall).toHaveBeenCalledWith(false);
});
it('persists a selected theme and reports loading failures honestly',async()=>{
  show();fireEvent.click(screen.getByRole('button',{name:/Chat theme/}));
  fireEvent.click(screen.getByRole('button',{name:'mint'}));
  await waitFor(()=>expect(saveChatSettings).toHaveBeenCalledWith({coupleId:'pair',theme:'mint',muted:false}));
  await waitFor(()=>expect(screen.getByRole('button',{name:'mint'}).getAttribute('aria-pressed')).toBe('true'));
  fireEvent.click(screen.getByRole('button',{name:'Back to chat details'}));
  vi.mocked(loadCallHistory).mockRejectedValue(new Error('offline'));
  fireEvent.click(screen.getByRole('button',{name:/Call history/}));await screen.findByRole('alert');
  expect(screen.queryByText('Your calls will appear here.')).toBeNull();
});
it('routes the carer to the correct profile and privacy settings',()=>{
  show();fireEvent.click(screen.getByRole('button',{name:/Backup and privacy/}));expect(fixture.navigate).toHaveBeenCalledWith('/partner/profile');
});
