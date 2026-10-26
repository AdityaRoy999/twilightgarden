// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';

function Controls() {
  const { theme, primaryColor, toggleTheme, resetTheme, updateAnimationsEnabled } = useTheme();
  return <><p>{theme} {primaryColor}</p><button onClick={toggleTheme}>Toggle</button><button onClick={resetTheme}>Reset</button><button onClick={() => updateAnimationsEnabled(false)}>Reduce motion</button></>;
}
beforeEach(() => { localStorage.clear(); document.documentElement.className = ''; document.body.className = ''; });
afterEach(cleanup);
it('opens the design update in blush and replaces the old default accent', () => {
  localStorage.setItem('theme', 'dark');
  localStorage.setItem('theme-primary', '#984369');
  render(<ThemeProvider><Controls/></ThemeProvider>);
  expect(screen.getByText('light #c33367')).toBeTruthy();
  expect(document.documentElement.classList.contains('dark')).toBe(false);
  expect(localStorage.getItem('twilight-design-version')).toBe('bloom-1');
});
it('retains the chosen dark appearance and a custom accent after reopening', () => {
  localStorage.setItem('theme-primary', '#6366f1');
  const first = render(<ThemeProvider><Controls/></ThemeProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Toggle' }));
  expect(document.documentElement.classList.contains('dark')).toBe(true);
  first.unmount();
  render(<ThemeProvider><Controls/></ThemeProvider>);
  expect(screen.getByText('dark #6366f1')).toBeTruthy();
});
it('respects the motion preference and restores the new defaults on reset', () => {
  render(<ThemeProvider><Controls/></ThemeProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Reduce motion' }));
  expect(document.body.classList.contains('disable-animations')).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Toggle' }));
  fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
  expect(screen.getByText('light #c33367')).toBeTruthy();
  expect(document.body.classList.contains('disable-animations')).toBe(false);
});
