// @vitest-environment jsdom
import React from 'react';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {MemoryRouter,Route,Routes} from 'react-router-dom';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({updateSettings:vi.fn()}));
vi.mock('../contexts/DataContext',()=>({useData:()=>({updateSettings:mocks.updateSettings})}));
vi.mock('../contexts/AuthContext',()=>({useAuth:()=>({user:{role:'user'}})}));
vi.mock('../hooks/useToday',()=>({useToday:()=> '2026-10-26'}));
vi.mock('framer-motion',()=>({AnimatePresence:({children}:{children:React.ReactNode})=><>{children}</>,motion:{div:({children}:{children:React.ReactNode})=><div>{children}</div>}}));
import Onboarding from '../pages/Onboarding';
const show=()=>render(<MemoryRouter initialEntries={['/onboarding']}><Routes><Route path="/onboarding" element={<Onboarding/>}/><Route path="/" element={<p>Setup complete</p>}/></Routes></MemoryRouter>);
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-26T12:00:00Z'));mocks.updateSettings.mockReset().mockResolvedValue(undefined);});
afterEach(()=>{cleanup();vi.useRealTimers();});
describe('onboarding period dates',()=>{
 it('disables future period starts and future months',()=>{show();fireEvent.click(screen.getByRole('button',{name:"Let's Start"}));expect((screen.getByRole('button',{name:'2026-10-27'}) as HTMLButtonElement).disabled).toBe(true);expect((screen.getByRole('button',{name:'2026-10-26'}) as HTMLButtonElement).disabled).toBe(false);expect((screen.getByRole('button',{name:'Next month'}) as HTMLButtonElement).disabled).toBe(true);fireEvent.click(screen.getByRole('button',{name:'Previous month'}));expect((screen.getByRole('button',{name:'2026-09-30'}) as HTMLButtonElement).disabled).toBe(false);expect((screen.getByRole('button',{name:'Next month'}) as HTMLButtonElement).disabled).toBe(false);expect(mocks.updateSettings).not.toHaveBeenCalled();});
 it('completes onboarding with today and the selected cycle lengths',async()=>{show();fireEvent.click(screen.getByRole('button',{name:"Let's Start"}));fireEvent.click(screen.getByRole('button',{name:'2026-10-26'}));fireEvent.click(screen.getByRole('button',{name:'Continue'}));fireEvent.click(screen.getByRole('button',{name:'Continue'}));await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Finish Setup'}));});expect(mocks.updateSettings).toHaveBeenCalledWith({avgCycleLength:28,avgPeriodLength:5,lastPeriodStart:'2026-10-26',onboardingCompleted:true});expect(screen.getByText('Setup complete')).toBeTruthy();});
});
