// @vitest-environment jsdom
import React from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
vi.mock('../hooks/useAppMotion',()=>({useAppMotion:()=>({reduced:true})}));
vi.mock('../contexts/ThemeContext',()=>({useTheme:()=>({theme:'light'})}));
vi.mock('../hooks/useToday',()=>({useToday:()=> '2026-10-27'}));
import {SymptomSelector} from '../components/ui/SymptomSelector';
import {AppIcon} from '../components/ui/Icons';
import {ExerciseLibrary} from '../components/exercise/ExerciseLibrary';
import {CycleBloom} from '../components/ui/CycleBloom';
import {ShoppingCard} from '../components/wellness/ShoppingCards';
import {LogSymbol} from '../components/ui/LogSymbol';
import {SegmentedControl} from '../components/ui/SegmentedControl';
afterEach(cleanup);
it('renders React icon nodes and actual emoji without feeding nodes back into the icon registry',()=>{
 const view=render(<SymptomSelector options={[{id:'flow',label:'Flow',icon:<AppIcon name="water_drop"/>},{id:'happy',label:'Happy',icon:'😊'}]} selected={[]} onChange={()=>{}}/>);
 expect(view.container.querySelector('[data-icon="Droplet"]')).toBeTruthy();expect(screen.getByText('😊')).toBeTruthy();
});
it('keeps flow and energy medium symbols distinct and changes tabs without a sliding overlay',()=>{
 const view=render(<><LogSymbol kind="flow-medium"/><LogSymbol kind="medium"/><SegmentedControl value="a" options={[{value:'a',label:'First'},{value:'b',label:'Second'}]} onChange={()=>{}} label="Sections"/></>);
 expect(view.container.querySelector('[data-log-symbol="flow-medium"] path')).toBeTruthy();
 expect(view.container.querySelector('[data-log-symbol="medium"] rect')).toBeTruthy();
 expect(view.container.querySelector('.gentle-selection')).toBeNull();
 expect(screen.getByRole('button',{name:'First'}).getAttribute('aria-pressed')).toBe('true');
});
it('opens an exercise guide with relevant video search and keeps breathing under Exercise',()=>{
 render(<ExerciseLibrary logs={[]}/>);fireEvent.click(screen.getByRole('button',{name:'Breathing'}));
 fireEvent.click(screen.getByRole('button',{name:/Seated steady breathing/}));
 expect(screen.getByRole('dialog',{name:'Seated steady breathing'})).toBeTruthy();expect(screen.getByRole('link',{name:'Find a guided video'}).getAttribute('href')).toContain('Seated%20steady%20breathing');
 fireEvent.click(screen.getByRole('button',{name:'Start breathing guide'}));expect(screen.getByRole('button',{name:'Pause breathing guide'})).toBeTruthy();
});
it('exposes an accessible animated ring explanation and the saved number of period dots',()=>{
 const view=render(<CycleBloom day={2} length={28} periodLength={7}/>);expect(view.container.querySelectorAll('[data-period-day]')).toHaveLength(7);
 fireEvent.click(screen.getByRole('button',{name:'Explain the cycle ring'}));expect(screen.getByRole('dialog',{name:'Understanding your cycle ring'})).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'2'}));expect(screen.getByText('The moving marker')).toBeTruthy();
});
it('saves a gift for the current visit without nesting the save button inside a shop link',()=>{
 render(<ShoppingCard index={0} product={{title:'A real gift result',price:'₹499',source:'Amazon',image:'',link:'https://example.invalid/product'}}/>);
 const button=screen.getByRole('button',{name:'Save A real gift result'});expect(button.closest('a')).toBeNull();fireEvent.click(button);expect(screen.getByText('Saved for this visit')).toBeTruthy();
});
