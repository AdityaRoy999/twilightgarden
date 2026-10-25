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

type CellValue = 'X' | 'O' | null;
type BoardState = CellValue[];
type GameStatus = 'waiting' | 'active' | 'finished' | 'ended';

interface GameSession {
    id: string;
    couple_id: string;
    game_type: string;
    board_state: BoardState;
    current_turn: string;
    player_x: string;
    player_o: string | null;
    winner: string | null;
    status: GameStatus;
    created_at: string;
}

const WINNING_COMBOS = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
];

const emptyBoard: BoardState = Array(9).fill(null);

// Cell-center percentages inside the board container (accounts for p-4 padding + gap-3)
const CELL_PCT = [18, 50, 82];
const getStrikeCoords = (line: number[]) => {
    const pos = (idx: number) => ({ x: CELL_PCT[idx % 3], y: CELL_PCT[Math.floor(idx / 3)] });
    const s = pos(line[0]), e = pos(line[2]);
    const dx = e.x - s.x, dy = e.y - s.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ext = 6; // extend past end-cells
    return { x1: s.x - (dx / len) * ext, y1: s.y - (dy / len) * ext, x2: e.x + (dx / len) * ext, y2: e.y + (dy / len) * ext };
};

const TicTacToe: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { couple } = useCouples();
    const { theme, primaryColor } = useTheme();
    const { openTutorial } = useTutorial();
    const isDark = theme === 'dark';

    const [game, setGame] = useState<GameSession | null>(null);
    const [loading, setLoading] = useState(true);
    const [winLine, setWinLine] = useState<number[] | null>(null);
    const [showConfetti, setShowConfetti] = useState(false);
    const [toast, setToast] = useState<{ isVisible: boolean; message: string; subMessage?: string; type: 'success' | 'error' }>({
        isVisible: false, message: '', type: 'success'
    });

    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
    const [ringCooldown, setRingCooldown] = useState(false);
    const ringCooldownRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    const confettiRef = useRef<HTMLCanvasElement>(null);
    const rafRef = useRef<number>(undefined);

    const showToast = (message: string, subMessage?: string, type: 'success' | 'error' = 'success') => {
        setToast({ isVisible: true, message, subMessage, type });
    };

    const mySymbol = game?.player_x === user?.id ? 'X' : 'O';
    const isMyTurn = game?.current_turn === user?.id && game?.status === 'active';

    /* ───── confetti burst ───── */
    const fireConfetti = useCallback(() => {
        const canvas = confettiRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        setShowConfetti(true);

        const colors = [primaryColor, '#EC4899', '#F59E0B', '#10B981', '#6366F1', '#F43F5E', '#8B5CF6', '#FBBF24', '#34D399'];
        interface P { x: number; y: number; vx: number; vy: number; w: number; h: number; color: string; rot: number; rs: number; g: number; }
        const particles: P[] = [];
        for (let i = 0; i < 200; i++) {
            particles.push({
                x: canvas.width * (0.25 + Math.random() * 0.5),
                y: canvas.height * 0.42,
                vx: (Math.random() - 0.5) * 26,
                vy: Math.random() * -24 - 4,
                w: Math.random() * 10 + 4,
                h: Math.random() * 6 + 2,
                color: colors[Math.floor(Math.random() * colors.length)],
                rot: Math.random() * 360,
                rs: (Math.random() - 0.5) * 18,
                g: 0.35 + Math.random() * 0.2,
            });
        }

        let frame = 0;
        const max = 150;
        const tick = () => {
            if (frame >= max) { ctx.clearRect(0, 0, canvas.width, canvas.height); setShowConfetti(false); rafRef.current = undefined; return; }
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            for (const p of particles) {
                p.x += p.vx; p.vy += p.g; p.y += p.vy; p.vx *= 0.99; p.rot += p.rs;
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate((p.rot * Math.PI) / 180);
                ctx.globalAlpha = Math.max(0, 1 - frame / max);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
                ctx.restore();
            }
            frame++;
            rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
    }, [primaryColor]);

    /* ───── winner check ───── */
    const checkWinner = useCallback((board: BoardState): { winner: CellValue; line: number[] | null } => {
        for (const combo of WINNING_COMBOS) {
            const [a, b, c] = combo;
            if (board[a] && board[a] === board[b] && board[a] === board[c]) return { winner: board[a], line: combo };
        }
        return { winner: null, line: null };
    }, []);

    const isDraw = useCallback((board: BoardState): boolean => {
        return board.every(c => c !== null) && !checkWinner(board).winner;
    }, [checkWinner]);

    /* ───── find / create game ───── */
    useEffect(() => {
        if (!couple?.id || !user?.id) {
            setLoading(false);
            return;
        }
        let cancelled = false;

        (async () => {
            setLoading(true);
            try {
                const { data: existing, error: findErr } = await (supabase.from('game_sessions') as any)
                    .select('*')
                    .eq('couple_id', couple.id).eq('game_type', 'tictactoe')
                    .in('status', ['waiting', 'active'])
                    .order('created_at', { ascending: false }).limit(1).maybeSingle();

                if (cancelled) return;

                if (existing) {
                    if (existing.status === 'waiting' && existing.player_x !== user.id && !existing.player_o) {
                        const { data: updated, error: updErr } = await (supabase.from('game_sessions') as any)
                            .update({ player_o: user.id, status: 'active' })
                            .eq('id', existing.id)
                            .select().single();
                        if (updErr) throw updErr;
                        if (!cancelled && updated) {
                            setGame(updated);
                            setTimeout(() => channelRef.current?.send({
                                type: 'broadcast',
                                event: 'game_update',
                                payload: updated
                            }), 100);
                        }
                    } else {
                        if (!cancelled) {
                            setGame(existing);
                            if (existing.status === 'finished') {
                                const { line } = checkWinner(existing.board_state);
                                setWinLine(line);
                            }
                        }
                    }
                } else {
                    const { data: created, error: insErr } = await (supabase.from('game_sessions') as any).insert({
                        couple_id: couple.id,
                        game_type: 'tictactoe',
                        board_state: emptyBoard,
                        current_turn: user.id,
                        player_x: user.id,
                        player_o: null,
                        winner: null,
                        status: 'waiting'
                    }).select().single();
                    if (insErr) throw insErr;
                    if (!cancelled && created) {
                        setGame(created);
                        sendGameNotification(couple, user.id, 'Tic-Tac-Toe', '/games/tictactoe', 'invite');
                    }
                }
            } catch (e) {
                console.error('TicTacToe Init Error:', e);
                if (!cancelled) showToast('Error', 'Failed to initialize game', 'error');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [couple?.id, user?.id]);

    /* ───── realtime: Broadcast (instant) + postgres_changes (fallback) ───── */
    useEffect(() => {
        if (!game?.id || !user?.id) return;

        const channel = supabase.channel(`game_rt_${game.id}`, {
            config: { private: true, broadcast: { self: false } }
        });

        // Broadcast = WebSocket relay, <50 ms partner-to-partner — no DB round-trip
        channel.on('broadcast', { event: 'game_update' }, ({ payload }) => {
            const g = payload as GameSession;
            setGame(g);
            if (g.status === 'finished') {
                const { line } = checkWinner(g.board_state);
                setWinLine(line);
                if (g.winner === user.id) setTimeout(() => fireConfetti(), 120);
            } else if (g.status === 'active') {
                setWinLine(null);
            }
        });

        // postgres_changes = DB-driven fallback (catches anything broadcast missed)
        channel.on('postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'game_sessions', filter: `id=eq.${game.id}` },
            (payload) => {
                const updated = payload.new as GameSession;
                setGame(prev => {
                    if (!prev) return updated;
                    const prevMoves = prev.board_state.filter(c => c !== null).length;
                    const newMoves = updated.board_state.filter(c => c !== null).length;
                    if (newMoves > prevMoves || updated.status !== prev.status || (newMoves === 0 && prevMoves > 0)) {
                        if (updated.status === 'finished' && prev.status !== 'finished') {
                            const { line } = checkWinner(updated.board_state);
                            setWinLine(line);
                            if (updated.winner === user.id) setTimeout(() => fireConfetti(), 120);
                        }
                        if (updated.status === 'active' && prev.status === 'finished') setWinLine(null);
                        return updated;
                    }
                    return prev;
                });
            }
        );

        channel.on('postgres_changes',
            { event: 'DELETE', schema: 'public', table: 'game_sessions', filter: `id=eq.${game.id}` },
            () => { setGame(null); showToast('Game Ended', 'Your partner left the game'); }
        );

        channel.subscribe();
        channelRef.current = channel;

        return () => { supabase.removeChannel(channel); channelRef.current = null; clearTimeout(ringCooldownRef.current); if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    }, [game?.id, user?.id, checkWinner, fireConfetti]);

    /* ───── make a move ───── */
    const handleCellClick = async (index: number) => {
        if (!game || !user || !isMyTurn || game.board_state[index] !== null || game.status !== 'active') return;

        const newBoard = [...game.board_state];
        newBoard[index] = mySymbol as CellValue;
        const { winner, line } = checkWinner(newBoard);
        const draw = !winner && isDraw(newBoard);
        const otherPlayer = game.player_x === user.id ? game.player_o : game.player_x;

        const updates: Record<string, any> = { board_state: newBoard, current_turn: otherPlayer };
        if (winner) { updates.status = 'finished'; updates.winner = user.id; setWinLine(line); setTimeout(() => fireConfetti(), 180); }
        else if (draw) { updates.status = 'finished'; updates.winner = 'draw'; }

        const optimistic = { ...game, ...updates } as GameSession;

        // 1. Optimistic local update (0 ms)
        setGame(optimistic);
        // 2. Broadcast to partner (<50 ms WebSocket relay)
        channelRef.current?.send({ type: 'broadcast', event: 'game_update', payload: optimistic });
        // 3. Persist to DB (100–300 ms, but partner already sees the move)
        const { error } = await (supabase.from('game_sessions') as any).update(updates).eq('id', game.id);
        if (error) { console.error('Move error:', error); setGame(game); setWinLine(null); showToast('Error', 'Failed to make move', 'error'); }
    };

    /* ───── play again ───── */
    const handlePlayAgain = async () => {
        if (!game || !user) return;
        const prev = game;
        const newPx = game.player_o || user.id;
        const newPo = game.player_x;
        const reset: Record<string, any> = { board_state: emptyBoard, current_turn: newPx, player_x: newPx, player_o: newPo, winner: null, status: 'active' };
        const optimistic = { ...game, ...reset } as GameSession;

        setGame(optimistic); setWinLine(null);
        try {
            channelRef.current?.send({ type: 'broadcast', event: 'game_update', payload: optimistic });
            const { error } = await (supabase.from('game_sessions') as any).update(reset).eq('id', game.id);
            if (error) { setGame(prev); setWinLine(null); showToast('Error', 'Failed to restart', 'error'); }
        } catch {
            setGame(prev); setWinLine(null); showToast('Error', 'Failed to restart', 'error');
        }
    };

    /* ───── exit ───── */
    const handleExit = async () => {
        try { if (game?.id) await endSession(game.id); } catch {}
        navigate('/games');
    };

    /* ───── helpers ───── */
    const getStatusText = () => {
        if (!game) return '';
        if (game.status === 'waiting') return 'Waiting for partner to join...';
        if (game.status === 'finished') {
            if (game.winner === 'draw') return "It's a draw! 🤝";
            if (game.winner === user?.id) return 'You won! 🎉';
            return 'You lost! 💔';
        }
        return isMyTurn ? 'Your turn' : "Partner's turn";
    };

    const getResultEmoji = () => {
        if (!game || game.status !== 'finished') return null;
        if (game.winner === 'draw') return '🤝';
        if (game.winner === user?.id) return '🏆';
        return '😢';
    };

    /* ───── render ───── */

    if (loading) {
        return (
            <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-background-dark' : 'bg-[#FDFCF8]'}`}>
                <div className="flex flex-col items-center gap-4">
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="w-10 h-10 rounded-full" style={{ borderWidth: 3, borderStyle: 'solid', borderColor: primaryColor, borderTopColor: 'transparent' }} />
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Setting up game...</p>
                </div>
            </div>
        );
    }

    if (game?.status === 'ended') return <GameEndedScreen />;

    if (!game) return <GameEndedScreen />;

    const strikeCoords = winLine ? getStrikeCoords(winLine) : null;

    return (
        <div className={`min-h-screen flex flex-col font-display transition-colors duration-300 ${isDark ? 'bg-background-dark text-white' : 'bg-[#FDFCF8] text-[#121014]'}`}>
            {/* Confetti canvas — full-screen, above everything */}
            <canvas ref={confettiRef} className="fixed inset-0 z-50 pointer-events-none" style={{ display: showConfetti ? 'block' : 'none' }} />

            {/* Header */}
            <header className={`flex items-center justify-between px-5 py-4 sticky top-0 z-20 backdrop-blur-sm border-b ${isDark ? 'bg-[#121014]/95 border-white/5' : 'bg-[#FDFCF8]/95 border-gray-100'}`}>
                <button onClick={handleExit} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors">
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <h1 className="text-lg font-bold">Tic Tac Toe</h1>
                <div className="flex items-center">
                    <button
                        onClick={() => openTutorial('tictactoe')}
                        className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 transition-all active:scale-90 mr-1"
                        title="Watch Tutorial"
                    >
                        <span className="material-symbols-outlined text-xl" style={{ color: primaryColor }}>play_circle</span>
                    </button>
                    <button
                        onClick={async () => {
                            if (!couple || !user || ringCooldown) return;
                            setRingCooldown(true);
                            await sendGameNotification(couple, user.id, 'Tic Tac Toe', '/games/tictactoe', 'ring');
                            ringCooldownRef.current = setTimeout(() => setRingCooldown(false), 30000);
                        }}
                        disabled={ringCooldown}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${ringCooldown ? 'opacity-30' : 'hover:bg-white/10 active:scale-90'}`}
                        title="Ring Partner"
                    >
                        <span className="material-symbols-outlined text-xl">{ringCooldown ? 'notifications_off' : 'notifications_active'}</span>
                    </button>
                </div>
            </header>

            <main className="flex-1 flex flex-col items-center justify-center px-6 gap-8 pt-12 pb-24">
                {/* Player badges */}
                <div className="flex items-center justify-center gap-6 w-full max-w-xs">
                    <div className={`flex flex-col items-center gap-1 flex-1 p-3 rounded-2xl transition-all ${isMyTurn && game.status === 'active' ? (isDark ? 'bg-white/10 ring-2' : 'bg-gray-100 ring-2') : ''}`}
                        style={isMyTurn && game.status === 'active' ? { '--tw-ring-color': primaryColor } as React.CSSProperties : {}}>
                        <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl font-black"
                            style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}>{mySymbol}</div>
                        <span className="text-xs font-bold">You</span>
                    </div>

                    <div className={`text-sm font-bold px-3 py-1 rounded-full ${isDark ? 'bg-white/5 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>VS</div>

                    <div className={`flex flex-col items-center gap-1 flex-1 p-3 rounded-2xl transition-all ${!isMyTurn && game.status === 'active' ? (isDark ? 'bg-white/10 ring-2' : 'bg-gray-100 ring-2') : ''}`}
                        style={!isMyTurn && game.status === 'active' ? { '--tw-ring-color': primaryColor } as React.CSSProperties : {}}>
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl font-black ${isDark ? 'bg-pink-500/20 text-pink-400' : 'bg-pink-100 text-pink-500'}`}>
                            {mySymbol === 'X' ? 'O' : 'X'}
                        </div>
                        <span className="text-xs font-bold">Partner</span>
                    </div>
                </div>

                {/* Status */}
                <motion.div key={getStatusText()} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                    className={`text-center font-bold text-lg ${game.status === 'finished' ? (game.winner === user?.id ? 'text-green-500' : game.winner === 'draw' ? 'text-yellow-500' : 'text-red-400') : isMyTurn ? '' : 'text-gray-400'}`}
                    style={isMyTurn && game.status === 'active' ? { color: primaryColor } : {}}>
                    {getStatusText()}
                </motion.div>

                {/* Board + strike line overlay */}
                <div className="relative w-full max-w-[300px] aspect-square">
                    <div className={`grid grid-cols-3 gap-3 w-full h-full p-4 rounded-3xl ${isDark ? 'bg-white/5' : 'bg-white shadow-lg border border-gray-100'}`}>
                        {game.board_state.map((cell, i) => {
                            const isWinCell = winLine?.includes(i);
                            const canClick = isMyTurn && cell === null && game.status === 'active';
                            return (
                                <motion.button key={i} onClick={() => handleCellClick(i)} disabled={!canClick}
                                    whileHover={canClick ? { scale: 1.05 } : {}} whileTap={canClick ? { scale: 0.95 } : {}}
                                    className={`aspect-square rounded-2xl flex items-center justify-center text-4xl font-black transition-all ${
                                        canClick ? (isDark ? 'bg-white/10 hover:bg-white/15 cursor-pointer' : 'bg-gray-50 hover:bg-gray-100 cursor-pointer')
                                            : cell ? (isDark ? 'bg-white/5' : 'bg-gray-50') : (isDark ? 'bg-white/[0.03]' : 'bg-gray-50/50')
                                    }`}
                                    style={isWinCell ? { backgroundColor: `${primaryColor}25`, boxShadow: `0 0 20px ${primaryColor}30` } : {}}>
                                    <AnimatePresence>
                                        {cell && (
                                            <motion.span initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }}
                                                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                                                className={cell === mySymbol ? '' : (isDark ? 'text-pink-400' : 'text-pink-500')}
                                                style={cell === mySymbol ? { color: primaryColor } : {}}>
                                                {cell}
                                            </motion.span>
                                        )}
                                    </AnimatePresence>
                                </motion.button>
                            );
                        })}
                    </div>

                    {/* Animated strike-through line */}
                    <AnimatePresence>
                        {strikeCoords && (
                            <motion.svg initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 100 100">
                                <motion.line
                                    x1={strikeCoords.x1} y1={strikeCoords.y1}
                                    x2={strikeCoords.x2} y2={strikeCoords.y2}
                                    stroke={primaryColor} strokeWidth="2.8" strokeLinecap="round"
                                    initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                                    transition={{ duration: 0.45, ease: 'easeOut', delay: 0.08 }}
                                    style={{ filter: `drop-shadow(0 0 8px ${primaryColor})` }}
                                />
                            </motion.svg>
                        )}
                    </AnimatePresence>
                </div>

                {/* Waiting spinner */}
                {game.status === 'waiting' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-3">
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                            className="w-6 h-6 rounded-full" style={{ borderWidth: 2, borderStyle: 'solid', borderColor: primaryColor, borderTopColor: 'transparent' }} />
                        <p className="text-sm text-gray-400">Send your partner to Games → Tic Tac Toe</p>
                    </motion.div>
                )}

                {/* Game over actions */}
                <AnimatePresence>
                    {game.status === 'finished' && (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                            className="flex flex-col items-center gap-4 w-full max-w-xs">
                            <div className="text-6xl">{getResultEmoji()}</div>
                            <button onClick={handlePlayAgain}
                                className="w-full px-6 py-4 rounded-2xl font-bold text-white shadow-lg transition-all hover:brightness-110 active:scale-95"
                                style={{ backgroundColor: primaryColor, boxShadow: `0 8px 24px ${primaryColor}40` }}>
                                Play Again 🔄
                            </button>
                            <button onClick={handleExit}
                                className={`w-full px-6 py-3 rounded-2xl font-bold transition-colors ${isDark ? 'bg-white/5 hover:bg-white/10 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}>
                                Exit Game
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            <Toast message={toast.message} subMessage={toast.subMessage} isVisible={toast.isVisible}
                onClose={() => setToast(prev => ({ ...prev, isVisible: false }))} type={toast.type} />
        </div>
    );
};

export default TicTacToe;
