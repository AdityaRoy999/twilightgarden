// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../hooks/useAppMotion', () => ({ useAppMotion: () => ({ reduced: true }) }));
vi.mock('../contexts/ThemeContext', () => ({ useTheme: () => ({ solidNavBg: false }) }));
import AppShell from '../components/AppShell';
afterEach(cleanup);

for (const mode of ['tracker', 'partner'] as const) it(`shows every ${mode} destination directly on mobile`, () => {
  const prefix = mode === 'partner' ? '/partner' : '';
  render(<MemoryRouter initialEntries={[`${prefix}/dashboard`]}><Routes><Route element={<AppShell mode={mode}/>}><Route path="*" element={<p>Ready</p>}/></Route></Routes></MemoryRouter>);
  const navigation = within(screen.getByRole('navigation', { name: 'Mobile navigation' }));
  expect(navigation.getAllByRole('link').map(link => link.textContent)).toEqual(['Today', 'Calendar', 'Insights', 'Chat', 'Wellness', 'Games', 'Account']);
  expect(navigation.queryByRole('button', { name: /more/i })).toBeNull();
  fireEvent.click(navigation.getByRole('link', { name: 'Wellness' }));
  expect(navigation.getByRole('link', { name: 'Wellness' }).getAttribute('aria-current')).toBe('page');
  expect(navigation.getAllByRole('link')).toHaveLength(7);
});
