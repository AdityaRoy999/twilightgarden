// @vitest-environment jsdom
import React from 'react';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {CycleDial} from '../components/ui/CycleDial';
afterEach(cleanup);
it('provides keyboard and button alternatives with constrained values',()=>{
 const change=vi.fn();const view=render(<CycleDial value={28} min={20} max={45} onChange={change} label="Cycle length"/>);
 fireEvent.keyDown(screen.getByRole('slider'),{key:'ArrowRight'});expect(change).toHaveBeenLastCalledWith(29);
 fireEvent.keyDown(screen.getByRole('slider'),{key:'Home'});expect(change).toHaveBeenLastCalledWith(20);
 fireEvent.click(screen.getByRole('button',{name:'Increase cycle length'}));expect(change).toHaveBeenLastCalledWith(29);
 view.rerender(<CycleDial value={45} min={20} max={45} onChange={change} label="Cycle length"/>);expect((screen.getByRole('button',{name:'Increase cycle length'}) as HTMLButtonElement).disabled).toBe(true);
 fireEvent.keyDown(screen.getByRole('slider'),{key:'ArrowUp'});expect(change).toHaveBeenLastCalledWith(45);
});
