// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import Welcome from '../pages/Welcome';
import AuthScreen from '../components/AuthScreen';

vi.mock('../hooks/useAppMotion', () => ({useAppMotion: () => ({reduced: true})}));
vi.mock('../lib/supabase', () => ({supabase: {auth: {}}}));
afterEach(cleanup);
function CurrentPath() { return <output aria-label="Current path">{useLocation().pathname}</output>; }
function AppJourney() {
  return <MemoryRouter initialEntries={['/welcome']}><CurrentPath/><Routes>
    <Route path="/welcome" element={<Welcome/>}/>
    <Route path="/login" element={<AuthScreen/>}/>
    <Route path="/signup" element={<AuthScreen signup/>}/>
    <Route path="/partner/login" element={<AuthScreen partner/>}/>
    <Route path="/partner/signup" element={<AuthScreen partner signup/>}/>
    <Route path="/partner/forgot-password" element={<h1>Partner recovery</h1>}/>
  </Routes></MemoryRouter>;
}
it('opens personal login directly and keeps signup in the selected space', () => {
  render(<AppJourney/>);
  fireEvent.click(screen.getByRole('link', {name: 'Track My Cycle'}));
  expect(screen.getByLabelText('Current path').textContent).toBe('/login');
  expect(screen.getByRole('form', {name: 'Log in'})).toBeTruthy();
  expect(screen.getByText('Your personal space')).toBeTruthy();
  fireEvent.click(screen.getByRole('link', {name: 'Create an account'}));
  expect(screen.getByLabelText('Current path').textContent).toBe('/signup');
  expect(screen.queryByLabelText('Account type')).toBeNull();
  fireEvent.click(screen.getByRole('link', {name: 'Log in'}));
  expect(screen.getByLabelText('Current path').textContent).toBe('/login');
});
it('keeps partner login, signup and recovery in the partner space', () => {
  render(<AppJourney/>);
  fireEvent.click(screen.getByRole('link', {name: 'Join as Partner'}));
  expect(screen.getByLabelText('Current path').textContent).toBe('/partner/login');
  expect(screen.getByText('Partner space')).toBeTruthy();
  fireEvent.click(screen.getByRole('link', {name: 'Create an account'}));
  expect(screen.getByLabelText('Current path').textContent).toBe('/partner/signup');
  expect(screen.queryByLabelText('Account type')).toBeNull();
  fireEvent.click(screen.getByRole('link', {name: 'Log in'}));
  expect(screen.getByLabelText('Current path').textContent).toBe('/partner/login');
  fireEvent.click(screen.getByRole('link', {name: 'Forgot password?'}));
  expect(screen.getByRole('heading', {name: 'Partner recovery'})).toBeTruthy();
});
it('returns to the welcome screen so the other space can be selected', () => {
  render(<AppJourney/>);
  fireEvent.click(screen.getByRole('link', {name: 'Join as Partner'}));
  fireEvent.click(screen.getByRole('button', {name: 'Back'}));
  fireEvent.click(screen.getByRole('link', {name: 'Track My Cycle'}));
  expect(screen.getByText('Your personal space')).toBeTruthy();
});
it('has three distinct decorative scenes without the live ring info control', () => {
  const {container} = render(<AppJourney/>);
  expect([...container.querySelectorAll('[data-welcome-scene]')].map(scene => scene.getAttribute('data-welcome-scene'))).toEqual(['cycle','care','together']);
  expect(screen.queryByRole('button', {name:'Explain the cycle ring', hidden:true})).toBeNull();
  fireEvent.click(screen.getByRole('button', {name:'Show Feel closer, every day'}));
  expect(container.querySelector('.welcome-card[data-current="true"] h2')?.textContent).toBe('Feel closer, every day');
});
