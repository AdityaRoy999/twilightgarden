// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
const fixture = vi.hoisted(() => ({ save: vi.fn().mockResolvedValue(undefined), navigate: vi.fn(), log: undefined as any }));
vi.mock('react-router-dom', () => ({ useNavigate: () => fixture.navigate, useSearchParams: () => [new URLSearchParams()] }));
vi.mock('../contexts/ThemeContext', () => ({ useTheme: () => ({ animationsEnabled: false }) }));
vi.mock('../contexts/DataContext', () => ({ useData: () => ({ addLog: fixture.save, getLog: () => fixture.log, getCyclePhase: () => ({ currentDay: 2 }) }) }));
import LogDetails from '../pages/LogDetails';
afterEach(() => { cleanup(); fixture.log = undefined; vi.clearAllMocks(); });
it('keeps shared symptom chips synchronized and removes the symptom from both categories', async () => {
  render(<LogDetails/>);
  const nausea = screen.getAllByRole('button', { name: 'Nausea' });
  fireEvent.click(nausea[0]);
  expect(nausea.every(button => button.getAttribute('aria-pressed') === 'true')).toBe(true);
  fireEvent.click(nausea[1]);
  expect(nausea.every(button => button.getAttribute('aria-pressed') === 'false')).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Save Log' }));
  await waitFor(() => expect(fixture.save).toHaveBeenCalledOnce());
  expect(fixture.save.mock.calls[0][0].symptoms).not.toContain('nausea');
});
it('keeps a reset draft empty when server data refreshes', () => {
  fixture.log = { notes: 'Original note', symptoms: [], moods: ['calm'], periodStarted: true };
  const view = render(<LogDetails/>);
  fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
  fixture.log = { ...fixture.log, notes: 'Updated on another device' };
  view.rerender(<LogDetails/>);
  expect((screen.getByRole('textbox', { name: 'Daily notes' }) as HTMLTextAreaElement).value).toBe('');
  expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
});
