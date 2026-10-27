import { play, type GameType, type Player, type State } from '../supabase/functions/_shared/gameEngine';

/** Immediate public placement only; scores, results, secrets and the next turn
 * stay authoritative until the server accepts the action. */
export function previewGameMove(game: GameType, state: State, player: Player, action: Record<string, unknown>): State | null {
  if (action.kind !== 'move' || !['tictactoe','connect_four','dots_boxes'].includes(game)) return null;
  try {
    const next = play(game, state, { choices: {}, prompts: [] }, player, action).state;
    return { ...state, board: next.board, edges: next.edges, boxes: next.boxes, moves: next.moves };
  } catch { return null; }
}
