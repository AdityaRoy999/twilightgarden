import React from 'react';
import { AppIcon } from './Icons';
export function GameSymbol({ id }: { id: string }) {
  const symbols: Record<string,string> = {rps:'Hand',tictactoe:'Gamepad2','dots-boxes':'Grid2X2','connect-four':'ChartNoAxesCombined',hangman:'UserRound'};
  return <AppIcon name={symbols[id] || 'Gamepad2'} size={38}/>;
}
