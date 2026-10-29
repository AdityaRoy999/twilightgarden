// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('../components/ui/SpringModal', () => ({ SpringModal: ({ open, children }: { open: boolean; children: React.ReactNode }) => open ? <div>{children}</div> : null }));
vi.mock('../hooks/useAppMotion', () => ({ useAppMotion: () => ({ reduced: true }) }));
vi.mock('../contexts/ThemeContext', () => ({ useTheme: () => ({ theme: 'light' }) }));
import { GifPicker } from '../components/GifPicker';
const gif = (id: string) => ({ id, title: id, images: { fixed_width: { url: `https://media.giphy.com/${id}.gif` }, fixed_width_small_still: { url: `https://media.giphy.com/${id}.jpg` } } });
beforeEach(() => {
  vi.stubEnv('VITE_GIPHY_API_KEY', 'synthetic-public-test-key');
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it('aborts the superseded search and ignores a late result that still resolves', async () => {
  const requests: { url: URL; signal: AbortSignal; resolve: (value: unknown) => void }[] = [];
  vi.stubGlobal('fetch', vi.fn((url, init) => new Promise(resolve => requests.push({ url, signal: init.signal, resolve }))));
  render(<GifPicker open onClose={() => {}} onSend={() => {}}/>);
  await waitFor(() => expect(requests.length).toBe(1));
  fireEvent.change(screen.getByLabelText('Search GIFs'), { target: { value: 'cats' } });
  await waitFor(() => expect(requests.length).toBe(2));
  expect(requests[0].signal.aborted).toBe(true);
  await act(async () => { requests[1].resolve({ ok: true, json: async () => ({ data: [gif('cats')] }) }); });
  expect(await screen.findByRole('button', { name: 'Send cats' })).toBeTruthy();
  await act(async () => { requests[0].resolve({ ok: true, json: async () => ({ data: [gif('stale')] }) }); });
  expect(screen.queryByRole('button', { name: 'Send stale' })).toBeNull();
});
it('cleans up a pending request when the sheet closes', async () => {
  let signal!: AbortSignal;
  vi.stubGlobal('fetch', vi.fn((_url, init) => { signal = init.signal; return new Promise(() => {}); }));
  const view = render(<GifPicker open onClose={() => {}} onSend={() => {}}/>);
  await waitFor(() => expect(signal).toBeDefined());
  view.rerender(<GifPicker open={false} onClose={() => {}} onSend={() => {}}/>);
  expect(signal.aborted).toBe(true);
});
it('reports missing configuration instead of showing an endless spinner', async () => {
  vi.stubEnv('VITE_GIPHY_API_KEY', '');
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  render(<GifPicker open onClose={() => {}} onSend={() => {}}/>);
  expect(await screen.findByText('GIF search is not configured yet.')).toBeTruthy(); expect(fetcher).not.toHaveBeenCalled();
});
