import { AppIcon } from '../../components/ui/Icons';
import React, { useState, useEffect, useRef, useCallback } from 'react';
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

/* ─── emoji sets (algorithmically paired) ─── */
const EMOJI_POOLS = [
    ['🌹','💎','🦋','🌙','⭐','🔥','🍀','🎀','🌈','🐱','🐶','🎵','🍕','🎯','🚀','💜','🌸','🍩','🦄','🎪'],
    ['🌻','🍓','🐝','🪐','❄️','🌊','🎸','🍉','🦊','🐙','🎨','🏖️','🌺','🎂','🛸','💫','🧁','🦢','🎭','🍭'],
];

const GRID_SIZES = [
    { label: '4×3 (Easy)', cols: 4, rows: 3, pairs: 6 },
    { label: '4×4 (Medium)', cols: 4, rows: 4, pairs: 8 },
    { label: '5×4 (Hard)', cols: 5, rows: 4, pairs: 10 },
];

interface MemoryCard {
    id: number;
    emoji: string;
    flipped: boolean;
    matched: boolean;
}

interface MemoryState {
    cards: MemoryCard[];
    cols: number;
    rows: number;
    flippedIds: number[];        // currently face-up (max 2)
    currentTurn: string;
    matchedBy: Record<string, number>; // playerId → count
    phase: 'setup' | 'playing' | 'finished';
    scores: Record<string, number>;
    lastAction?: { playerId: string; cardIds: number[]; matched: boolean };
}

interface GameSession {
    id: string;
    couple_id: string;
    game_type: string;
    board_state: MemoryState;
    current_turn: string;
    player_x: string;
    player_o: string | null;
    winner: string | null;
    status: 'waiting' | 'active' | 'finished' | 'ended';
    created_at: string;
}

const shuffle = <T,>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
};

const buildCards = (pairCount: number): MemoryCard[] => {
    const pool = shuffle([...EMOJI_POOLS[0], ...EMOJI_POOLS[1]]);
    const selected = pool.slice(0, pairCount);
    const doubled = [...selected, ...selected];
    const shuffled = shuffle(doubled);
    return shuffled.map((emoji, i) => ({ id: i, emoji, flipped: false, matched: false }));
};

const emptyState = (): MemoryState => ({
    cards: [], cols: 4, rows: 4, flippedIds: [], currentTurn: '',
    matchedBy: {}, phase: 'setup', scores: {},
});

const MemoryMatch: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { couple } = useCouples();
    const { theme, primaryColor } = useTheme();
    const { openTutorial } = useTutorial();
    const isDark = theme === 'dark';

    const [game, setGame] = useState<GameSession | null>(null);
    const [loading, setLoading] = useState(true);
    const [localFlipped, setLocalFlipped] = useState<number[]>([]);
    const [checking, setChecking] = useState(false);
    const [toast, setToast] = useState<{ isVisible: boolean; message: string; subMessage?: string; type: 'success' | 'error' }>({ isVisible: false, message: '', type: 'success' });
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
    const matchTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    const [ringCooldown, setRingCooldown] = useState(false);
    const ringCooldownRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    const showToast = (m: string, s?: string, t: 'success' | 'error' = 'success') => setToast({ isVisible: true, message: m, subMessage: s, type: t });

    const state = game?.board_state;
    const isMyTurn = state?.currentTurn === user?.id;
    const partnerId = game ? (game.player_x === user?.id ? game.player_o : game.player_x) : null;

    /* ─── init ─── */
    useEffect(() => {
        if (!couple?.id || !user?.id) return;
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const { data: existing } = await (supabase.from('game_sessions') as any).select('*')
                    .eq('couple_id', couple.id).eq('game_type', 'memory_match')
                    .in('status', ['waiting', 'active']).order('created_at', { ascending: false }).limit(1).maybeSingle();
                if (cancelled) return;

                if (existing) {
                    if (existing.status === 'waiting' && existing.player_x !== user.id && !existing.player_o) {
                        const updatedState = { ...existing.board_state, scores: { [existing.player_x]: 0, [user.id]: 0 }, matchedBy: { [existing.player_x]: 0, [user.id]: 0 } };
                        const { data: updated } = await (supabase.from('game_sessions') as any)
                            .update({ player_o: user.id, status: 'active', board_state: updatedState }).eq('id', existing.id).select().single();
                        if (!cancelled && updated) { setGame(updated); setTimeout(() => channelRef.current?.send({ type: 'broadcast', event: 'game_update', payload: updated }), 80); }
                    } else { if (!cancelled) setGame(existing); }
                } else {
                    const initState = emptyState();
                    initState.scores = { [user.id]: 0 };
                    const { data: created } = await (supabase.from('game_sessions') as any).insert({
                        couple_id: couple.id, game_type: 'memory_match', board_state: initState,
                        current_turn: user.id, player_x: user.id, player_o: null, winner: null, status: 'waiting'
                    }).select().single();
                    if (!cancelled && created) setGame(created);
                    if (created) sendGameNotification(couple, user.id, 'Memory Match', '/games/memory', 'invite');
                }
            } catch (e) { console.error(e); if (!cancelled) showToast('Error', 'Failed to start', 'error'); }
            finally { if (!cancelled) setLoading(false); }
        })();
        return () => { cancelled = true; };
    }, [couple?.id, user?.id]);

    /* ─── realtime ─── */
    useEffect(() => {
        if (!game?.id || !user?.id) return;
        const ch = supabase.channel(`game_rt_${game.id}`, { config: { private: true, broadcast: { self: false } } });
        ch.on('broadcast', { event: 'game_update' }, ({ payload }) => { setGame(payload as GameSession); setLocalFlipped([]); });
        ch.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_sessions', filter: `id=eq.${game.id}` },
            (p) => { setGame(p.new as GameSession); setLocalFlipped([]); });
        ch.on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'game_sessions', filter: `id=eq.${game.id}` },
            () => { setGame(null); showToast('Game Ended', 'Partner left'); });
        ch.subscribe(); channelRef.current = ch;
        return () => { supabase.removeChannel(ch); channelRef.current = null; clearTimeout(ringCooldownRef.current); clearTimeout(matchTimerRef.current); };
    }, [game?.id, user?.id]);

    const broadcast = useCallback((updated: GameSession) => {
        setGame(updated);
        channelRef.current?.send({ type: 'broadcast', event: 'game_update', payload: updated });
        (supabase.from('game_sessions') as any).update({ board_state: updated.board_state, current_turn: updated.current_turn }).eq('id', updated.id);
    }, []);

    /* ─── start game (pick grid size) ─── */
    const startGame = (gridIdx: number) => {
        if (!game || !state || !user) return;
        const grid = GRID_SIZES[gridIdx];
        const cards = buildCards(grid.pairs);
        const newState: MemoryState = {
            ...state, cards, cols: grid.cols, rows: grid.rows,
            flippedIds: [], currentTurn: game.player_x!,
            matchedBy: { [game.player_x!]: 0, [game.player_o!]: 0 },
            phase: 'playing', scores: state.scores,
        };
        broadcast({ ...game, board_state: newState, current_turn: game.player_x! } as GameSession);
    };

    /* ─── flip a card ─── */
    const flipCard = (cardId: number) => {
        if (!game || !state || !user || !isMyTurn || checking) return;
        if (state.phase !== 'playing') return;
        const card = state.cards[cardId];
        if (!card || card.matched) return;
        if (localFlipped.includes(cardId) || state.flippedIds.includes(cardId)) return;

        const newFlipped = [...state.flippedIds, cardId];
        setLocalFlipped(prev => [...prev, cardId]);

        if (newFlipped.length === 2) {
            setChecking(true);
            // Broadcast the two flipped cards immediately so partner sees them
            const showState: MemoryState = { ...state, flippedIds: newFlipped };
            const showGame = { ...game, board_state: showState } as GameSession;
            setGame(showGame);
            channelRef.current?.send({ type: 'broadcast', event: 'game_update', payload: showGame });

            // After a delay, check match
            matchTimerRef.current = setTimeout(() => {
                const [id1, id2] = newFlipped;
                const c1 = state.cards[id1];
                const c2 = state.cards[id2];
                const matched = c1.emoji === c2.emoji;

                const newCards = state.cards.map(c => {
                    if (matched && (c.id === id1 || c.id === id2)) return { ...c, matched: true };
                    return c;
                });

                const newMatchedBy = { ...state.matchedBy };
                if (matched) {
                    newMatchedBy[user.id] = (newMatchedBy[user.id] || 0) + 1;
                }

                const allMatched = newCards.every(c => c.matched);
                const nextTurn = matched ? user.id : (partnerId || user.id); // extra turn on match

                const newScores = { ...state.scores };
                if (allMatched) {
                    // Winner is whoever matched more
                    const myMatches = newMatchedBy[user.id] || 0;
                    const theirMatches = newMatchedBy[partnerId || ''] || 0;
                    if (myMatches > theirMatches) newScores[user.id] = (newScores[user.id] || 0) + 1;
                    else if (theirMatches > myMatches) newScores[partnerId || ''] = (newScores[partnerId || ''] || 0) + 1;
                }

                const finalState: MemoryState = {
                    ...state,
                    cards: newCards,
                    flippedIds: [],
                    currentTurn: allMatched ? state.currentTurn : nextTurn,
                    matchedBy: newMatchedBy,
                    phase: allMatched ? 'finished' : 'playing',
                    scores: newScores,
                    lastAction: { playerId: user.id, cardIds: [id1, id2], matched },
                };

                const finalGame = { ...game, board_state: finalState, current_turn: nextTurn } as GameSession;
                broadcast(finalGame);
                setLocalFlipped([]);
                setChecking(false);
            }, 900);
        } else {
            // First card — broadcast immediately
            const showState: MemoryState = { ...state, flippedIds: newFlipped };
            broadcast({ ...game, board_state: showState } as GameSession);
        }
    };

    /* ─── new game ─── */
    const handleNewGame = () => {
        if (!game || !state) return;
        try {
            const newState: MemoryState = { ...emptyState(), scores: state.scores, phase: 'setup' };
            broadcast({ ...game, board_state: newState } as GameSession);
        } catch { /* broadcast handles errors internally */ }
    };

    const handleExit = async () => { try { if (game?.id) await endSession(game.id); } catch {} navigate('/games'); };

    if (loading) return <div className={`min-h-screen flex items-center justify-center bg-background-dark`}><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-10 h-10 rounded-full" style={{ borderWidth: 3, borderStyle: 'solid', borderColor: primaryColor, borderTopColor: 'transparent' }} /></div>;
    if (game?.status === 'ended') return <GameEndedScreen />;
    if (!game) return <GameEndedScreen />;

    const myScore = state?.scores?.[user?.id || ''] || 0;
    const partnerScore = partnerId ? (state?.scores?.[partnerId] || 0) : 0;
    const myMatches = state?.matchedBy?.[user?.id || ''] || 0;
    const partnerMatches = state?.matchedBy?.[partnerId || ''] || 0;
    const totalPairs = state?.cards ? state.cards.length / 2 : 0;

    return (
        <div className={`min-h-screen flex flex-col font-display transition-colors ${isDark ? 'bg-background-dark text-white' : 'bg-background-dark text-[var(--text-primary)]'}`}>
            <header className={`flex items-center justify-between px-5 py-4 sticky top-0 z-20 backdrop-blur-sm border-b ${isDark ? 'bg-background-dark/95 border-white/5' : 'bg-background-dark/95 border-gray-100'}`}>
                <button onClick={handleExit} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10"><span className="app-icon-glyph"><AppIcon name={"arrow_back"}/></span></button>
                <h1 className="text-lg font-bold">Memory Match</h1>
                <div className="flex items-center">
                    <button
                        onClick={() => openTutorial('memory')}
                        className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 transition-all active:scale-90 mr-1"
                        title="Watch Tutorial"
                    >
                        <span className="app-icon-glyph text-xl" style={{ color: primaryColor }}><AppIcon name={"play_circle"}/></span>
                    </button>
                    <button
                        onClick={async () => {
                            if (!couple || !user || ringCooldown) return;
                            setRingCooldown(true);
                            await sendGameNotification(couple, user.id, 'Memory Match', '/games/memory', 'ring');
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

            <main className="flex-1 flex flex-col items-center px-4 gap-4 pb-24 pt-12">
                {/* Scores */}
                <div className="flex items-center justify-center gap-6 w-full max-w-xs">
                    <div className="flex flex-col items-center gap-1">
                        <div className="text-2xl font-black" style={{ color: primaryColor }}>{myScore}</div>
                        <span className="text-xs font-bold">You ({myMatches} pairs)</span>
                    </div>
                    <div className={`text-sm font-bold px-3 py-1 rounded-full ${isDark ? 'bg-white/5 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>VS</div>
                    <div className="flex flex-col items-center gap-1">
                        <div className={`text-2xl font-black ${isDark ? 'text-pink-400' : 'text-pink-500'}`}>{partnerScore}</div>
                        <span className="text-xs font-bold">Partner ({partnerMatches} pairs)</span>
                    </div>
                </div>

                {/* Status Indicator */}
                {game.status === 'waiting' && <h2 className="text-lg font-bold text-center mt-2">Waiting for partner to join...</h2>}


                {/* Setup — pick grid size */}
                {state?.phase === 'setup' && game.status === 'active' && (
                    <div className="flex flex-col items-center gap-5 mt-4 w-full max-w-sm">
                        <p className="text-lg font-bold" style={{ color: primaryColor }}>Pick a grid size!</p>
                        {GRID_SIZES.map((g, i) => (
                            <button key={i} onClick={() => startGame(i)}
                                disabled={game.status !== 'active'}
                                className={`w-full py-4 rounded-2xl font-bold text-white active:scale-95 transition-transform ${game.status !== 'active' ? 'opacity-50 grayscale' : ''}`}
                                style={{ backgroundColor: primaryColor }}>
                                {g.label} — {g.pairs} pairs
                            </button>
                        ))}
                    </div>
                )}

                {/* Playing */}
                {(state?.phase === 'playing' || state?.phase === 'finished') && state?.cards?.length > 0 && (
                    <>
                        {/* Turn indicator */}
                        {state.phase === 'playing' && (
                            <motion.p key={state.currentTurn} initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                                className="text-sm font-bold" style={{ color: isMyTurn ? primaryColor : isDark ? '#f472b6' : '#ec4899' }}>
                                {isMyTurn ? 'Your turn! 👆' : "Partner's turn..."}
                            </motion.p>
                        )}

                        {/* Card grid */}
                        <div className="grid gap-2 w-full max-w-sm mx-auto"
                            style={{ gridTemplateColumns: `repeat(${state.cols}, 1fr)` }}>
                            {state.cards.map(card => {
                                const isFlipped = card.matched || state.flippedIds.includes(card.id) || localFlipped.includes(card.id);
                                return (
                                    <motion.button key={card.id}
                                        whileTap={isMyTurn && !card.matched && !isFlipped ? { scale: 0.9 } : {}}
                                        onClick={() => flipCard(card.id)}
                                        disabled={!isMyTurn || card.matched || isFlipped || checking || state.phase === 'finished'}
                                        className={`aspect-square rounded-xl text-2xl flex items-center justify-center font-bold transition-all relative overflow-hidden ${
                                            card.matched ? 'opacity-40' : ''
                                        }`}
                                        style={{
                                            perspective: '600px',
                                        }}>
                                        <motion.div
                                            initial={false}
                                            animate={{ rotateY: isFlipped ? 180 : 0 }}
                                            transition={{ duration: 0.35 }}
                                            className="w-full h-full relative"
                                            style={{ transformStyle: 'preserve-3d' }}>
                                            {/* Front (hidden) */}
                                            <div className={`absolute inset-0 rounded-xl flex items-center justify-center ${isDark ? 'bg-white/10' : 'bg-gray-200'}`}
                                                style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', border: isMyTurn && !card.matched ? `2px solid ${primaryColor}40` : '2px solid transparent' }}>
                                                <span className="text-xl opacity-30">?</span>
                                            </div>
                                            {/* Back (emoji) */}
                                            <div className={`absolute inset-0 rounded-xl flex items-center justify-center ${isDark ? 'bg-white/15' : 'bg-white'} shadow-md`}
                                                style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)', border: `2px solid ${primaryColor}40` }}>
                                                <span className="text-2xl sm:text-3xl">{card.emoji}</span>
                                            </div>
                                        </motion.div>
                                    </motion.button>
                                );
                            })}
                        </div>

                        {/* Finished */}
                        {state.phase === 'finished' && (
                            <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} className="flex flex-col items-center gap-3 text-center mt-2">
                                {myMatches > partnerMatches && <p className="text-xl font-bold text-green-500">You win! <AppIcon name={"🎉"}/></p>}
                                {partnerMatches > myMatches && <p className="text-xl font-bold text-red-400">Partner wins! <AppIcon name={"😅"}/></p>}
                                {myMatches === partnerMatches && <p className="text-xl font-bold text-yellow-500">It's a tie! <AppIcon name={"🤝"}/></p>}
                                <p className="text-sm text-gray-400">{myMatches} – {partnerMatches} pairs</p>
                                <div className="flex flex-col items-center gap-3 w-full max-w-xs mt-2">
                                    <button onClick={handleNewGame} className="on-brand w-full px-6 py-4 rounded-2xl font-bold text-white shadow-lg active:scale-95" style={{ backgroundColor: primaryColor }}>Play Again <AppIcon name={"🔄"}/></button>
                                    <button onClick={handleExit} className={`w-full px-6 py-3 rounded-2xl font-bold ${isDark ? 'bg-white/5 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>Exit Game</button>
                                </div>
                            </motion.div>
                        )}
                    </>
                )}
                {/* Waiting spinner */}
                {game.status === 'waiting' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-3 mt-8">
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                            className="w-10 h-10 rounded-full" style={{ borderWidth: 3, borderStyle: 'solid', borderColor: primaryColor, borderTopColor: 'transparent' }} />
                        <p className="text-sm text-gray-400">Send your partner to Games → Memory Match</p>
                    </motion.div>
                )}
            </main>

            <Toast message={toast.message} subMessage={toast.subMessage} isVisible={toast.isVisible} onClose={() => setToast(p => ({ ...p, isVisible: false }))} type={toast.type} />
        </div>
    );
};

export default MemoryMatch;
