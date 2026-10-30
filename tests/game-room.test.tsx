// @vitest-environment jsdom
import React from 'react';import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {initialGame} from '../supabase/functions/_shared/gameEngine';
const fixture=vi.hoisted(()=>({value:null as any,action:vi.fn().mockResolvedValue(true)}));
vi.mock('../hooks/useGameRoom',()=>({useGameRoom:()=>fixture.value}));
vi.mock('../contexts/AuthContext',()=>({useAuth:()=>({user:{id:'owner',role:'menstruator'}})}));
vi.mock('../contexts/TutorialContext',()=>({useTutorial:()=>({openTutorial:vi.fn()})}));
vi.mock('../hooks/useAppMotion',()=>({useAppMotion:()=>({reduced:true})}));
vi.mock('react-router-dom',()=>({useNavigate:()=>vi.fn()}));
import GameRoom from '../components/games/GameRoom';
beforeEach(()=>{fixture.action.mockClear();fixture.value={room:{id:'room',revision:1,status:'active',player_x:'owner',player_o:'partner',board_state:initialGame('tictactoe').state},player:'X',busy:false,loading:false,error:'',action:fixture.action,reopen:vi.fn(),setError:vi.fn(),couple:{id:'couple'}};});afterEach(cleanup);
it('shows a real waiting state, disabled board and an explicit invitation control',()=>{fixture.value.room.player_o=null;render(<GameRoom game="tictactoe"/>);expect(screen.getByText('Waiting for your partner to join')).toBeTruthy();expect((screen.getByRole('button',{name:'Cell 1, empty'}) as HTMLButtonElement).disabled).toBe(true);expect(screen.getByRole('button',{name:'Notify my partner'})).toBeTruthy();expect(fixture.action).not.toHaveBeenCalled();});
it('lets both players explicitly agree before the game starts',()=>{render(<GameRoom game="tictactoe"/>);fireEvent.click(screen.getByRole('button',{name:'I’m ready'}));expect(fixture.action).toHaveBeenCalledWith({kind:'ready'});});
it('does not let a player move on the partner’s turn',()=>{fixture.value.room.board_state.phase='play';fixture.value.room.board_state.turn='O';render(<GameRoom game="tictactoe"/>);expect(screen.getByText('Partner’s turn')).toBeTruthy();expect((screen.getByRole('button',{name:'Cell 1, empty'}) as HTMLButtonElement).disabled).toBe(true);});
it('shows a shared final result rather than an unexplained game-ended message',()=>{Object.assign(fixture.value.room.board_state,{phase:'result',winner:'X',result:'X made 3 in a row!',scores:{X:1,O:0}});render(<GameRoom game="tictactoe"/>);expect(screen.getByText('You won!')).toBeTruthy();expect(screen.getByRole('button',{name:'Play again'})).toBeTruthy();expect(screen.queryByRole('button',{name:'End game for both'})).toBeNull();});
it('shows a closed room distinctly from a completed match',()=>{fixture.value.room.status='ended';render(<GameRoom game="tictactoe"/>);expect(screen.getByText('Game closed')).toBeTruthy();expect(screen.queryByText('You won!')).toBeNull();});

it('prefetches a fresh set when the host changes the round count',()=>{fixture.value.room.board_state.phase='setup';fixture.value.room.board_state.promptCount=0;const view=render(<GameRoom game="truth_dare"/>);expect(fixture.action).toHaveBeenCalledWith({kind:'prefetch'});fixture.action.mockClear();fixture.value.room.board_state.total=3;view.rerender(<GameRoom game="truth_dare"/>);expect(fixture.action).toHaveBeenCalledWith({kind:'prefetch'});});

it('prepares host questions before the partner joins',()=>{fixture.value.room.player_o=null;fixture.value.room.board_state.promptCount=0;render(<GameRoom game="truth_dare"/>);expect(fixture.action).toHaveBeenCalledWith({kind:'prefetch'});});

it('keeps level and round drafts local until the host explicitly confirms',()=>{
 fixture.value.room.board_state.promptCount=10;render(<GameRoom game="truth_dare"/>);
 fireEvent.click(screen.getByRole('button',{name:'bold'}));fireEvent.click(screen.getByRole('button',{name:'10'}));
 expect(fixture.action).not.toHaveBeenCalled();expect((screen.getByRole('button',{name:'I’m ready'}) as HTMLButtonElement).disabled).toBe(true);
 fireEvent.click(screen.getByRole('button',{name:'Confirm settings'}));expect(fixture.action).toHaveBeenCalledWith({kind:'configure',level:'bold',total:10});
});
it('only exposes the adult level for an eligible pair and keeps peer settings read-only',()=>{
 fixture.value.room.board_state.promptCount=10;fixture.value.player='O';fixture.value.adultAllowed=false;const view=render(<GameRoom game="truth_dare"/>);
 expect(screen.queryByRole('button',{name:'After hours · 18+'})).toBeNull();expect((screen.getByRole('button',{name:'bold'}) as HTMLButtonElement).disabled).toBe(true);
 fixture.value.adultAllowed=true;view.rerender(<GameRoom game="truth_dare"/>);expect(screen.getByRole('button',{name:'After hours · 18+'})).toBeTruthy();
});
it('does not send a selected answer until it is confirmed',()=>{
 Object.assign(fixture.value.room.board_state,{phase:'play',promptCount:10,prompt:{question:'A surprising dilemma?',options:['A','B']}});render(<GameRoom game="would_you_rather"/>);
 fireEvent.click(screen.getByRole('button',{name:'B'}));expect(fixture.action).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Confirm answer'}));expect(fixture.action).toHaveBeenCalledWith({kind:'answer',text:'B'});
});
it('shows final results even when the question queue is empty and never fetches another batch',()=>{
 Object.assign(fixture.value.room.board_state,{phase:'reveal',round:5,total:5,promptCount:0,result:'You both chose differently.',replies:{X:'A',O:'B'}});render(<GameRoom game="would_you_rather"/>);
 expect(screen.getByRole('button',{name:'See results'})).toBeTruthy();expect(fixture.action).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'See results'}));expect(fixture.action).toHaveBeenCalledWith({kind:'next'});
});
