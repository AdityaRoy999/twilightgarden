// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

vi.mock('../hooks/useAppMotion', () => ({ useAppMotion: () => ({ reduced: true }) }));
import { SpringModal } from '../components/ui/SpringModal';
import { AppIcon, PhoneOff } from '../components/ui/Icons';

afterEach(cleanup);

it('portals dialogs outside transformed routes and handles Escape without a stale accessible dialog', () => {
  const close = vi.fn();
  const view = render(<div style={{ transform: 'translateX(12px)' }}><SpringModal open onClose={close} label="History"><button>Continue</button></SpringModal></div>);
  const dialog = screen.getByRole('dialog', { name: 'History' });
  expect(view.container.contains(dialog)).toBe(false);
  expect(document.body.contains(dialog)).toBe(true);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(close).toHaveBeenCalledOnce();
  view.rerender(<SpringModal open={false} onClose={close} label="History"><button>Continue</button></SpringModal>);
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('uses locally bundled Solar icons with the correct off state', () => {
  const view = render(<><AppIcon name="water_drop" size={24}/><PhoneOff aria-label="Call off"/><AppIcon name="done_all"/></>);
  expect(view.container.querySelector('svg[data-icon="Droplet"] path')).toBeTruthy();
  expect(view.container.querySelector('[data-icon="DoubleCheck"]')?.getAttribute('data-solar')).toBe('check-read-bold-duotone');
  expect(screen.getByLabelText('Call off').getAttribute('data-solar')).toBe('end-call-rounded-bold-duotone');
});
it('does not render a stray fallback icon for an absent conditional modal',()=>{
 const view=render(<><AppIcon name={false}/><AppIcon name={null}/><AppIcon name={undefined}/></>);
 expect(view.container.querySelector('svg')).toBeNull();
});
