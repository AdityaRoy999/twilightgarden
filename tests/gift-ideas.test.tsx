// @vitest-environment jsdom
import React,{StrictMode} from 'react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {render,screen,cleanup,waitFor,act,fireEvent} from '@testing-library/react';
const mocks=vi.hoisted(()=>({generate:vi.fn(),search:vi.fn()}));
vi.mock('../lib/wellnessAI',()=>({generateGiftRecommendations:mocks.generate,searchShoppingProducts:mocks.search}));
vi.mock('../contexts/AuthContext',()=>({useAuth:()=>({user:{id:'gift-user'}})}));
vi.mock('../hooks/useAppMotion',()=>({useAppMotion:()=>({reduced:true})}));
vi.mock('../components/wellness/WellnessIllustration',()=>({WellnessIllustration:()=> <span/>}));
import {GiftIdeas} from '../components/wellness/GiftIdeas';
const context={phase:'Menstrual',cycleDay:2,moods:[],symptoms:[],observedDays:1};
const product=(title:string)=>({title,link:`https://example.invalid/${title}`,image:'',source:'Amazon'});
beforeEach(()=>{mocks.generate.mockReset();mocks.search.mockReset();});
afterEach(cleanup);
it('deduplicates the StrictMode mount request and permits explicit retry after a provider error',async()=>{
 mocks.generate.mockResolvedValueOnce({text:'',error:'Provider unavailable'}).mockResolvedValue({text:'a comfort gift'});mocks.search.mockResolvedValue([product('A retailer result')]);
 render(<StrictMode><GiftIdeas context={context} partnerName="Partner"/></StrictMode>);
 await screen.findByRole('alert');expect(mocks.generate).toHaveBeenCalledTimes(1);
 fireEvent.click(screen.getByRole('button',{name:'Try again'}));await screen.findByText('A retailer result');
 expect(mocks.generate).toHaveBeenCalledTimes(2);expect(mocks.search).toHaveBeenCalledWith('a comfort gift','gift-user');
});
it('ignores products from a superseded partner context',async()=>{
 let finishOld!:(result:unknown)=>void;
 mocks.generate.mockImplementationOnce(()=>new Promise(resolve=>{finishOld=resolve;})).mockResolvedValue({text:'new query'});
 mocks.search.mockImplementation(async(query:string)=>[product(query==='new query'?'New context gift':'Old context gift')]);
 const view=render(<GiftIdeas context={context} partnerName="Partner"/>);
 await waitFor(()=>expect(mocks.generate).toHaveBeenCalledTimes(1));
 view.rerender(<GiftIdeas context={{...context,cycleDay:3}} partnerName="Partner"/>);
 await screen.findByText('New context gift');
 await act(async()=>finishOld({text:'old query'}));
 expect(screen.queryByText('Old context gift')).toBeNull();expect(screen.getByText('New context gift')).toBeTruthy();
});
