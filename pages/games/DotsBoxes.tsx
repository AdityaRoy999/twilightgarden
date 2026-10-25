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
import type { Database } from '../../lib/database.types';

const GRID = 4; // 4x4 dots = 3x3 boxes
const TOTAL_LINES = 2 * GRID * (GRID - 1); // 24 lines

interface DBState {
    lines: Record<string, string>; // "h_0_0" => playerId
    boxes: Record<string, string>; // "0_0" => playerId
    scores: Record<string, number>;
}

interface GameSession {
    id: string;
    couple_id: string;
    game_type: string;
    board_state: DBState;
    current_turn: string;
    player_x: string;
    player_o: string | null;
    winner: string | null;
    status: 'waiting' | 'active' | 'finished' | 'ended';
    created_at: string;
}

const emptyState: DBState = { lines: {}, boxes: {}, scores: {} };

function parseSession(row: Database['public']['Tables']['game_sessions']['Row']): GameSession {
    const board = row.board_state;
    if (!board || typeof board !== 'object' || Array.isArray(board) ||
        !board.lines || !board.boxes || !board.scores ||
        !['waiting', 'active', 'finished', 'ended'].includes(row.status || '')) throw new Error('Invalid dots and boxes session');
    return { ...row, status: row.status as GameSession['status'], board_state: board as unknown as DBState };
}

const PARTNER_COLOR = '#06B6D4'; // cyan-500

const DotsBoxes: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { couple, partnerProfile } = useCouples();
    const { theme, primaryColor } = useTheme();
    const { openTutorial } = useTutorial();
    const isDark = theme === 'dark';

    const [game, setGame] = useState<GameSession | null>(null);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ isVisible: boolean; message: string; subMessage?: string; type: 'success' | 'error' }>({ isVisible: false, message: '', type: 'success' });
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
    const [ringCooldown, setRingCooldown] = useState(false);
    const ringCooldownRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    const showToast = (message: string, subMessage?: string, type: 'success' | 'error' = 'success') => {
        setToast({ isVisible: true, message, subMessage, type });
    };

    const isPlayer1 = game?.player_x === user?.id;
    const isMyTurn = game?.current_turn === user?.id && game?.status === 'active';

    const myScore = game?.board_state?.scores?.[user?.id || ''] || 0;
    const partnerId = game?.player_x === user?.id ? game?.player_o : game?.player_x;
    const partnerScore = partnerId ? (game?.board_state?.scores?.[partnerId] || 0) : 0;

    // Initials
    const myName = user?.name || user?.user_metadata?.full_name || user?.email || 'Y';
    const partnerName = partnerProfile?.full_name || 'P';
    const myInitial = myName.charAt(0).toUpperCase();
    const partnerInitial = partnerName.charAt(0).toUpperCase();

    const getPlayerColor = (playerId: string) => playerId === user?.id ? primaryColor : PARTNER_COLOR;
    const getPlayerInitial = (playerId: string) => playerId === user?.id ? myInitial : partnerInitial;

    /* ─── check if a line completes any box ─── */
    const checkBoxes = useCallback((lines: Record<string, string>, lineKey: string, playerId: string): string[] => {
        const completed: string[] = [];
        const [type, rStr, cStr] = lineKey.split('_');
        const r = parseInt(rStr), c = parseInt(cStr);

        if (type === 'h') {
            // box above: row r-1, col c
            if (r > 0) {
                const top = `h_${r - 1}_${c}`, left = `v_${r - 1}_${c}`, right = `v_${r - 1}_${c + 1}`;
                if (lines[top] && lines[left] && lines[right]) completed.push(`${r - 1}_${c}`);
            }
            // box below: row r, col c
            if (r < GRID - 1) {
                const bottom = `h_${r + 1}_${c}`, left = `v_${r}_${c}`, right = `v_${r}_${c + 1}`;
                if (lines[bottom] && lines[left] && lines[right]) completed.push(`${r}_${c}`);
            }
        } else {
            // box left: row r, col c-1
            if (c > 0) {
                const top = `h_${r}_${c - 1}`, bottom = `h_${r + 1}_${c - 1}`, left = `v_${r}_${c - 1}`;
                if (lines[top] && lines[bottom] && lines[left]) completed.push(`${r}_${c - 1}`);
            }
            // box right: row r, col c
            if (c < GRID - 1) {
                const top = `h_${r}_${c}`, bottom = `h_${r + 1}_${c}`, right = `v_${r}_${c + 1}`;
                if (lines[top] && lines[bottom] && lines[right]) completed.push(`${r}_${c}`);
            }
        }
        return completed;
    }, []);

    /* ─── init ─── */
    useEffect(() => {
        if (!couple?.id || !user?.id) return;
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const { data: existing } = await supabase
                    .from('game_sessions').select('*')
                    .eq('couple_id', couple.id).eq('game_type', 'dots_boxes')
                    .in('status', ['waiting', 'active'])
                    .order('created_at', { ascending: false }).limit(1).maybeSingle();
                if (cancelled) return;

                if (existing) {
                    if (existing.status === 'waiting' && existing.player_x !== user.id && !existing.player_o) {
                        const { data: updated } = await supabase
                            .from('game_sessions')
                            .update({ player_o: user.id, status: 'active' })
                            .eq('id', existing.id).select().single();
                        if (!cancelled && updated) {
                            setGame(parseSession(updated));
                            setTimeout(() => channelRef.current?.send({ type: 'broadcast', event: 'game_update', payload: updated }), 80);
                        }
                    } else {
                        if (!cancelled) setGame(parseSession(existing));
                    }
                } else {
                    const { data: created } = await (supabase
                        .from('game_sessions') as any).insert({
                            couple_id: couple.id, game_type: 'dots_boxes',
                            board_state: emptyState, current_turn: user.id,
                            player_x: user.id, player_o: null, winner: null, status: 'waiting'
                        }).select().single();
                    if (!cancelled && created) setGame(created);
                    if (created) sendGameNotification(couple, user.id, 'Dots & Boxes', '/games/dots-boxes', 'invite');
                }
            } catch (err) {
                console.error(err);
                if (!cancelled) showToast('Error', 'Failed to start game', 'error');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [couple?.id, user?.id]);

    /* ─── realtime ─── */
    useEffect(() => {
        if (!game?.id || !user?.id) return;
        const channel = supabase.channel(`game_rt_${game.id}`, { config: { private: true, broadcast: { self: false } } });
        channel.on('broadcast', { event: 'game_update' }, ({ payload }) => setGame(payload as GameSession));
        channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_sessions', filter: `id=eq.${game.id}` },
            (p) => { const u = p.new as GameSession; setGame(prev => {
                if (!prev) return u;
                const newLines = Object.keys(u.board_state.lines || {}).length;
                const prevLines = Object.keys(prev.board_state.lines || {}).length;
                // Accept resets (play again → 0 lines), status changes, or normal forward moves
                if (newLines === 0 || newLines >= prevLines || u.status !== prev.status) return u;
                return prev;
            }); });
        channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'game_sessions', filter: `id=eq.${game.id}` },
            () => { setGame(null); showToast('Game Ended', 'Your partner left'); });
        channel.subscribe();
        channelRef.current = channel;
        return () => { supabase.removeChannel(channel); channelRef.current = null; clearTimeout(ringCooldownRef.current); };
    }, [game?.id, user?.id]);

    /* ─── click line ─── */
    const handleLineClick = async (lineKey: string) => {
        if (!game || !user || !isMyTurn || game.board_state.lines[lineKey]) return;

        const newLines = { ...game.board_state.lines, [lineKey]: user.id };
        const newBoxes = { ...game.board_state.boxes };
        const newScores = { ...game.board_state.scores };
        const completed = checkBoxes(newLines, lineKey, user.id);
        completed.forEach(b => { newBoxes[b] = user.id; });
        if (completed.length > 0) newScores[user.id] = (newScores[user.id] || 0) + completed.length;

        const totalBoxes = (GRID - 1) * (GRID - 1);
        const filledBoxes = Object.keys(newBoxes).length;
        const isFinished = filledBoxes === totalBoxes;
        const otherPlayer = game.player_x === user.id ? game.player_o : game.player_x;

        // If completed a box, keep turn; otherwise switch
        const nextTurn = completed.length > 0 ? user.id : (otherPlayer || user.id);

        let winner: string | null = null;
        if (isFinished) {
            const entries = Object.entries(newScores);
            if (entries.length === 2) {
                winner = entries[0][1] > entries[1][1] ? entries[0][0] : entries[0][1] < entries[1][1] ? entries[1][0] : 'draw';
            } else {
                winner = entries[0]?.[0] || 'draw';
            }
        }

        const updates: Record<string, any> = {
            board_state: { lines: newLines, boxes: newBoxes, scores: newScores },
            current_turn: nextTurn,
            ...(isFinished ? { status: 'finished', winner } : {}),
        };

        const optimistic = { ...game, ...updates } as GameSession;
        setGame(optimistic);
        channelRef.current?.send({ type: 'broadcast', event: 'game_update', payload: optimistic });
        const { error } = await (supabase.from('game_sessions') as any).update(updates).eq('id', game.id);
        if (error) { setGame(game); showToast('Error', 'Move failed', 'error'); }
    };

    const handlePlayAgain = async () => {
        if (!game || !user) return;
        const newPx = game.player_o || user.id;
        const newPo = game.player_x;
        const reset = { board_state: emptyState, current_turn: newPx, player_x: newPx, player_o: newPo, winner: null, status: 'active' as const };
        const prev = game;
        const opt = { ...game, ...reset };
        setGame(opt);
        channelRef.current?.send({ type: 'broadcast', event: 'game_update', payload: opt });
        const { error } = await (supabase.from('game_sessions') as any).update(reset).eq('id', game.id);
        if (error) { setGame(prev); showToast('Error', 'Failed to restart', 'error'); }
    };

    const handleExit = async () => {
        try { if (game?.id) await endSession(game.id); } catch {}
        navigate('/games');
    };

    const getStatusText = () => {
        if (!game) return '';
        if (game.status === 'waiting') return 'Waiting for partner...';
        if (game.status === 'finished') {
            if (game.winner === 'draw') return "It's a draw! 🤝";
            return game.winner === user?.id ? 'You won! 🎉' : 'You lost! 💔';
        }
        return isMyTurn ? 'Your turn — draw a line!' : "Partner's turn";
    };

    /* ─── render ─── */
    const DOT_SIZE = 12;
    const CELL_SIZE = 60;
    const PADDING = 20;
    const svgSize = PADDING * 2 + (GRID - 1) * CELL_SIZE + DOT_SIZE;

    const dotX = (c: number) => PADDING + DOT_SIZE / 2 + c * CELL_SIZE;
    const dotY = (r: number) => PADDING + DOT_SIZE / 2 + r * CELL_SIZE;

    if (loading) {
        return (
            <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-background-dark' : 'bg-[#FDFCF8]'}`}>
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="w-10 h-10 rounded-full" style={{ borderWidth: 3, borderStyle: 'solid', borderColor: primaryColor, borderTopColor: 'transparent' }} />
            </div>
        );
    }

    if (!game || game.status === 'ended') {
        return <GameEndedScreen />;
    }

    const state = game.board_state || emptyState;

    return (
        <div className={`min-h-screen flex flex-col font-display transition-colors duration-300 ${isDark ? 'bg-background-dark text-white' : 'bg-[#FDFCF8] text-[#121014]'}`}>
            <header className={`flex items-center justify-between px-5 py-4 sticky top-0 z-20 backdrop-blur-sm border-b ${isDark ? 'bg-[#121014]/95 border-white/5' : 'bg-[#FDFCF8]/95 border-gray-100'}`}>
                <button onClick={handleExit} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10"><span className="material-symbols-outlined">arrow_back</span></button>
                <h1 className="text-lg font-bold">Dots & Boxes</h1>
                <div className="flex items-center">
                    <button
                        onClick={() => openTutorial('dots-boxes')}
                        className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 transition-all active:scale-90 mr-1"
                        title="Watch Tutorial"
                    >
                        <span className="material-symbols-outlined text-xl" style={{ color: primaryColor }}>play_circle</span>
                    </button>
                    <button
                        onClick={async () => {
                            if (!couple || !user || ringCooldown) return;
                            setRingCooldown(true);
                            await sendGameNotification(couple, user.id, 'Dots & Boxes', '/games/dots-boxes', 'ring');
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

            <main className="flex-1 flex flex-col items-center justify-center px-6 gap-6 pt-12 pb-24">
                {/* Scores */}
                <div className="flex items-center justify-center gap-6 w-full max-w-xs">
                    <div className={`flex flex-col items-center gap-1 flex-1 p-3 rounded-2xl ${isMyTurn && game.status === 'active' ? (isDark ? 'bg-white/10 ring-2' : 'bg-gray-100 ring-2') : ''}`}
                        style={isMyTurn && game.status === 'active' ? { '--tw-ring-color': primaryColor } as any : {}}>
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl font-black" style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}>{myScore}</div>
                        <span className="text-xs font-bold">{myInitial} · You</span>
                    </div>
                    <div className={`text-sm font-bold px-3 py-1 rounded-full ${isDark ? 'bg-white/5 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>VS</div>
                    <div className={`flex flex-col items-center gap-1 flex-1 p-3 rounded-2xl ${!isMyTurn && game.status === 'active' ? (isDark ? 'bg-white/10 ring-2' : 'bg-gray-100 ring-2') : ''}`}
                        style={!isMyTurn && game.status === 'active' ? { '--tw-ring-color': PARTNER_COLOR } as any : {}}>
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl font-black" style={{ backgroundColor: `${PARTNER_COLOR}20`, color: PARTNER_COLOR }}>{partnerScore}</div>
                        <span className="text-xs font-bold">{partnerInitial} · Partner</span>
                    </div>
                </div>

                {/* Status */}
                <motion.p key={getStatusText()} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                    className={`text-center font-bold text-lg ${game.status === 'finished' ? (game.winner === user?.id ? 'text-green-500' : game.winner === 'draw' ? 'text-yellow-500' : 'text-red-400') : ''}`}
                    style={isMyTurn && game.status === 'active' ? { color: primaryColor } : {}}>
                    {getStatusText()}
                </motion.p>

                {/* Board */}
                <div className={`rounded-3xl p-2 ${isDark ? 'bg-white/5' : 'bg-white shadow-lg border border-gray-100'}`}>
                    <svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`}>
                        {/* Completed boxes — solid fill + initial */}
                        {Object.entries(state.boxes).map(([key, owner]) => {
                            const [r, c] = key.split('_').map(Number);
                            const color = getPlayerColor(owner as string);
                            const initial = getPlayerInitial(owner as string);
                            const cx = dotX(c) + CELL_SIZE / 2;
                            const cy = dotY(r) + CELL_SIZE / 2;
                            return (
                                <g key={`box_${key}`}>
                                    <rect x={dotX(c)} y={dotY(r)} width={CELL_SIZE} height={CELL_SIZE} rx={8}
                                        fill={color} opacity={0.25} />
                                    <rect x={dotX(c) + 1} y={dotY(r) + 1} width={CELL_SIZE - 2} height={CELL_SIZE - 2} rx={7}
                                        fill="none" stroke={color} strokeWidth={1.5} opacity={0.5} />
                                    <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="central"
                                        fontSize={20} fontWeight="900" fill={color} opacity={0.75}>
                                        {initial}
                                    </text>
                                </g>
                            );
                        })}

                        {/* Horizontal lines */}
                        {Array.from({ length: GRID }, (_, r) =>
                            Array.from({ length: GRID - 1 }, (_, c) => {
                                const key = `h_${r}_${c}`;
                                const owner = state.lines[key];
                                const lineColor = owner ? getPlayerColor(owner) : null;
                                const canClick = isMyTurn && !owner;
                                return (
                                    <line key={key}
                                        x1={dotX(c) + DOT_SIZE / 2 + 2} y1={dotY(r)} x2={dotX(c + 1) - DOT_SIZE / 2 - 2} y2={dotY(r)}
                                        stroke={lineColor || (canClick ? (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)') : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'))}
                                        strokeWidth={owner ? 5 : 4} strokeLinecap="round"
                                        className={canClick ? 'cursor-pointer' : ''}
                                        style={canClick ? { filter: `drop-shadow(0 0 6px ${primaryColor}40)` } : {}}
                                        onClick={() => canClick && handleLineClick(key)}
                                    />
                                );
                            })
                        )}

                        {/* Vertical lines */}
                        {Array.from({ length: GRID - 1 }, (_, r) =>
                            Array.from({ length: GRID }, (_, c) => {
                                const key = `v_${r}_${c}`;
                                const owner = state.lines[key];
                                const lineColor = owner ? getPlayerColor(owner) : null;
                                const canClick = isMyTurn && !owner;
                                return (
                                    <line key={key}
                                        x1={dotX(c)} y1={dotY(r) + DOT_SIZE / 2 + 2} x2={dotX(c)} y2={dotY(r + 1) - DOT_SIZE / 2 - 2}
                                        stroke={lineColor || (canClick ? (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)') : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'))}
                                        strokeWidth={owner ? 5 : 4} strokeLinecap="round"
                                        className={canClick ? 'cursor-pointer' : ''}
                                        style={canClick ? { filter: `drop-shadow(0 0 6px ${primaryColor}40)` } : {}}
                                        onClick={() => canClick && handleLineClick(key)}
                                    />
                                );
                            })
                        )}

                        {/* Dots */}
                        {Array.from({ length: GRID }, (_, r) =>
                            Array.from({ length: GRID }, (_, c) => (
                                <circle key={`dot_${r}_${c}`} cx={dotX(c)} cy={dotY(r)} r={DOT_SIZE / 2}
                                    fill={isDark ? '#888' : '#555'} />
                            ))
                        )}
                    </svg>
                </div>

                {/* Waiting spinner */}
                {game.status === 'waiting' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-3">
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                            className="w-6 h-6 rounded-full" style={{ borderWidth: 2, borderStyle: 'solid', borderColor: primaryColor, borderTopColor: 'transparent' }} />
                        <p className="text-sm text-gray-400">Send your partner to Games → Dots & Boxes</p>
                    </motion.div>
                )}

                {/* Finished */}
                <AnimatePresence>
                    {game.status === 'finished' && (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-4 w-full max-w-xs">
                            <div className="text-5xl">{game.winner === user?.id ? '🏆' : game.winner === 'draw' ? '🤝' : '😢'}</div>
                            <button onClick={handlePlayAgain} className="w-full px-6 py-4 rounded-2xl font-bold text-white shadow-lg active:scale-95 transition-transform" style={{ backgroundColor: primaryColor }}>Play Again 🔄</button>
                            <button onClick={handleExit} className={`w-full px-6 py-3 rounded-2xl font-bold ${isDark ? 'bg-white/5 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>Exit Game</button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            <Toast message={toast.message} subMessage={toast.subMessage} isVisible={toast.isVisible} onClose={() => setToast(p => ({ ...p, isVisible: false }))} type={toast.type} />
        </div>
    );
};

export default DotsBoxes;
