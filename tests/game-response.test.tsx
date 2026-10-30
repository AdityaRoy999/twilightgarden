// @vitest-environment jsdom
import {act,cleanup,renderHook,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {initialGame} from '../supabase/functions/_shared/gameEngine';
const fixture=vi.hoisted(()=>({event:null as any,user:{id:'owner'},couple:{id:'pair',status:'active',partner_1_id:'owner',partner_2_id:'partner'}}));
vi.mock('../contexts/AuthContext',()=>({useAuth:()=>({user:fixture.user})}));
vi.mock('../contexts/CouplesContext',()=>({useCouples:()=>({couple:fixture.couple})}));
vi.mock('../lib/supabase',()=>({rawSupabase:{}}));
vi.mock('../lib/vaultRuntime',()=>({unlockedVault:()=>({userId:'owner'})}));
// Mock the encrypted transport boundary, retaining the same delayed-commit,
// rejection and out-of-order realtime scenarios for optimistic rendering.
vi.mock('../lib/encryptedGames',()=>({EncryptedGameRoom:class{
 listener:any;subscribe(callback:any){this.listener=callback;fixture.event=(event:any)=>callback(event.new);return()=>{};}
 async request(body:any){const response=await fetch('/encrypted-game-test',{method:'POST',body:JSON.stringify(body)});const result=await response.json();if(result.session)this.listener(result.session);if(!response.ok)throw new Error(result.error);return result;}
 start(){return this.request({kind:'open'});}action(action:any){return this.request({action});}dispose(){}
}}));
import {useGameRoom} from '../hooks/useGameRoom';
import {previewGameMove} from '../lib/gamePreview';
const room=()=>({id:'room',revision:1,player_x:'owner',player_o:'partner',game_type:'tictactoe',status:'active',board_state:{...initialGame('tictactoe').state,phase:'play'}});
const response=(data:any,ok=true)=>({ok,json:async()=>data}) as Response;
beforeEach(()=>{fixture.event=null;});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('paints a move before the network responds, then accepts the committed revision',async()=>{
 const original=room();let finish!:(r:Response)=>void;
 const fetcher=vi.fn().mockResolvedValueOnce(response({session:original,invited:true})).mockImplementationOnce(()=>new Promise(r=>{finish=r;}));vi.stubGlobal('fetch',fetcher);
 const {result}=renderHook(()=>useGameRoom('tictactoe'));await waitFor(()=>expect(result.current.loading).toBe(false));
 let pending!:Promise<boolean>;act(()=>{pending=result.current.action({kind:'move',index:0});});
 expect(result.current.room?.board_state.board[0]).toBe('X');expect(result.current.optimistic).toBe(true);expect(original.board_state.board[0]).toBeNull();expect(result.current.invitationSent).toBe(true);
 await waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(2));
 await act(async()=>{finish(response({session:{...original,revision:2,board_state:{...original.board_state,board:['X',...original.board_state.board.slice(1)],turn:'O'}}}));await pending;});
 expect(result.current.optimistic).toBe(false);expect(result.current.room?.revision).toBe(2);expect(result.current.room?.board_state.turn).toBe('O');
});
it('rolls back an unaccepted move without announcing a false win',async()=>{
 const original=room();original.board_state.board=['X','X',null,'O','O',null,null,null,null];let finish!:(r:Response)=>void;
 const fetcher=vi.fn().mockResolvedValueOnce(response({session:original})).mockImplementationOnce(()=>new Promise(r=>{finish=r;}));vi.stubGlobal('fetch',fetcher);
 const {result}=renderHook(()=>useGameRoom('tictactoe'));await waitFor(()=>expect(result.current.loading).toBe(false));let pending!:Promise<boolean>;act(()=>{pending=result.current.action({kind:'move',index:2});});
 expect(result.current.room?.board_state.board[2]).toBe('X');expect(result.current.room?.board_state.phase).toBe('play');expect(result.current.room?.board_state.scores.X).toBe(0);
 await waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(2));await act(async()=>{finish(response({error:'Move rejected'},false));await pending;});
 expect(result.current.room?.board_state.board[2]).toBeNull();expect(result.current.error).toBe('Move rejected');expect(result.current.busy).toBe(false);
});
it('keeps a newer realtime update instead of an older HTTP response',async()=>{
 const original=room();let finish!:(r:Response)=>void;vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(response({session:original})).mockImplementationOnce(()=>new Promise(r=>{finish=r;})));
 const {result}=renderHook(()=>useGameRoom('tictactoe'));await waitFor(()=>expect(result.current.loading).toBe(false));let pending!:Promise<boolean>;act(()=>{pending=result.current.action({kind:'move',index:0});});await waitFor(()=>expect(finish).toBeTypeOf('function'));
 act(()=>fixture.event({new:{...original,revision:3,board_state:{...original.board_state,board:['X','O',null,null,null,null,null,null,null]}}}));
 await act(async()=>{finish(response({session:{...original,revision:2}}));await pending;});expect(result.current.room?.revision).toBe(3);expect(result.current.room?.board_state.board[1]).toBe('O');
});
it('does not predict private card/word outcomes or invalid turns',()=>{
 const state={...initialGame('memory_match').state,phase:'play'} as const;
 expect(previewGameMove('memory_match',state,'X',{kind:'move',index:0})).toBeNull();expect(previewGameMove('wordguess',state,'X',{kind:'move',text:'HEART'})).toBeNull();expect(previewGameMove('tictactoe',{...state,turn:'O'},'X',{kind:'move',index:0})).toBeNull();
});
