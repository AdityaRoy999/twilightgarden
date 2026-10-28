// @vitest-environment jsdom
import React from 'react';import {it,expect,vi,afterEach} from 'vitest';import {render,screen,cleanup} from '@testing-library/react';import {MemoryRouter} from 'react-router-dom';
const state=vi.hoisted(()=>({couple:null as any}));
vi.mock('../contexts/CouplesContext',()=>({useCouples:()=>({couple:state.couple,isSyncRequired:true,identityReady:true})}));
vi.mock('../components/SyncHistoryModal',()=>({SyncHistoryModal:()=> <div role="dialog">Restore device identity</div>}));
import {IdentityLockdownPrompt} from '../components/IdentityLockdownPrompt';afterEach(cleanup);
it('does not offer chat recovery after unlinking even if this device lacks its identity',()=>{state.couple=null;render(<MemoryRouter initialEntries={['/notes']}><IdentityLockdownPrompt/></MemoryRouter>);expect(screen.queryByText('Restore chats')).toBeNull();expect(screen.queryByRole('dialog')).toBeNull();});
it('retains identity recovery for an active relationship on a new device',async()=>{state.couple={status:'active'};render(<MemoryRouter initialEntries={['/partner/notes']}><IdentityLockdownPrompt/></MemoryRouter>);expect(await screen.findByRole('dialog')).toBeTruthy();});
