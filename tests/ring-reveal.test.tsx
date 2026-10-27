// @vitest-environment jsdom
import React from 'react';
import {act,cleanup,render} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
vi.mock('../hooks/useAppMotion',()=>({useAppMotion:()=>({reduced:false})}));
vi.mock('../components/ui/SpringModal',()=>({SpringModal:()=>null}));
import {CycleBloom} from '../components/ui/CycleBloom';
afterEach(()=>{cleanup();vi.useRealTimers();});
it('removes the animated reveal mask completely so the ring has no settled seam',()=>{
 vi.useFakeTimers();const view=render(<CycleBloom day={2} length={28} introKey="seam-regression"/>);
 expect(view.container.querySelector('g[mask]')).toBeTruthy();
 act(()=>vi.advanceTimersByTime(1300));expect(view.container.querySelector('g[mask]')).toBeNull();
 view.unmount();const again=render(<CycleBloom day={2} length={28} introKey="seam-regression"/>);
 expect(again.container.querySelector('g[mask]')).toBeNull();
});
