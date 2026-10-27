// @vitest-environment jsdom
import React from 'react';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {MemoryRouter,useLocation} from 'react-router-dom';
const fixture=vi.hoisted(()=>({dismiss:vi.fn(),read:vi.fn(()=>new Promise<void>(()=>{}))}));
vi.mock('../hooks/useNotifications',()=>({useNotifications:()=>({arrival:{id:'invite',message:'Your partner invited you to Tic Tac Toe.',data:{url:'/games/tictactoe'}},dismissArrival:fixture.dismiss,markAsRead:fixture.read})}));
vi.mock('../contexts/AuthContext',()=>({useAuth:()=>({user:{id:'recipient',role:'partner'}})}));
vi.mock('../hooks/useAppMotion',()=>({useAppMotion:()=>({reduced:true})}));
import {GameInvitationBanner} from '../components/GameInvitationBanner';
function Path(){return <output>{useLocation().pathname}</output>;}
afterEach(cleanup);
it('joins the recipient role’s game immediately without waiting for the read receipt',()=>{
 render(<MemoryRouter initialEntries={['/partner/dashboard']}><GameInvitationBanner/><Path/></MemoryRouter>);
 fireEvent.click(screen.getByRole('button',{name:'Join game'}));
 expect(screen.getByText('/partner/games/tictactoe')).toBeTruthy();expect(fixture.read).toHaveBeenCalledWith('invite');expect(fixture.dismiss).toHaveBeenCalled();
});
