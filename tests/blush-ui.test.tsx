// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({ cycle: { currentDay: 25, phase: 'Luteal', hasEstimate: true, nextPeriodIn: 8, isFertile: false, isOvulation: false }, logs: [] as any[], animations: true }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'test-user', name: 'Aria' } }) }));
vi.mock('../contexts/DataContext', () => ({ useData: () => ({ cycleSettings: { avgCycleLength: 32, avgPeriodLength: 5, lastPeriodStart: '2026-10-02' }, getCyclePhase: () => fixture.cycle, getLog: () => undefined, logs: fixture.logs, addLog: vi.fn() }) }));
vi.mock('../hooks/useToday', () => ({ useToday: () => '2026-10-26' }));
vi.mock('../components/NotificationBell', () => ({ default: () => <button aria-label="Notifications"/> }));
vi.mock('../contexts/ThemeContext', () => ({ useTheme: () => ({ theme: 'light', animationsEnabled: fixture.animations }) }));
vi.mock('../lib/supabase', () => ({ supabase: { from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: null }) }) }) }) } }));
vi.mock('../components/TodayReportModal', () => ({ default: () => null }));
vi.mock('../components/ui/AnimatedIcons', () => ({ ShareIcon: React.forwardRef(() => <span/>) }));
vi.mock('framer-motion', () => ({ motion: { div: ({ children, ...props }: any) => <div>{children}</div>, main: ({ children }: any) => <main>{children}</main> }, AnimatePresence: ({ children }: any) => children, useReducedMotion: () => true }));
vi.mock('recharts', () => Object.fromEntries(['BarChart', 'Bar', 'Cell', 'XAxis', 'YAxis', 'Tooltip', 'ResponsiveContainer', 'AreaChart', 'Area', 'CartesianGrid', 'ReferenceLine', 'PieChart', 'Pie', 'Legend'].map(name => [name, () => <div data-testid="chart"/>])));
import Dashboard from '../pages/Dashboard';
import Insights from '../pages/Insights';
import LogDetails from '../pages/LogDetails';
import { CycleBloom } from '../components/ui/CycleBloom';

function Destination() { const { pathname, search } = useLocation(); return <p>{pathname}{search}</p>; }
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-26T10:00:00')); fixture.cycle = { currentDay: 25, phase: 'Luteal', hasEstimate: true, nextPeriodIn: 8, isFertile: false, isOvulation: false }; fixture.logs = []; });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('blush frontend data and navigation', () => {
  it('uses the cycle model for the ring and next-period card', () => {
    render(<MemoryRouter><Dashboard/></MemoryRouter>);
    expect(screen.getByRole('img', { name: 'Cycle day 25 of an estimated 32 days' })).toBeTruthy();
    expect(screen.getByText('Nov 3')).toBeTruthy();
    expect(screen.getAllByText('8 days to next period')).toHaveLength(2);
    expect(screen.queryByText(/Chances of pregnancy low/i)).toBeNull();
  });
  it('shows an honest start state without fabricated estimates', () => {
    fixture.cycle = { ...fixture.cycle, phase: 'Unknown', hasEstimate: false, currentDay: 0 };
    render(<MemoryRouter><Dashboard/></MemoryRouter>);
    expect(screen.getByText('No estimate yet')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'No cycle estimate yet' })).toBeTruthy();
    expect(screen.queryByText('Day 0')).toBeNull();
  });
  it('preserves overdue cycle information', () => {
    fixture.cycle = { ...fixture.cycle, phase: 'Unknown', currentDay: 39, nextPeriodIn: -6 };
    render(<MemoryRouter><Dashboard/></MemoryRouter>);
    expect(screen.getByText('Day 39')).toBeTruthy();
    expect(screen.getAllByText('6 days past estimate')).toHaveLength(2);
  });
  it('opens the requested quick-log category', () => {
    render(<MemoryRouter initialEntries={['/dashboard']}><Routes><Route path="/dashboard" element={<Dashboard/>}/><Route path="/log/details" element={<Destination/>}/></Routes></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Log sleep' }));
    expect(screen.getByText('/log/details?section=sleep')).toBeTruthy();
  });
  it('uses unique SVG definitions for multiple cycle illustrations', () => {
    const { container } = render(<><CycleBloom day={25} length={32}/><CycleBloom day={5} length={28}/></>);
    const ids = [...container.querySelectorAll('[id]')].map(node => node.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('replaces empty history and sleep charts with a check-in action', () => {
    render(<MemoryRouter><Insights/></MemoryRouter>);
    expect(screen.getByText('Your patterns start here')).toBeTruthy();
    expect(screen.queryByTestId('chart')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Trends' }));
    expect(screen.getAllByText('Your patterns start here')).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Log a check-in' })).toHaveLength(2);
    expect(screen.queryByTestId('chart')).toBeNull();
    expect(screen.queryByText(/2 days shorter/)).toBeNull();
  });
  it('scrolls directly to quick-log content without animation when motion is disabled', async () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    fixture.animations = false;
    render(<MemoryRouter initialEntries={['/log/details?section=sleep']}><LogDetails/></MemoryRouter>);
    await act(async () => {});
    expect(scroll).toHaveBeenCalledWith({ behavior: 'instant', block: 'start' });
    expect(document.getElementById('log-sleep')).toBeTruthy();
    fixture.animations = true;
  });
});
