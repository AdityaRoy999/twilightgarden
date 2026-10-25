// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
const { addLog, navigate }=vi.hoisted(()=>({addLog:vi.fn(),navigate:vi.fn()}));
vi.mock('react-router-dom',()=>({useNavigate:()=>navigate,useSearchParams:()=>[new URLSearchParams()]}));
vi.mock('../contexts/DataContext',()=>({useData:()=>({addLog,getLog:()=>undefined,getCyclePhase:()=>({currentDay:1})})}));
vi.mock('../components/ui/SymptomSelector',()=>({SymptomSelector:()=>null}));
import LogDetails from '../pages/LogDetails';
afterEach(()=>cleanup());
describe('daily log persistence',()=>{
  it('keeps the form open until persistence succeeds',async()=>{
    let resolve!:()=>void; addLog.mockImplementation(()=>new Promise<void>(r=>{resolve=r;}));
    render(<LogDetails/>); fireEvent.click(screen.getByRole('button',{name:/save log/i}));
    expect(navigate).not.toHaveBeenCalled(); expect(screen.getByRole('button',{name:/saving/i}).hasAttribute('disabled')).toBe(true);
    resolve(); await waitFor(()=>expect(navigate).toHaveBeenCalledWith(-1));
  });
  it('retains the draft and shows the database error on rejection',async()=>{
    addLog.mockRejectedValue(new Error('Network unavailable'));
    render(<LogDetails/>); const notes=screen.getByRole('textbox',{name:'Daily notes'});
    fireEvent.change(notes,{target:{value:'Keep this draft'}}); fireEvent.click(screen.getByRole('button',{name:/save log/i}));
    await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('Network unavailable'));
    expect(navigate).not.toHaveBeenCalled(); expect((notes as HTMLTextAreaElement).value).toBe('Keep this draft');
  });
});
