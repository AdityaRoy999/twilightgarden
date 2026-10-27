// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const fixture = vi.hoisted(() => ({ tips: vi.fn(), empathy: vi.fn() }));
vi.mock('../contexts/DataContext', () => ({ useData: () => ({ logs: [], cycleSettings: { avgCycleLength: 28 }, getCyclePhase: () => ({ phase: 'Luteal', currentDay: 25 }) }) }));
vi.mock('../contexts/ThemeContext', () => ({ useTheme: () => ({ theme: 'light', animationsEnabled: false }) }));
vi.mock('../hooks/useAppMotion', () => ({ useAppMotion: () => ({ reduced: true }) }));
vi.mock('../components/NotificationBell', () => ({ default: () => <button aria-label="Notifications"/> }));
vi.mock('../lib/wellnessAI', () => ({ generateWellnessTips: fixture.tips, generateEmpathyAlerts: fixture.empathy, searchNearbyPharmacies: vi.fn(), getRouteToShop: vi.fn(), analyzeSleepEnergyCorrelations: () => ({ sleepCounts: { good: 0, fair: 0, poor: 0 }, energyCounts: { high: 0, medium: 0, low: 0 }, insights: [], totalLogs: 0 }) }));
import Wellness from '../pages/Wellness';
beforeEach(() => { fixture.tips.mockReset(); fixture.empathy.mockReset(); });
afterEach(cleanup);
it('keeps cycle context visible during loading and prevents an earlier tab response from replacing the current view', async () => {
  let finish!: (value: { text: string }) => void;
  fixture.tips.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  fixture.empathy.mockResolvedValue({ text: 'Some gentle support' });
  render(<Wellness/>);
  expect(screen.getByText('Luteal phase')).toBeTruthy();
  expect(await screen.findByRole('status')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Empathy' }));
  expect(await screen.findByText('Some gentle support')).toBeTruthy();
  await act(async () => { finish({ text: 'Tips from the earlier tab' }); });
  expect(screen.getByText('Some gentle support')).toBeTruthy();
  expect(screen.queryByText('Tips from the earlier tab')).toBeNull();
});
it('ends a failed loading state with a retry action while retaining the overview', async () => {
  fixture.tips.mockRejectedValueOnce(new Error('Please retry')).mockResolvedValue({ text: 'Guidance ready' });
  render(<Wellness/>);
  fireEvent.click(await screen.findByRole('button', { name: 'Try Again' }));
  expect(await screen.findByText('Guidance ready')).toBeTruthy();
  expect(screen.getByText('Luteal phase')).toBeTruthy();
});
it('retains the visible advice and disables refresh while a replacement guide loads', async () => {
  let finish!: (value: { text: string }) => void;
  fixture.tips.mockResolvedValueOnce({text:'Existing gentle advice'}).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
  render(<Wellness/>);
  expect(await screen.findByText('Existing gentle advice')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Refresh'}));
  expect(screen.getByText('Existing gentle advice')).toBeTruthy();
  expect(screen.getByRole('button',{name:'Refreshing…'}).hasAttribute('disabled')).toBe(true);
  await waitFor(()=>expect(fixture.tips).toHaveBeenCalledTimes(2));
  await act(async()=>{finish({text:'Updated gentle advice'});});
  expect(await screen.findByText('Updated gentle advice')).toBeTruthy();
});
