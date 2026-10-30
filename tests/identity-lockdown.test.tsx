// @vitest-environment jsdom
import React from 'react';import {it,expect,vi,afterEach} from 'vitest';import {render,screen,cleanup} from '@testing-library/react';import {MemoryRouter} from 'react-router-dom';
const state=vi.hoisted(()=>({couple:null as any,restore:true,backup:true}));
vi.mock('../contexts/CouplesContext',()=>({useCouples:()=>({couple:state.couple,isSyncRequired:state.restore,identityReady:true,hasCloudBackup:state.backup})}));
vi.mock('../components/SyncHistoryModal',()=>({SyncHistoryModal:({onClose}:any)=> <div role="dialog">{state.restore?'Restore device identity':'Set backup password'}<button onClick={onClose}>Close</button></div>}));
import {IdentityLockdownPrompt} from '../components/IdentityLockdownPrompt';afterEach(cleanup);
it('does not offer chat recovery after unlinking even if this device lacks its identity',()=>{state.couple=null;render(<MemoryRouter initialEntries={['/notes']}><IdentityLockdownPrompt/></MemoryRouter>);expect(screen.queryByText('Restore chats')).toBeNull();expect(screen.queryByRole('dialog')).toBeNull();});
it('retains identity recovery for an active relationship on a new device',async()=>{state.couple={status:'active'};render(<MemoryRouter initialEntries={['/partner/notes']}><IdentityLockdownPrompt/></MemoryRouter>);expect(await screen.findByRole('dialog')).toBeTruthy();});
it('does not ask for a second password on a fresh connection',async()=>{state.couple={id:'fresh',status:'active'};state.restore=false;state.backup=false;render(<MemoryRouter initialEntries={['/partner/notes']}><IdentityLockdownPrompt/></MemoryRouter>);expect(screen.queryByRole('dialog')).toBeNull();});
it('does not show recovery or setup if the identity and backup are already ready',()=>{state.couple={id:'existing',status:'active'};state.restore=false;state.backup=true;render(<MemoryRouter initialEntries={['/notes']}><IdentityLockdownPrompt/></MemoryRouter>);expect(screen.queryByRole('dialog')).toBeNull();});
