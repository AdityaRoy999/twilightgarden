// @vitest-environment jsdom
import React from 'react';import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
vi.mock('../hooks/useAppMotion',()=>({useAppMotion:()=>({reduced:true})}));
import {ConfirmAction} from '../components/ConfirmAction';
afterEach(cleanup);
it('shows a themed disconnect illustration in an accessible portal and defaults focus to Cancel',()=>{
 const confirm=vi.fn(),cancel=vi.fn();const view=render(<ConfirmAction title="Disconnect" message="Personal health records stay with their owner." confirmLabel="Disconnect" onConfirm={confirm} onCancel={cancel}/>);
 const panel=screen.getByRole('dialog',{name:'Disconnect'});expect(view.container.contains(panel)).toBe(false);expect(panel.classList.contains('confirm-action')).toBe(true);expect(panel.querySelector('.confirm-action-art svg')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Cancel'}));expect(cancel).toHaveBeenCalledTimes(1);expect(confirm).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Disconnect'}));expect(confirm).toHaveBeenCalledTimes(1);
});
