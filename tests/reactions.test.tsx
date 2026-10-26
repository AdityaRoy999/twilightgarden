// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../hooks/useAppMotion', () => ({ useAppMotion: () => ({ reduced: true }) }));
import { ReactionChips } from '../components/ReactionChips';
afterEach(cleanup);
it('groups reactions, preserves their emoji, and updates the own-reaction state', () => {
  const react = vi.fn();
  const view = render(<ReactionChips userId="me" onReact={react} reactions={[{ user_id: 'partner', emoji: '❤️' }]}/>);
  fireEvent.click(screen.getByRole('button', { name: '❤️, 1 reaction' }));
  expect(react).toHaveBeenCalledWith('❤️');
  view.rerender(<ReactionChips userId="me" onReact={react} reactions={[{ user_id: 'partner', emoji: '❤️' }, { user_id: 'me', emoji: '❤️' }]}/>);
  const chip = screen.getByRole('button', { name: '❤️, 2 reactions, including yours' });
  expect(chip.getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByText('2')).toBeTruthy();
});
