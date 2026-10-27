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
