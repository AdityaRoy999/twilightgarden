// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useGeneratedText } from '../hooks/useGeneratedText';
afterEach(cleanup);

it('deduplicates a view request and retains independent loading states', async () => {
  let finishTips!: (value: { text: string }) => void;
  let finishCare!: (value: { text: string }) => void;
  const tips = vi.fn(() => new Promise<{ text: string }>(resolve => { finishTips = resolve; }));
  const care = vi.fn(() => new Promise<{ text: string }>(resolve => { finishCare = resolve; }));
  const hook = renderHook(() => useGeneratedText({ tips, care }, 'account-and-context'));
  await act(async () => { void hook.result.current.request('tips'); void hook.result.current.request('tips'); void hook.result.current.request('care'); });
  expect(tips).toHaveBeenCalledOnce();
  await act(async () => { finishTips({ text: 'Tips ready' }); });
  expect(hook.result.current.entries.tips?.status).toBe('ready');
  expect(hook.result.current.entries.care?.status).toBe('loading');
  await act(async () => { finishCare({ text: 'Care ready' }); });
  expect(hook.result.current.entries.care?.text).toBe('Care ready');
});

it('ignores a previous account/context result and permits retry after synchronous failure', async () => {
  let finishOld!: (value: { text: string }) => void;
  const old = () => new Promise<{ text: string }>(resolve => { finishOld = resolve; });
  const next = vi.fn().mockImplementationOnce(() => { throw new Error('Temporarily unavailable'); }).mockResolvedValue({ text: 'New context' });
  const hook = renderHook(({ scope }) => useGeneratedText({ tips: scope === 'old' ? old : next }, scope), { initialProps: { scope: 'old' } });
  await act(async () => { void hook.result.current.request('tips'); });
  hook.rerender({ scope: 'new' });
  await act(async () => { await hook.result.current.request('tips'); finishOld({ text: 'Old private context' }); });
  expect(hook.result.current.entries.tips?.error).toBe('Temporarily unavailable');
  await act(async () => { await hook.result.current.request('tips', true); });
  await waitFor(() => expect(hook.result.current.entries.tips?.text).toBe('New context'));
});

it('releases a stuck generation and allows retry without accepting its late result', async () => {
  vi.useFakeTimers();
  let finishOld!: (value:{text:string})=>void;
  const tips=vi.fn().mockImplementationOnce(()=>new Promise(resolve=>{finishOld=resolve;})).mockResolvedValue({text:'Fresh guide'});
  const hook=renderHook(()=>useGeneratedText({tips},'timeout-context'));
  await act(async()=>{void hook.result.current.request('tips');});
  await act(async()=>{await vi.advanceTimersByTimeAsync(40001);});
  expect(hook.result.current.entries.tips?.status).toBe('error');
  expect(hook.result.current.entries.tips?.error).toContain('taking too long');
  await act(async()=>{await hook.result.current.request('tips',true);finishOld({text:'Late old guide'});});
  expect(hook.result.current.entries.tips?.text).toBe('Fresh guide');
  vi.useRealTimers();
});
