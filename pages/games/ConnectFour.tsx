import { AppIcon } from '../../components/ui/Icons';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useCouples } from '../../contexts/CouplesContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useTutorial } from '../../contexts/TutorialContext';
import Toast from '../../components/Toast';
import { sendGameNotification } from '../../lib/notifications';
import GameEndedScreen from '../../components/GameEndedScreen';
import { endSession } from '../../lib/gameSessions';

const ROWS = 6;
const COLS = 7;
type Cell = null | 'R' | 'Y';
type Board = Cell[][];

interface GameSession {
    id: string;
    couple_id: string;
    game_type: string;
    board_state: Board;
    current_turn: string;
    player_x: string;       // Red
    player_o: string | null; // Yellow
    winner: string | null;
    status: 'waiting' | 'active' | 'finished' | 'ended';
    created_at: string;
}

const emptyBoard = (): Board => Array.from({ length: ROWS }, () => Array(COLS).fill(null));

const DIRECTIONS = [[0, 1], [1, 0], [1, 1], [1, -1]];

const ConnectFour: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { couple } = useCouples();
    const { theme, primaryColor } = useTheme();
    const { openTutorial } = useTutorial();
    const isDark = theme === 'dark';

    const [game, setGame] = useState<GameSession | null>(null);
    const [loading, setLoading] = useState(true);
    const [winCells, setWinCells] = useState<[number, number][]>([]);
    const [hoverCol, setHoverCol] = useState<number | null>(null);
    const [toast, setToast] = useState<{ isVisible: boolean; message: string; subMessage?: string; type: 'success' | 'error' }>({ isVisible: false, message: '', type: 'success' });
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
    const [ringCooldown, setRingCooldown] = useState(false);
    const ringCooldownRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    const showToast = (m: string, s?: string, t: 'success' | 'error' = 'success') => setToast({ isVisible: true, message: m, subMessage: s, type: t });

    const myColor: 'R' | 'Y' = game?.player_x === user?.id ? 'R' : 'Y';
    const isMyTurn = game?.current_turn === user?.id && game?.status === 'active';

    const checkWin = useCallback((board: Board): { winner: Cell; cells: [number, number][] } => {
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (!board[r][c]) continue;
                for (const [dr, dc] of DIRECTIONS) {
                    const cells: [number, number][] = [[r, c]];
                    for (let i = 1; i < 4; i++) {
                        const nr = r + dr * i, nc = c + dc * i;
                        if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || board[nr][nc] !== board[r][c]) break;
                        cells.push([nr, nc]);
                    }
                    if (cells.length === 4) return { winner: board[r][c], cells };
                }
            }
        }
        return { winner: null, cells: [] };
    }, []);

    const isBoardFull = (board: Board) => board[0].every(c => c !== null);

    /* ─── init ─── */
    useEffect(() => {
        if (!couple?.id || !user?.id) {
            setLoading(false);
            return;
        }
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const { data: existing } = await (supabase.from('game_sessions') as any).select('*')
                    .eq('couple_id', couple.id).eq('game_type', 'connect_four')
                    .in('status', ['waiting', 'active']).order('created_at', { ascending: false }).limit(1).maybeSingle();
                if (cancelled) return;

                if (existing) {
                    if (existing.status === 'waiting' && existing.player_x !== user.id && !existing.player_o) {
                        const { data: updated } = await (supabase.from('game_sessions') as any)
                            .update({ player_o: user.id, status: 'active' }).eq('id', existing.id).select().single();
                        if (!cancelled && updated) { setGame(updated); setTimeout(() => channelRef.current?.send({ type: 'broadcast', event: 'game_update', payload: updated }), 80); }
                    } else {
                        if (!cancelled) {
                            setGame(existing);
                            if (existing.status === 'finished') { const { cells } = checkWin(existing.board_state); setWinCells(cells); }
                        }
                    }
                } else {
                    const { data: created } = await (supabase.from('game_sessions') as any).insert({
                        couple_id: couple.id, game_type: 'connect_four', board_state: emptyBoard(),
                        current_turn: user.id, player_x: user.id, player_o: null, winner: null, status: 'waiting'
                    }).select().single();
                    if (!cancelled && created) setGame(created);
                    if (created) sendGameNotification(couple, user.id, 'Connect Four', '/games/connect-four', 'invite');
                }
            } catch (e) {
                console.error('ConnectFour init error:', e);
                if (!cancelled) showToast('Error', 'Failed to start', 'error');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [couple?.id, user?.id]);

    /* ─── realtime ─── */
    useEffect(() => {
        if (!game?.id || !user?.id) return;
        const ch = supabase.channel(`game_rt_${game.id}`, { config: { private: true, broadcast: { self: false } } });
        ch.on('broadcast', { event: 'game_update' }, ({ payload }) => {
            const g = payload as GameSession;
            setGame(g);
            if (g.status === 'finished') { const { cells } = checkWin(g.board_state); setWinCells(cells); }
            else setWinCells([]);
        });
        ch.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_sessions', filter: `id=eq.${game.id}` },
            (p) => { const u = p.new as GameSession; setGame(u); if (u.status === 'finished') { const { cells } = checkWin(u.board_state); setWinCells(cells); } });
        ch.on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'game_sessions', filter: `id=eq.${game.id}` },
            () => { setGame(null); showToast('Game Ended', 'Partner left'); });
        ch.subscribe(); channelRef.current = ch;
        return () => { supabase.removeChannel(ch); channelRef.current = null; clearTimeout(ringCooldownRef.current); };
    }, [game?.id, user?.id, checkWin]);

    /* ─── drop disc ─── */
    const handleDrop = async (col: number) => {
        if (!game || !user || !isMyTurn) return;
        const board: Board = game.board_state.map(r => [...r]);
        // Find lowest empty row
        let row = -1;
        for (let r = ROWS - 1; r >= 0; r--) { if (!board[r][col]) { row = r; break; } }
        if (row === -1) return; // column full

        board[row][col] = myColor;
        const { winner, cells } = checkWin(board);
        const draw = !winner && isBoardFull(board);
        const other = game.player_x === user.id ? game.player_o : game.player_x;

        const updates: Record<string, any> = { board_state: board, current_turn: other };
        if (winner) { updates.status = 'finished'; updates.winner = user.id; setWinCells(cells); }
        else if (draw) { updates.status = 'finished'; updates.winner = 'draw'; }

        const opt = { ...game, ...updates } as GameSession;
        setGame(opt);
        channelRef.current?.send({ type: 'broadcast', event: 'game_update', payload: opt });
        const { error } = await (supabase.from('game_sessions') as any).update(updates).eq('id', game.id);
        if (error) { setGame(game); setWinCells([]); showToast('Error', 'Move failed', 'error'); }
    };

    const handlePlayAgain = async () => {
        if (!game || !user) return;
        const prev = game;
        const newPx = game.player_o || user.id;
        const reset = { board_state: emptyBoard(), current_turn: newPx, player_x: newPx, player_o: game.player_x, winner: null, status: 'active' as const };
        const opt = { ...game, ...reset };
        setGame(opt); setWinCells([]);
        try {
            channelRef.current?.send({ type: 'broadcast', event: 'game_update', payload: opt });
            const { error } = await (supabase.from('game_sessions') as any).update(reset).eq('id', game.id);
            if (error) { setGame(prev); setWinCells([]); showToast('Error', 'Failed to restart', 'error'); }
        } catch {
            setGame(prev); setWinCells([]);
        }
    };

    const handleExit = async () => { try { if (game?.id) await endSession(game.id); } catch {} navigate('/games'); };

    const getStatusText = () => {
        if (!game) return '';
        if (game.status === 'waiting') return 'Waiting for partner...';
        if (game.status === 'finished') { return game.winner === 'draw' ? "It's a draw! 🤝" : game.winner === user?.id ? 'You won! 🎉' : 'You lost! 💔'; }
        return isMyTurn ? 'Your turn — drop a disc!' : "Partner's turn";
    };

    if (loading) return <div className={`min-h-screen flex items-center justify-center bg-background-dark`}><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-10 h-10 rounded-full" style={{ borderWidth: 3, borderStyle: 'solid', borderColor: primaryColor, borderTopColor: 'transparent' }} /></div>;
    if (game?.status === 'ended') return <GameEndedScreen />;
    if (!game) return <GameEndedScreen />;

    const isWinCell = (r: number, c: number) => winCells.some(([wr, wc]) => wr === r && wc === c);

    return (
        <div className={`min-h-screen flex flex-col font-display transition-colors ${isDark ? 'bg-background-dark text-white' : 'bg-background-dark text-[var(--text-primary)]'}`}>
            <header className={`flex items-center justify-between px-5 py-4 sticky top-0 z-20 backdrop-blur-sm border-b ${isDark ? 'bg-background-dark/95 border-white/5' : 'bg-background-dark/95 border-gray-100'}`}>
                <button onClick={handleExit} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10"><span className="app-icon-glyph"><AppIcon name={"arrow_back"}/></span></button>
                <h1 className="text-lg font-bold">Connect Four</h1>
                <div className="flex items-center">
                    <button
                        onClick={() => openTutorial('connect-four')}
                        className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 transition-all active:scale-90 mr-1"
                        title="Watch Tutorial"
                    >
                        <span className="app-icon-glyph text-xl" style={{ color: primaryColor }}><AppIcon name={"play_circle"}/></span>
                    </button>
                    <button
                        onClick={async () => {
                            if (!couple || !user || ringCooldown) return;
                            setRingCooldown(true);
                            await sendGameNotification(couple, user.id, 'Connect Four', '/games/connect-four', 'ring');
                            ringCooldownRef.current = setTimeout(() => setRingCooldown(false), 30000);
                        }}
                        disabled={ringCooldown}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${ringCooldown ? 'opacity-30' : 'hover:bg-white/10 active:scale-90'}`}
                        title="Ring Partner"
                    >
                        <span className="app-icon-glyph text-xl"><AppIcon name={ringCooldown ? 'notifications_off' : 'notifications_active'}/></span>
                    </button>
                </div>
            </header>

            <main className="flex-1 flex flex-col items-center justify-center px-4 gap-6 pt-12 pb-24">
                {/* Players */}
                <div className="flex items-center justify-center gap-6 w-full max-w-xs">
                    <div className={`flex flex-col items-center gap-1 flex-1 p-3 rounded-2xl ${isMyTurn && game.status === 'active' ? 'ring-2' : ''}`}
                        style={isMyTurn && game.status === 'active' ? { '--tw-ring-color': primaryColor } as any : {}}>
                        <div className={`w-10 h-10 rounded-full ${myColor === 'R' ? 'bg-red-500' : 'bg-yellow-400'}`} />
                        <span className="text-xs font-bold">You</span>
                    </div>
                    <div className={`text-sm font-bold px-3 py-1 rounded-full ${isDark ? 'bg-white/5 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>VS</div>
                    <div className={`flex flex-col items-center gap-1 flex-1 p-3 rounded-2xl ${!isMyTurn && game.status === 'active' ? 'ring-2' : ''}`}
                        style={!isMyTurn && game.status === 'active' ? { '--tw-ring-color': primaryColor } as any : {}}>
                        <div className={`w-10 h-10 rounded-full ${myColor === 'R' ? 'bg-yellow-400' : 'bg-red-500'}`} />
                        <span className="text-xs font-bold">Partner</span>
                    </div>
                </div>

                <motion.p key={getStatusText()} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`text-center font-bold text-lg ${game.status === 'finished' ? (game.winner === user?.id ? 'text-green-500' : game.winner === 'draw' ? 'text-yellow-500' : 'text-red-400') : ''}`}
                    style={isMyTurn && game.status === 'active' ? { color: primaryColor } : {}}>
                    {getStatusText()}
                </motion.p>

                {/* Board */}
                <div className={`rounded-3xl p-3 ${isDark ? 'bg-blue-900/40' : 'bg-blue-600'}`}>
                    {/* Column hover indicators */}
                    <div className="grid grid-cols-7 gap-1.5 mb-2 px-0.5">
                        {Array.from({ length: COLS }, (_, c) => (
                            <div key={c} className="flex justify-center">
                                <motion.div
                                    animate={{ opacity: hoverCol === c && isMyTurn && game.status === 'active' ? 1 : 0, y: hoverCol === c && isMyTurn && game.status === 'active' ? 0 : -8 }}
                                    className={`w-8 h-8 rounded-full ${myColor === 'R' ? 'bg-red-500' : 'bg-yellow-400'}`}
                                    style={{ opacity: 0 }}
                                />
                            </div>
                        ))}
                    </div>

                    <div className="grid gap-1.5">
                        {game.board_state.map((row, r) => (
                            <div key={r} className="grid grid-cols-7 gap-1.5">
                                {row.map((cell, c) => {
                                    const win = isWinCell(r, c);
                                    return (
                                        <button key={c}
                                            onClick={() => handleDrop(c)}
                                            onMouseEnter={() => setHoverCol(c)}
                                            onMouseLeave={() => setHoverCol(null)}
                                            disabled={!isMyTurn || game.status !== 'active' || game.board_state[0][c] !== null}
                                            className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full transition-all ${isDark ? 'bg-background-dark' : 'bg-white'} ${isMyTurn && game.status === 'active' && !game.board_state[0][c] ? 'cursor-pointer hover:brightness-110' : ''}`}
                                            style={win ? { boxShadow: `0 0 16px ${primaryColor}, 0 0 4px ${primaryColor}` } : {}}>
                                            <AnimatePresence>
                                                {cell && (
                                                    <motion.div initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                                                        transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                                                        className={`w-full h-full rounded-full ${cell === 'R' ? 'bg-red-500' : 'bg-yellow-400'}`}
                                                        style={win ? { filter: `drop-shadow(0 0 8px ${cell === 'R' ? '#ef4444' : '#facc15'})` } : {}} />
                                                )}
                                            </AnimatePresence>
                                        </button>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Waiting spinner */}
                {game.status === 'waiting' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-3">
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                            className="w-6 h-6 rounded-full" style={{ borderWidth: 2, borderStyle: 'solid', borderColor: primaryColor, borderTopColor: 'transparent' }} />
                        <p className="text-sm text-gray-400">Send your partner to Games → Connect Four</p>
                    </motion.div>
                )}


                <AnimatePresence>
                    {game.status === 'finished' && (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-4 w-full max-w-xs">
                            <div className="text-5xl">{game.winner === user?.id ? '🏆' : game.winner === 'draw' ? '🤝' : '😢'}</div>
                            <button onClick={handlePlayAgain} className="on-brand w-full px-6 py-4 rounded-2xl font-bold text-white shadow-lg active:scale-95" style={{ backgroundColor: primaryColor }}>Play Again <AppIcon name={"🔄"}/></button>
                            <button onClick={handleExit} className={`w-full px-6 py-3 rounded-2xl font-bold ${isDark ? 'bg-white/5 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>Exit Game</button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            <Toast message={toast.message} subMessage={toast.subMessage} isVisible={toast.isVisible} onClose={() => setToast(p => ({ ...p, isVisible: false }))} type={toast.type} />
        </div>
    );
};

export default ConnectFour;
