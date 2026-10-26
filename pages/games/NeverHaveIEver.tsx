import { AppIcon } from '../../components/ui/Icons';
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useCouples } from '../../contexts/CouplesContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useTutorial } from '../../contexts/TutorialContext';
import { sendGameNotification } from '../../lib/notifications';
import GameEndedScreen from '../../components/GameEndedScreen';
import { endSession } from '../../lib/gameSessions';

interface NHIEItem {
    id: number;
    category: string;
    statement: string;
}

interface NHIEState {
    phase: 'idle' | 'reveal';
    currentCard: NHIEItem | null;
    turn: string;
    history: number[];
    responses: Record<string, boolean | null>;
    scores: Record<string, number>;
    roundNumber: number;
    totalRounds: number | null; // null = unlimited
}

interface GameSession {
    id: string;
    couple_id: string;
    game_type: 'never_have_i_ever';
    board_state: NHIEState;
    player_x: string;
    player_o: string | null;
    status: 'waiting' | 'active' | 'ended';
    updated_at: string;
}

const loadData = async (): Promise<NHIEItem[]> => {
    const res = await fetch('/Games_data/never_have_i_ever.json');
    return await res.json();
};

const emptyState = (firstTurn: string): NHIEState => ({
    phase: 'idle',
    currentCard: null,
    turn: firstTurn,
    history: [],
    responses: {},
    scores: {},
    roundNumber: 0,
    totalRounds: null,
});

const CATEGORY_COLORS: Record<string, string> = {
    Fun: 'from-amber-500 to-yellow-500',
    Romantic: 'from-pink-500 to-rose-500',
    Spicy: 'from-red-500 to-orange-500',
    Embarrassing: 'from-purple-500 to-fuchsia-500',
    Adventure: 'from-emerald-500 to-teal-500',
    Deep: 'from-indigo-500 to-blue-500',
    Couple: 'from-rose-400 to-pink-500',
    Random: 'from-cyan-500 to-sky-500',
};

const NeverHaveIEver: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { couple } = useCouples();
    const { theme, primaryColor } = useTheme();
    const { openTutorial } = useTutorial();
    const isDark = theme === 'dark';

    const [items, setItems] = useState<NHIEItem[]>([]);
    const [session, setSession] = useState<GameSession | null>(null);
    const [loading, setLoading] = useState(true);
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
    const [ringCooldown, setRingCooldown] = useState(false);
    const ringCooldownRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    const [showResult, setShowResult] = useState(false);

    useEffect(() => {
        loadData().then(setItems).catch(console.error);
    }, []);

    // Initialize session
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
                    .eq('game_type', 'never_have_i_ever')
                    .neq('status', 'ended')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (error) {
                    console.error('[NHIE] Supabase select error:', error.message, error.code, error.details);
                    throw error;
                }
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
                    const insertRes: any = await (supabase.from('game_sessions') as any)
                        .insert({
                            couple_id: couple.id,
                            game_type: 'never_have_i_ever',
                            board_state: newState,
                            player_x: user.id,
                            player_o: null,
                            status: 'waiting'
                        })
                        .select()
                        .single();

                    const { data: newSession, error: insErr } = insertRes || {};
                    if (insErr) {
                        console.error('[NHIE] Supabase insert error:', insErr.message, insErr.code, insErr.details);
                        throw insErr;
                    }
                    if (!cancelled && newSession) {
                        setSession(newSession);
                        sendGameNotification(couple, user.id, 'Never Have I Ever', '/games/never-have-i-ever', 'invite');
                    }
                }
            } catch (err) {
                console.error('Failed to fetch/create session:', err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchSession();
        return () => { cancelled = true; };
    }, [user?.id, couple?.id]);

    // Subscribe to session updates
    useEffect(() => {
        if (!session?.id) return;

        const ch = supabase.channel(`game_nhie_${session.id}`, { config: { private: true } })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'game_sessions', filter: `id=eq.${session.id}` },
            (payload) => {
                const newSess = payload.new as GameSession;
                if (newSess && newSess.game_type === 'never_have_i_ever') {
                    setSession(newSess);
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(ch);
            clearTimeout(ringCooldownRef.current);
        };
    }, [session?.id]);

    const updateState = async (updates: Partial<NHIEState>) => {
        if (!session) return;
        const newState = { ...session.board_state, ...updates };
        // @ts-ignore - Supabase generated types don't include dynamic game_type columns
        await supabase.from('game_sessions').update({ board_state: newState } as any).eq('id', session.id);
    };

    const startGameRounds = async (rounds: number | null) => {
        if (!session) return;
        const newState = { ...session.board_state, totalRounds: rounds, roundNumber: 0 };
        await (supabase.from('game_sessions') as any)
            .update({ status: 'active', board_state: newState })
            .eq('id', session.id);
    };

    const drawCard = () => {
        if (!session || items.length === 0) return;
        try {
            const available = items.filter(i => !session.board_state.history.includes(i.id));
            const pool = available.length > 0 ? available : items;
            const card = pool[Math.floor(Math.random() * pool.length)];

            updateState({
                currentCard: card,
                history: [...session.board_state.history, card.id],
                phase: 'reveal',
                responses: {},
                roundNumber: session.board_state.roundNumber + 1,
            });
        } catch { /* updateState handles errors internally */ }
    };

    const respond = (answer: boolean) => {
        if (!session || !user) return;
        const newResponses = { ...session.board_state.responses, [user.id]: answer };
        updateState({ responses: newResponses });
    };

    const nextRound = async () => {
        if (!session || items.length === 0) return;
        const bs = session.board_state;
        const total = bs.totalRounds;
        const nextRoundNum = (bs.roundNumber || 0) + 1;

        // Enforce round limit
        if (total && total > 0 && nextRoundNum > total) {
            await (supabase.from('game_sessions') as any)
                .update({ status: 'ended', board_state: { ...bs, currentCard: null } })
                .eq('id', session.id);
            return;
        }

        const remaining = items.filter(i => !bs.history.includes(i.id));
        const pool = remaining.length > 0 ? remaining : items;
        const nextCard = pool[Math.floor(Math.random() * pool.length)];

        await updateState({
            roundNumber: nextRoundNum,
            responses: {},
            currentCard: nextCard,
            history: [...bs.history, nextCard.id],
            phase: 'reveal',
        });
        setShowResult(false);
    };

    const board_state = session?.board_state;

    const isMyTurn = board_state?.turn === user?.id; // This is not used for drawing cards anymore
    const myResponse = user ? board_state?.responses?.[user.id] : null;
    const partnerId = session?.player_x === user?.id ? session?.player_o : session?.player_x;
    const partnerResponse = (partnerId && board_state?.responses) ? board_state.responses[partnerId] : null;
    const bothAnswered = myResponse !== null && myResponse !== undefined && partnerResponse !== null && partnerResponse !== undefined;

    // Auto-show result when both have answered
    useEffect(() => {
        if (bothAnswered && !showResult) {
            const timer = setTimeout(() => setShowResult(true), 500);
            return () => clearTimeout(timer);
        }
    }, [bothAnswered]);

    // Reset local showResult when a new card is drawn by someone else
    useEffect(() => {
        if (!bothAnswered) {
            setShowResult(false);
        }
    }, [board_state?.currentCard?.id]);

    if (loading) return (
        <div className="flex h-screen items-center justify-center">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-10 h-10 rounded-full" style={{ borderWidth: 3, borderStyle: 'solid', borderColor: primaryColor, borderTopColor: 'transparent' }} />
        </div>
    );

    if (session?.status === 'ended') return <GameEndedScreen />;

    if (!session || !board_state) {
        return (
            <div className="flex h-screen items-center justify-center flex-col px-4">
                <p className="mb-4 text-center">Could not load game session. Please check the console for errors or try retrying.</p>
                <div className="flex gap-2">
                    <button
                        onClick={async () => {
                            setLoading(true);
                            try {
                                const { data, error } = await (supabase.from('game_sessions') as any)
                                    .select('*')
                                    .eq('couple_id', couple?.id)
                                    .eq('game_type', 'never_have_i_ever')
                                    .neq('status', 'ended')
                                    .order('created_at', { ascending: false })
                                    .limit(1)
                                    .maybeSingle();
                                if (error) console.error('Refetch error:', error.message, error.code, error.details);
                                else if (data) setSession(data);
                                else console.warn('No session found on refetch');
                            } catch (e) {
                                console.error('Refetch exception', e);
                            } finally {
                                setLoading(false);
                            }
                        }}
                        className="px-4 py-2 rounded bg-violet-500 text-white"
                    >
                        Retry
                    </button>
                    <button onClick={async () => { try { if (session?.id) await endSession(session.id); } catch {} navigate('/games'); }} className="px-4 py-2 rounded border">
                        Back
                    </button>
                </div>
            </div>
        );
    }


    const gradient = board_state.currentCard ? (CATEGORY_COLORS[board_state.currentCard.category] || 'from-violet-500 to-purple-600') : 'from-violet-500 to-purple-600';
    const partnerPresent = !!session?.player_o;
    const isCreator = session.player_x === user?.id;

    return (
        <div className={`min-h-screen flex flex-col ${isDark ? 'bg-background-dark text-white' : 'bg-gray-50 text-gray-900'}`}>
            {/* Header */}
            <div className={`p-4 flex items-center justify-between border-b ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                <button onClick={async () => { try { if (session?.id) await endSession(session.id); } catch {} navigate('/games'); }} className="p-2 -ml-2 rounded-full hover:bg-white/10 active:scale-95 transition-transform">
                    <span className="app-icon-glyph text-2xl"><AppIcon name={"arrow_back"}/></span>
                </button>
                <h1 className="text-lg font-bold">Never Have I Ever</h1>
                <div className="flex items-center">
                    <button
                        onClick={() => openTutorial('never-have-i-ever')}
                        className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 transition-all active:scale-90 mr-1"
                        title="Watch Tutorial"
                    >
                        <span className="app-icon-glyph text-xl" style={{ color: primaryColor }}><AppIcon name={"play_circle"}/></span>
                    </button>
                    <button
                        onClick={async () => {
                            if (!couple || !user || ringCooldown) return;
                            setRingCooldown(true);
                            await sendGameNotification(couple, user.id, 'Never Have I Ever', '/games/never-have-i-ever', 'ring');
                            ringCooldownRef.current = setTimeout(() => setRingCooldown(false), 30000);
                        }}
                        disabled={ringCooldown}
                        className={`p-2 rounded-full transition-all ${ringCooldown ? 'opacity-30' : 'hover:bg-white/10 active:scale-90'}`}
                        title="Ring Partner"
                    >
                        <span className="app-icon-glyph text-2xl"><AppIcon name={ringCooldown ? 'notifications_off' : 'notifications_active'}/></span>
                    </button>
                </div>
            </div>

            {/* Score Bar — only show when active */}
            {session.status !== 'waiting' && (
                <div className={`px-4 py-2 flex items-center justify-center gap-6 text-sm ${isDark ? 'bg-white/5' : 'bg-gray-100'}`}>
                    <span className="font-medium">Round {board_state.roundNumber}{board_state.totalRounds && board_state.totalRounds > 0 ? ` / ${board_state.totalRounds}` : ''}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${isDark ? 'bg-white/10' : 'bg-gray-200'}`}>
                        {board_state.history.length} played
                    </span>
                </div>
            )}

            <main className="flex-1 p-6 flex flex-col items-center justify-center max-w-md mx-auto w-full">
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
                                    <p className="text-sm text-gray-400">Send your partner to Games → Never Have I Ever</p>
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
                                    key={`card-${board_state.currentCard.id}`}
                                    initial={{ scale: 0.8, opacity: 0, rotateY: -90 }}
                                    animate={{ scale: 1, opacity: 1, rotateY: 0 }}
                                    exit={{ scale: 0.8, opacity: 0, rotateY: 90 }}
                                    transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                                    className="w-full mb-8"
                                >
                                    {/* Card */}
                                    <div className={`w-full p-8 rounded-3xl text-center shadow-2xl bg-gradient-to-br ${gradient} text-white relative overflow-hidden`}>
                                        {/* Decorative circles */}
                                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full" />
                                        <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-white/10 rounded-full" />

                                        <div className="absolute left-4 top-4 text-xs text-white/60">Round {board_state.roundNumber}{board_state.totalRounds && board_state.totalRounds > 0 ? ` / ${board_state.totalRounds}` : ''}</div>
                                        <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-medium mb-4 inline-block relative z-10">
                                            {board_state.currentCard.category}
                                        </span>
                                        <h2 className="text-2xl font-bold mb-2 relative z-10 leading-relaxed">
                                            {board_state.currentCard.statement}
                                        </h2>
                                    </div>

                                    {/* Response buttons */}
                                    {myResponse === null || myResponse === undefined ? (
                                        <motion.div
                                            initial={{ y: 20, opacity: 0 }}
                                            animate={{ y: 0, opacity: 1 }}
                                            transition={{ delay: 0.3 }}
                                            className="flex gap-4 mt-6"
                                        >
                                            <div className="flex-1">
                                                <button
                                                    onClick={() => respond(true)}
                                                    className="on-brand w-full py-4 rounded-2xl text-white font-bold text-lg shadow-lg active:scale-95 transition-transform bg-gradient-to-r from-green-500 to-emerald-600"
                                                >

                                                    <AppIcon name={"✋"}/> I Have
                                                </button>
                                            </div>
                                            <div className="flex-1">
                                                <button
                                                    onClick={() => respond(false)}
                                                    className="on-brand w-full py-4 rounded-2xl text-white font-bold text-lg shadow-lg active:scale-95 transition-transform bg-gradient-to-r from-blue-500 to-indigo-600"
                                                >

                                                    <AppIcon name={"😇"}/> Never
                                                </button>
                                            </div>
                                        </motion.div>
                                    ) : !showResult ? (
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="mt-6 text-center"
                                        >
                                            <div className="flex items-center justify-center gap-2">
                                                <motion.div
                                                    className="w-3 h-3 rounded-full bg-violet-400"
                                                    animate={{ scale: [1, 1.3, 1] }}
                                                    transition={{ repeat: Infinity, duration: 0.8 }}
                                                />
                                                <p className="opacity-70 font-medium">
                                                    {bothAnswered ? 'Revealing...' : 'Waiting for partner...'}
                                                </p>
                                            </div>
                                            <p className={`mt-2 text-sm px-3 py-1 rounded-full inline-block ${isDark ? 'bg-white/10' : 'bg-gray-200'}`}>
                                                You answered: {myResponse ? '✋ I Have' : '😇 Never'}
                                            </p>
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            initial={{ scale: 0.9, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            className="mt-6"
                                        >
                                            <div className={`p-6 rounded-2xl ${isDark ? 'bg-white/10' : 'bg-white shadow-lg'}`}>
                                                <div className="flex justify-around mb-4">
                                                    <div className="text-center">
                                                        <p className="text-sm opacity-60 mb-1">You</p>
                                                        <p className="text-2xl">{myResponse ? '✋' : '😇'}</p>
                                                        <p className="text-sm font-medium mt-1">{myResponse ? 'I Have' : 'Never'}</p>
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="text-sm opacity-60 mb-1">Partner</p>
                                                        <p className="text-2xl">{partnerResponse ? '✋' : '😇'}</p>
                                                        <p className="text-sm font-medium mt-1">{partnerResponse ? 'I Have' : 'Never'}</p>
                                                    </div>
                                                </div>
                                                <div className={`text-center py-2 rounded-xl font-bold ${
                                                    myResponse === partnerResponse
                                                        ? 'bg-green-500/20 text-green-400'
                                                        : 'bg-orange-500/20 text-orange-400'
                                                }`}>
                                                    {myResponse === partnerResponse ? '🎉 You matched!' : '😮 Different answers!'}
                                                </div>
                                            </div>

                                            <button
                                                onClick={nextRound}
                                                className="on-brand w-full mt-4 py-4 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-bold shadow-lg active:scale-95 transition-transform"
                                            >
                                                {board_state.totalRounds && board_state.totalRounds > 0 && (board_state.roundNumber || 0) >= board_state.totalRounds ? 'Finish Game 🏆' : 'Next Statement →'}
                                            </button>
                                        </motion.div>
                                    )}
                                </motion.div>
                            ) : (
                                // START VIEW — only when active and no card drawn
                                <motion.div
                                    key="start"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    className="text-center w-full"
                                >
                                    <motion.div
                                        className="text-7xl mb-6"
                                        animate={{ rotate: [0, -10, 10, -10, 0] }}
                                        transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                                    >

                                        <AppIcon name={"🙅"}/>
                                    </motion.div>
                                    <h2 className="text-2xl font-bold mb-2">Never Have I Ever</h2>
                                    <p className="opacity-60 mb-8">
                                        Ready to play? Someone draw a statement!
                                    </p>

                                    <button
                                        onClick={drawCard}
                                        disabled={!partnerPresent}
                                        className={`w-full py-4 rounded-2xl text-white font-bold text-lg shadow-lg active:scale-95 transition-transform ${partnerPresent ? 'bg-gradient-to-r from-violet-500 to-indigo-600' : 'bg-gray-600/40 cursor-not-allowed opacity-70'}`}
                                    >

                                        <AppIcon name={"🂴"}/> Draw Statement
                                    </button>

                                    {!partnerPresent && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="mt-6 flex flex-col items-center gap-3"
                                        >
                                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                                                className="w-10 h-10 rounded-full" style={{ borderWidth: 3, borderStyle: 'solid', borderColor: primaryColor, borderTopColor: 'transparent' }} />
                                            <p className="text-lg font-bold">Waiting for partner to join...</p>
                                            <p className="text-sm text-gray-400">Send your partner to Games → Party → Never Have I Ever</p>
                                        </motion.div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </>
                )}
            </main>
        </div>
    );
};

export default NeverHaveIEver;
