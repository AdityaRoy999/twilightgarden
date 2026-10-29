import { afterEach, expect, it, vi } from 'vitest';
import { requestSignal } from '../lib/requestSignal';
afterEach(() => vi.useRealTimers());
it('aborts from a parent without relying on modern AbortSignal static helpers', () => {
  const parent = new AbortController(), request = requestSignal(1000, parent.signal);
  parent.abort(); expect(request.signal.aborted).toBe(true); request.dispose();
});
it('bounds requests and clears the timer after completion', () => {
  vi.useFakeTimers(); const expired = requestSignal(1000); vi.advanceTimersByTime(1001);
  expect(expired.signal.reason.name).toBe('TimeoutError'); expired.dispose();
  const complete = requestSignal(1000); complete.dispose(); vi.advanceTimersByTime(1001);
  expect(complete.signal.aborted).toBe(false);
});
