// @vitest-environment jsdom
import React from 'react';
import {it,expect,vi,beforeEach,afterEach} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
const state=vi.hoisted(()=>({couple:null as any,generate:vi.fn(),join:vi.fn()}));
vi.mock('../contexts/CouplesContext',()=>({useCouples:()=>({couple:state.couple,generatePairingCode:state.generate,joinCouple:state.join})}));
import {ConnectionScreen} from '../components/ConnectionScreen';
beforeEach(()=>{state.couple=null;state.generate.mockReset();state.join.mockReset();});afterEach(cleanup);
it('offers linking without suggesting recovery of a deleted conversation',async()=>{render(<ConnectionScreen/>);expect(screen.queryByText('Restore chats')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Generate Access Code'}));await waitFor(()=>expect(state.generate).toHaveBeenCalledOnce());});
it('shows the current pending code without generating another on render',()=>{state.couple={status:'pending',pairing_code:'AB12CD'};render(<ConnectionScreen/>);expect(screen.getByText('AB12CD')).toBeTruthy();expect(state.generate).not.toHaveBeenCalled();});
it('normalizes the entered code and surfaces a failed join without losing it',async()=>{state.join.mockRejectedValue(new Error('Invalid or expired pairing code'));render(<ConnectionScreen/>);fireEvent.click(screen.getByRole('button',{name:'Enter Code'}));fireEvent.change(screen.getByLabelText('Your partner’s code'),{target:{value:'ab12cd'}});fireEvent.click(screen.getByRole('button',{name:'Connect with my partner'}));await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('Invalid or expired'));expect(state.join).toHaveBeenCalledWith('AB12CD');expect((screen.getByLabelText('Your partner’s code') as HTMLInputElement).value).toBe('AB12CD');});
