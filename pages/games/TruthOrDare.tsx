import React, { useState, useEffect, useRef } from 'react';
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

interface TDItem {
    id: number;
    category: string;
    type: 'Truth' | 'Dare';
    question: string;
}

interface TDState {
    phase: 'setup' | 'playing';
    currentCard: TDItem | null;
    turn: string; // user_id
    history: number[];
    roundNumber: number;
    totalRounds: number | null; // null = unlimited
}

interface GameSession {
    id: string;
    couple_id: string;
    game_type: 'truth_dare';
    board_state: TDState;
    player_x: string;
    player_o: string | null;
    status: 'waiting' | 'active' | 'ended';
    updated_at: string;
}

const loadData = async (): Promise<TDItem[]> => {
    const res = await fetch('/Games_data/truth_or_dare.json');
    return await res.json();
};

const emptyState = (firstTurn: string): TDState => ({
    phase: 'setup',
    currentCard: null,
    turn: firstTurn,
    history: [],
    roundNumber: 0,
    totalRounds: null,
});

const TruthOrDare: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { couple } = useCouples();
    const { theme, primaryColor } = useTheme();
    const { openTutorial } = useTutorial();
    const isDark = theme === 'dark';

    // Local State
    const [items, setItems] = useState<TDItem[]>([]);
    const [session, setSession] = useState<GameSession | null>(null);
    const [loading, setLoading] = useState(true);
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
    const [ringCooldown, setRingCooldown] = useState(false);
    const ringCooldownRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    // Load Data
    useEffect(() => {
        loadData().then(setItems).catch(console.error);
    }, []);

    // Sync Game Session
    useEffect(() => {
        if (!user || !couple) {
            setLoading(false);
            return;
        }

        let cancelled = false;
        const fetchSession = async () => {
            setLoading(true);
            try {
                const { data, error } = await (supabase.from('game_sessions') as any)
                    .select('*')
                    .eq('couple_id', couple.id)
                    .eq('game_type', 'truth_dare')
                    .neq('status', 'ended')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (error) throw error;
                if (cancelled) return;

                if (data) {
                    if (data.player_x !== user.id && !data.player_o) {
                        const { data: updated } = await (supabase.from('game_sessions') as any)
                            .update({ player_o: user.id })
                            .eq('id', data.id)
                            .select()
                            .single();
                        if (!cancelled && updated) setSession(updated);
                    } else {
                        if (!cancelled) setSession(data);
                    }
                } else {
                    const newState = emptyState(user.id);
                    const { data: newSession, error: insErr } = await (supabase.from('game_sessions') as any)
                        .insert({
                            couple_id: couple.id,
                            game_type: 'truth_dare',
                            board_state: newState,
                            player_x: user.id,
                            player_o: null,
                            status: 'waiting'
                        })
                        .select()
                        .single();

                    if (insErr) throw insErr;
                    if (!cancelled && newSession) {
                        setSession(newSession);
                        sendGameNotification(couple, user.id, 'Truth or Dare', '/games/truth-dare', 'invite');
                    }
                }
            } catch (err) {
                console.error('TruthOrDare init error:', err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchSession();
        return () => { cancelled = true; };
    }, [user?.id, couple?.id]);

    // Realtime Sync
    useEffect(() => {
        if (!session?.id) return;

        const ch = supabase.channel(`game_td_${session.id}`, { config: { private: true } })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'game_sessions', filter: `id=eq.${session.id}` },
            (payload) => {
                const newSess = payload.new as GameSession;
                if (newSess && newSess.game_type === 'truth_dare') {
                    setSession(newSess);
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(ch);
            clearTimeout(ringCooldownRef.current);
        };
    }, [session?.id]);

    const updateState = async (updates: Partial<TDState>) => {
        if (!session) return;
        const newState = { ...session.board_state, ...updates };
        await (supabase.from('game_sessions') as any).update({ board_state: newState }).eq('id', session.id);
    };

    const startGameRounds = async (rounds: number | null) => {
        if (!session) return;
        const newState = { ...session.board_state, totalRounds: rounds, roundNumber: 0 };
        await (supabase.from('game_sessions') as any)
            .update({ status: 'active', board_state: newState })
            .eq('id', session.id);
    };

    const pickCard = async (type: 'Truth' | 'Dare') => {
        if (!session) return;
        const nextRound = (session.board_state.roundNumber || 0) + 1;
        const total = session.board_state.totalRounds;

        // Enforce round limit (fallback, normally handled in nextTurn)
        if (total && total > 0 && nextRound > total) {
            await (supabase.from('game_sessions') as any)
                .update({ status: 'ended', board_state: { ...session.board_state, currentCard: null } })
                .eq('id', session.id);
            return;
        }

        const available = items.filter(i => i.type === type && !session.board_state.history.includes(i.id));
        const pool = available.length > 0 ? available : items.filter(i => i.type === type);
        const card = pool[Math.floor(Math.random() * pool.length)];

        updateState({
            currentCard: card,
            history: [...session.board_state.history, card.id],
            phase: 'playing',
            roundNumber: nextRound,
        });
    };

    const nextTurn = async () => {
        if (!session || !couple || !user) return;

        try {
            const { board_state } = session;
            // Only the current turn's player can advance
            if (board_state.turn && board_state.turn !== user.id) return;

            if (board_state.totalRounds && board_state.totalRounds > 0 && (board_state.roundNumber || 0) >= board_state.totalRounds) {
                 await (supabase.from('game_sessions') as any)
                    .update({ status: 'ended', board_state: { ...board_state, currentCard: null } })
                    .eq('id', session.id);
                return;
            }

            const nextPlayer = session.player_x === user.id
                ? (session.player_o || user.id)
                : session.player_x;

            updateState({
                currentCard: null,
                phase: 'setup',
                turn: nextPlayer
            });
        } catch { /* updateState handles errors internally */ }
    };

    if (loading || !session) return (
        <div className="flex h-screen items-center justify-center">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-10 h-10 rounded-full" style={{ borderWidth: 3, borderStyle: 'solid', borderColor: primaryColor, borderTopColor: 'transparent' }} />
        </div>
    );

    if (session?.status === 'ended') return <GameEndedScreen />;

    const { board_state } = session;
    const isMyTurn = board_state.turn === user?.id;
    const isCreator = session.player_x === user?.id;
    const partnerPresent = !!session.player_o;

    return (
        <div className={`min-h-screen flex flex-col ${isDark ? 'bg-background-dark text-white' : 'bg-gray-50 text-gray-900'}`}>
             {/* Header */}
             <div className={`p-4 flex items-center justify-between border-b ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                <button onClick={async () => { try { if (session?.id) await endSession(session.id); } catch {} navigate('/games'); }} className="p-2 -ml-2 rounded-full hover:bg-white/10 active:scale-95 transition-transform">
                    <span className="material-symbols-outlined text-2xl">arrow_back</span>
                </button>
                <h1 className="text-lg font-bold">Truth or Dare</h1>
                <div className="flex items-center">
                    <button
                        onClick={() => openTutorial('truth-dare')}
                        className="p-2 mr-1 rounded-full hover:bg-white/10 active:scale-95 transition-transform"
                        title="Watch Tutorial"
                    >
                        <span className="material-symbols-outlined text-2xl" style={{ color: primaryColor }}>play_circle</span>
                    </button>
                    <button
                        onClick={async () => {
                            if (!couple || !user || ringCooldown) return;
                            setRingCooldown(true);
                            await sendGameNotification(couple, user.id, 'Truth or Dare', '/games/truth-dare', 'ring');
                            ringCooldownRef.current = setTimeout(() => setRingCooldown(false), 30000);
                        }}
                        disabled={ringCooldown}
                        className={`p-2 rounded-full transition-all ${ringCooldown ? 'opacity-30' : 'hover:bg-white/10 active:scale-90'}`}
                        title="Ring Partner"
                    >
                        <span className="material-symbols-outlined text-2xl">{ringCooldown ? 'notifications_off' : 'notifications_active'}</span>
                    </button>
                </div>
            </div>

            <main className="flex-1 p-6 pt-12 flex flex-col items-center justify-center max-w-md mx-auto w-full">
                {session.status === 'waiting' ? (
                    /* ── WAITING PHASE ── */
                    <div className="w-full">
                        {isCreator ? (
                            <div className="text-center">
                                {board_state.totalRounds === null || board_state.totalRounds === undefined ? (
                                    /* Round selection */
                                    <>
                                        <h2 className="text-3xl font-bold mb-2">Choose rounds</h2>
                                        <p className="opacity-60 mb-6">Select how many rounds you'd like to play.</p>
                                        <div className="flex gap-3 justify-center flex-wrap mb-4">
                                            {[5, 10, 15].map(n => (
                                                <button key={n} onClick={() => startGameRounds(n)}
                                                    className="px-8 py-4 rounded-2xl font-bold text-lg shadow-lg transition-all active:scale-95 text-white hover:brightness-110"
                                                    style={{ backgroundColor: primaryColor }}>
                                                    {n}
                                                </button>
                                            ))}
                                            <button onClick={() => startGameRounds(0)}
                                                className="px-8 py-4 rounded-2xl font-bold text-lg shadow-lg transition-all active:scale-95 text-white hover:brightness-110"
                                                style={{ backgroundColor: primaryColor }}>
                                                ∞
                                            </button>
                                        </div>
                                        <p className="text-sm opacity-50 mb-6">The game creator chooses the number of rounds.</p>
                                    </>
                                ) : (
                                    /* Rounds chosen — waiting for partner */
                                    <>
                                        <p className="text-sm mb-2 opacity-60">Rounds: <span className="font-bold" style={{ color: primaryColor }}>{board_state.totalRounds === 0 ? '∞ Unlimited' : board_state.totalRounds}</span></p>
                                    </>
                                )}
                                <div className="flex flex-col items-center gap-3 mt-6">
                                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                                        className="w-12 h-12 rounded-full" style={{ borderWidth: 4, borderStyle: 'solid', borderColor: primaryColor, borderTopColor: 'transparent' }} />
                                    <p className="text-lg font-bold">Waiting for partner to join...</p>
                                    <p className="text-sm text-gray-400">Send your partner to Games → Truth or Dare</p>
                                </div>
                            </div>
                        ) : (
                            /* Partner waiting for creator */
                            <div className="text-center py-12">
                                <h2 className="text-2xl font-bold mb-4">Waiting for creator</h2>
                                <p className="opacity-60 mb-8">The creator hasn't started the game yet.</p>
                                <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                                    className="w-10 h-10 rounded-full mx-auto" style={{ borderWidth: 3, borderStyle: 'solid', borderColor: primaryColor, borderTopColor: 'transparent' }} />
                            </div>
                        )}
                    </div>
                ) : (
                    /* ── ACTIVE PHASE ── */
                    <>
                        {/* Round indicator dots — only for finite rounds */}
                        {board_state.totalRounds && board_state.totalRounds > 0 && (board_state.roundNumber || 0) > 0 && (
                            <div className="flex gap-1.5 items-center mb-4">
                                {Array.from({ length: board_state.totalRounds }).map((_, i) => (
                                    <div key={i} className={`w-2.5 h-2.5 rounded-full transition-all ${i + 1 === (board_state.roundNumber || 0) ? 'scale-125' : ''}`}
                                        style={{ backgroundColor: i < (board_state.roundNumber || 0) ? primaryColor : isDark ? '#333' : '#ddd' }} />
                                ))}
                            </div>
                        )}

                        <AnimatePresence mode="wait">
                            {board_state.currentCard ? (
                                <motion.div
                                    key="card"
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.9, opacity: 0 }}
                                    className={`w-full p-8 rounded-3xl text-center shadow-xl mb-8 relative overflow-hidden ${
                                        board_state.currentCard.type === 'Truth'
                                            ? 'bg-gradient-to-br from-blue-500 to-cyan-600 text-white'
                                            : 'bg-gradient-to-br from-rose-500 to-red-600 text-white'
                                    }`}
                                >
                                    <div className="absolute left-4 top-4 text-xs text-white/60">Round {board_state.roundNumber || 0}{board_state.totalRounds && board_state.totalRounds > 0 ? ` / ${board_state.totalRounds}` : ''}</div>
                                    <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-medium mb-4 inline-block">
                                        {board_state.currentCard.type.toUpperCase()}
                                    </span>
                                    <h2 className="text-2xl font-bold mb-4">{board_state.currentCard.question}</h2>
                                    <p className="text-white/80 text-sm">{board_state.currentCard.category}</p>
                                </motion.div>
                            ) : (
                                <div className="text-center mb-12">
                                    <motion.div
                                        className="text-6xl mb-4"
                                        animate={{ rotate: [0, 10, -10, 0] }}
                                        transition={{ repeat: Infinity, duration: 2 }}
                                    >
                                        🎲
                                    </motion.div>
                                    <h2 className="text-xl font-medium opacity-80">
                                        {isMyTurn ? "It's your turn!" : "Waiting for partner..."}
                                    </h2>
                                </div>
                            )}
                        </AnimatePresence>

                        {isMyTurn && !board_state.currentCard && partnerPresent && (
                            <div className="flex gap-4 w-full">
                                <button
                                    onClick={() => pickCard('Truth')}
                                    className="on-brand flex-1 py-4 rounded-2xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-lg shadow-lg active:scale-95 transition-transform"
                                >
                                    Truth
                                </button>
                                <button
                                    onClick={() => pickCard('Dare')}
                                    className="on-brand flex-1 py-4 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-lg shadow-lg active:scale-95 transition-transform"
                                >
                                    Dare
                                </button>
                            </div>
                        )}

                        {board_state.currentCard && (
                            <button
                                onClick={nextTurn}
                                 className={`w-full px-6 py-4 rounded-2xl font-bold shadow-lg transition-transform active:scale-95 ${
                                    isDark ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-200 hover:bg-gray-300'
                                }`}
                            >
                                {board_state.totalRounds && board_state.totalRounds > 0 && (board_state.roundNumber || 0) >= board_state.totalRounds ? 'Finish Game 🏆' : 'Next Turn'}
                            </button>
                        )}
                    </>
                )}
            </main>
        </div>
    );
};

export default TruthOrDare;
