import React from 'react';
import { Gamepad2, Hand } from './Icons';
export function GameSymbol({ id }: { id: string }) {
  if (id === 'rps') return <Hand size={37} strokeWidth={1.8}/>;
  if (!['tictactoe', 'dots-boxes', 'connect-four', 'hangman'].includes(id)) return <Gamepad2 size={36}/>;
  return <svg viewBox="0 0 48 48" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {id === 'tictactoe' && <><path d="m6 7 11 11M17 7 6 18M30 30l11 11M41 30 30 41"/><circle cx="35" cy="12" r="7"/><circle cx="12" cy="35" r="7"/></>}
    {id === 'dots-boxes' && <>{[6, 28].map(x => [6, 28].map(y => <rect key={`${x}-${y}`} x={x} y={y} width="14" height="14" rx="3" fill={y === 6 ? 'currentColor' : 'none'}/>))}</>}
    {id === 'connect-four' && <>{[6, 20, 34].map(x => <rect key={x} x={x} y="5" width="8" height="38" rx="4" fill="currentColor" stroke="none"/>)}</>}
    {id === 'hangman' && <><path d="M5 43h20M12 42V6h23v9M35 28v8m-6-4 6 4 6-4m-6 4-5 7m5-7 6 7"/><circle cx="35" cy="21" r="6"/></>}
  </svg>;
}
