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
import { toJson } from '../../lib/json';
import type { Database } from '../../lib/database.types';

interface LTItem {
    id: number;
    category: string;
    question: string;
}

interface LTState {
    currentCard: LTItem | null;
    history: number[];
    answers?: { player_x?: string; player_o?: string };
    isRevealed?: boolean;
    revealRequestedAt?: string | null;
    roundNumber?: number; // 1-based
    totalRounds?: number | null;
}

interface GameSession {
    id: string;
    couple_id: string;
    game_type: 'love_trivia';
    board_state: LTState;
    created_at: string;
    status: 'waiting' | 'active' | 'ended';
    player_x: string;
    player_o: string | null;
}

function parseSession(row: Database['public']['Tables']['game_sessions']['Row']): GameSession {
    const state = row.board_state;
    if (!state || typeof state !== 'object' || Array.isArray(state) || !Array.isArray(state.history) ||
        !state.history.every(id => typeof id === 'number') || row.game_type !== 'love_trivia' ||
        !['waiting', 'active', 'ended'].includes(row.status || '')) throw new Error('Invalid trivia session');
    return { ...row, game_type: 'love_trivia', status: row.status as GameSession['status'], board_state: state as unknown as LTState };
}

const loadData = async (): Promise<LTItem[]> => {
    const res = await fetch('/Games_data/love_trivia.json');
    return await res.json();
};

const emptyState = (): LTState => ({
    currentCard: null,
    history: [],
    answers: {},
    isRevealed: false,
    revealRequestedAt: null,
    roundNumber: 0,
    totalRounds: null,
});

const LoveTrivia: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { couple } = useCouples();
    const { theme, primaryColor } = useTheme();
    const { openTutorial } = useTutorial();
    const isDark = theme === 'dark';

    const [items, setItems] = useState<LTItem[]>([]);
    const [session, setSession] = useState<GameSession | null>(null);
    const [loading, setLoading] = useState(true);
    const [ringCooldown, setRingCooldown] = useState(false);
    const ringCooldownRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    const countdownIvRef = useRef<ReturnType<typeof setInterval>>(undefined);
    const advanceTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    const [myAnswer, setMyAnswer] = useState('');
    const [countdown, setCountdown] = useState<number | null>(null);

    useEffect(() => { loadData().then(setItems).catch(console.error); }, []);

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
                const { data, error } = await supabase.from('game_sessions')
                    .select('*')
                    .eq('couple_id', couple.id)
                    .eq('game_type', 'love_trivia')
                    .neq('status', 'ended')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (error) throw error;
                if (cancelled) return;

                if (data) {
                    // Join logic
                    if (data.player_x !== user.id && !data.player_o) {
                        const { data: updated } = await supabase.from('game_sessions')
                            .update({ player_o: user.id })
                            .eq('id', data.id)
                            .select()
                            .single();
                        if (!cancelled && updated) setSession(parseSession(updated));
                    } else {
                        if (!cancelled) setSession(parseSession(data));
                    }
                } else {
                    const newState = emptyState();
                    const { data: newSession, error: insErr } = await supabase.from('game_sessions')
                        .insert({
                            couple_id: couple.id,
                            game_type: 'love_trivia',
                            board_state: toJson(newState),
                            player_x: user.id,
                            player_o: null,
                            status: 'waiting'
                        })
                        .select()
                        .single();

                    if (insErr) throw insErr;
                    if (!cancelled && newSession) {
                        setSession(parseSession(newSession));
                        sendGameNotification(couple, user.id, 'Love Trivia', '/games/trivia', 'invite');
                        // Do not auto-pick a card here. The creator must choose rounds
                        // via `startGameRounds` so we avoid starting the game unexpectedly.
                    }
                }
            } catch (err) {
                console.error('LoveTrivia init error:', err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchSession();
        return () => { cancelled = true; };
    }, [user?.id, couple?.id, items.length > 0]);

    // Realtime Sync
    useEffect(() => {
        if (!session?.id) return;

        const ch = supabase.channel(`game_lt_${session.id}`, { config: { private: true } })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'game_sessions', filter: `id=eq.${session.id}` },
            (payload) => {
                const newSess = payload.new as GameSession;
                if (newSess && newSess.game_type === 'love_trivia') {
                    setSession(newSess);
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(ch);
            clearTimeout(ringCooldownRef.current);
            clearInterval(countdownIvRef.current);
            clearTimeout(advanceTimerRef.current);
        };
    }, [session?.id]);

    // Auto-draw first card when session becomes active and rounds are chosen but no card yet
    useEffect(() => {
        if (
            session?.status === 'active' &&
            !session.board_state.currentCard &&
            session.board_state.totalRounds !== null &&
            session.board_state.totalRounds !== undefined &&
            items.length > 0
        ) {
            pickNewCard(session.board_state, items, session.id);
        }
    }, [session?.status, session?.board_state?.currentCard, items.length]);

    const pickNewCard = async (currentState: LTState, itemList: LTItem[], sessionId?: string) => {
        const idToUpdate = sessionId || session?.id;
        if (!idToUpdate) return null;

        // If totalRounds is set and we've already completed them, end the session
        const total = currentState.totalRounds || null;
        const nextRound = (currentState.roundNumber || 0) + 1;
        if (total && nextRound > total) {
            const { data } = await (supabase.from('game_sessions') as any)
                .update({ status: 'ended', board_state: { ...currentState, currentCard: null } })
                .eq('id', idToUpdate)
                .select()
                .single();
            return data || null;
        }

        const available = itemList.filter(i => !currentState.history.includes(i.id));
        const pool = available.length > 0 ? available : itemList;
        const nextCard = pool[Math.floor(Math.random() * pool.length)];

        const newState: LTState = {
            ...currentState,
            currentCard: nextCard,
            history: [...currentState.history, nextCard.id],
            roundNumber: nextRound,
            answers: {},
            isRevealed: false,
            revealRequestedAt: null,
            totalRounds: currentState.totalRounds ?? null,
        };

        const { data } = await (supabase.from('game_sessions') as any)
            .update({ board_state: newState })
            .eq('id', idToUpdate)
            .select()
            .single();

        return data || null;
    };

    const nextCard = () => {
        if (!session) return;
        try {
            pickNewCard(session.board_state, items);
        } catch { /* pickNewCard handles errors internally */ }
    };

    const startGameRounds = async (rounds: number | null) => {
        if (!session) return;
        const newBoard = { ...(session.board_state || {}), totalRounds: rounds, roundNumber: 0, answers: {}, isRevealed: false, revealRequestedAt: null } as LTState;
        const { data: updated, error } = await (supabase.from('game_sessions') as any)
            .update({ status: 'active', board_state: newBoard })
            .eq('id', session.id)
            .select()
            .single();
        if (error) { console.error('startGameRounds error', error); return; }
        if (updated) setSession(updated);
    };

    const submitAnswer = async (text: string) => {
        if (!session || !user) return;
        const role = session.player_x === user.id ? 'player_x' : 'player_o';
        const newBoard: LTState = { ...(session.board_state || {}), answers: { ...(session.board_state.answers || {}), [role]: text } } as LTState;

        const { data: updated, error } = await (supabase.from('game_sessions') as any)
            .update({ board_state: newBoard })
            .eq('id', session.id)
            .select()
            .single();

        if (error) { console.error('submitAnswer error', error); return; }
        if (updated) setSession(updated);

        setMyAnswer(text);

        // notify partner that this player has submitted an answer
        try {
            if (couple && user) {
                await sendGameNotification(couple, user.id, 'Love Trivia', '/games/trivia', 'partner_answered');
            }
        } catch (nErr) {
            console.error('notify partner error', nErr);
        }

        const bothAnswered = newBoard.answers && newBoard.answers.player_x && newBoard.answers.player_o;
        if (bothAnswered && !newBoard.revealRequestedAt) {
            const revealAt = new Date().toISOString();
            const { data: revUpdated, error: revErr } = await (supabase.from('game_sessions') as any)
                .update({ board_state: { ...(newBoard), revealRequestedAt: revealAt } })
                .eq('id', session.id)
                .select()
                .single();

            if (revErr) { console.error('reveal request error', revErr); return; }
            if (revUpdated) setSession(revUpdated);

            // start local countdown and reveal
            setCountdown(3);
            let t = 3;
            clearInterval(countdownIvRef.current);
            clearTimeout(advanceTimerRef.current);
            const iv = setInterval(() => {
                t -= 1;
                setCountdown(t > 0 ? t : 0);
                if (t <= 0) {
                    clearInterval(iv);
                    countdownIvRef.current = undefined;
                    (async () => {
                        const { data: rUpdated } = await (supabase.from('game_sessions') as any)
                            .update({ board_state: { ...(newBoard), isRevealed: true } })
                            .eq('id', session.id)
                            .select()
                            .single();

                        if (rUpdated) setSession(rUpdated);

                        // after reveal, advance automatically (or end if rounds complete)
                        advanceTimerRef.current = setTimeout(async () => {
                            const next = await pickNewCard((rUpdated.board_state as LTState), items, session.id);
                            if (next) setSession(next);
                        }, 1600);
                    })();
                }
            }, 1000);
            countdownIvRef.current = iv;
        }
    };

    const prevRoundRef = useRef<number | null>(null);

    // keep local input and countdown in sync with session (handles reconnection)
    // IMPORTANT: do not overwrite the user's in-progress typing — only sync when
    // a stored answer exists for this role or when the round changes.
    useEffect(() => {
        if (!session || !user) {
            setMyAnswer('');
            setCountdown(null);
            prevRoundRef.current = null;
            return;
        }
        const role = session.player_x === user.id ? 'player_x' : 'player_o';
        const stored = session.board_state.answers?.[role];

        // If the round changed, clear local draft and accept stored (if any)
        const currentRound = session.board_state.roundNumber || 0;
        if (prevRoundRef.current !== currentRound) {
            prevRoundRef.current = currentRound;
            setMyAnswer(stored ?? '');
        } else if (stored !== undefined && stored !== myAnswer) {
            // only overwrite local input when a stored answer exists for this role
            setMyAnswer(stored);
        }

        const revAt = session.board_state.revealRequestedAt;
        if (revAt) {
            const started = new Date(revAt).getTime();
            const now = Date.now();
            const elapsed = Math.floor((now - started) / 1000);
            let t = Math.max(0, 3 - elapsed);
            setCountdown(t);
            if (t > 0) {
                const iv = setInterval(() => {
                    t -= 1;
                    setCountdown(t > 0 ? t : 0);
                    if (t <= 0) clearInterval(iv);
                }, 1000);
                return () => clearInterval(iv);
            }
        } else {
            setCountdown(null);
        }
    }, [session, user, myAnswer]);

    if (loading) return (
        <div className="flex h-screen items-center justify-center">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-10 h-10 rounded-full" style={{ borderWidth: 3, borderStyle: 'solid', borderColor: primaryColor, borderTopColor: 'transparent' }} />
        </div>
    );

    if (session?.status === 'ended') return <GameEndedScreen />;

    if (!session) {
        return (
            <div className="flex h-screen items-center justify-center flex-col px-4">
                <p className="mb-4 text-center">Could not load game session. Please try retrying or go back.</p>
                <div className="flex gap-2">
                    <button onClick={async () => { try { if (session?.id) await endSession(session.id); } catch {} navigate('/games'); }} className="px-4 py-2 rounded border">Back</button>
                </div>
            </div>
        );
    }

    const { currentCard } = session.board_state;


    const isCreator = session.player_x === user?.id;
    const hasPartner = !!session.player_o;

    return (
        <div className={`min-h-screen flex flex-col ${isDark ? 'bg-background-dark text-white' : 'bg-gray-50 text-gray-900'}`}>
            <div className={`p-4 flex items-center justify-between border-b ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                <button onClick={async () => { try { if (session?.id) await endSession(session.id); } catch {} navigate('/games'); }} className="p-2 -ml-2 rounded-full hover:bg-white/10 active:scale-95 transition-transform">
                    <span className="material-symbols-outlined text-2xl">arrow_back</span>
                </button>
                <h1 className="text-lg font-bold">Love Trivia</h1>
                <div className="flex items-center">
                    <button
                        onClick={() => openTutorial('trivia')}
                        className="p-2 mr-1 rounded-full hover:bg-white/10 active:scale-95 transition-transform"
                        title="Watch Tutorial"
                    >
                        <span className="material-symbols-outlined text-2xl" style={{ color: primaryColor }}>play_circle</span>
                    </button>
                    <button
                        onClick={async () => {
                            if (!couple || !user || ringCooldown) return;
                            setRingCooldown(true);
                            await sendGameNotification(couple, user.id, 'Love Trivia', '/games/trivia', 'ring');
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

            <main className="flex-1 p-6 pt-12 flex flex-col justify-center items-center max-w-md mx-auto w-full">
                {session.status === 'waiting' ? (
                    /* ── WAITING PHASE ── */
                    <div className="w-full">
                        {isCreator ? (
                            <div className="text-center">
                                {session.board_state.totalRounds === null || session.board_state.totalRounds === undefined ? (
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
                                            <button onClick={() => startGameRounds(null)}
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
                                        <p className="text-sm mb-2 opacity-60">Rounds: <span className="font-bold" style={{ color: primaryColor }}>{session.board_state.totalRounds ?? '∞ Unlimited'}</span></p>
                                    </>
                                )}
                                <div className="flex flex-col items-center gap-3 mt-6">
                                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                                        className="w-12 h-12 rounded-full" style={{ borderWidth: 4, borderStyle: 'solid', borderColor: primaryColor, borderTopColor: 'transparent' }} />
                                    <p className="text-lg font-bold">Waiting for partner to join...</p>
                                    <p className="text-sm text-gray-400">Send your partner to Games → Love Trivia</p>
                                </div>
                                <div className="flex gap-3 justify-center mt-8">
                                    <button
                                        onClick={async () => {
                                            if (!couple || !user || ringCooldown) return;
                                            setRingCooldown(true);
                                            await sendGameNotification(couple, user.id, 'Love Trivia', '/games/trivia', 'ring');
                                            ringCooldownRef.current = setTimeout(() => setRingCooldown(false), 30000);
                                        }}
                                        disabled={ringCooldown}
                                        className={`on-brand px-4 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-500 text-white font-bold transition-all active:scale-95 ${ringCooldown ? 'opacity-50' : ''}`}
                                    >
                                        🔔 Ring Partner
                                    </button>
                                    <button onClick={async () => { try { if (session?.id) await endSession(session.id); } catch {} navigate('/games'); }} className="px-6 py-3 rounded-2xl border border-gray-200 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition-all">
                                        Back
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* Partner waiting for creator to start */
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
                        {!currentCard ? (
                            /* First card not yet drawn — auto-draw */
                            <div className="flex flex-col items-center gap-4">
                                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                                    className="w-10 h-10 rounded-full" style={{ borderWidth: 3, borderStyle: 'solid', borderColor: primaryColor, borderTopColor: 'transparent' }} />
                                <p className="text-sm opacity-60">Starting game...</p>
                            </div>
                        ) : (
                            <>
                                {/* Round indicator dots */}
                                {session.board_state.totalRounds && (
                                    <div className="flex gap-1.5 items-center mb-4">
                                        {Array.from({ length: session.board_state.totalRounds }).map((_, i) => (
                                            <div key={i} className={`w-2.5 h-2.5 rounded-full transition-all ${i + 1 === (session.board_state.roundNumber || 0) ? 'scale-125' : ''}`}
                                                style={{ backgroundColor: i < (session.board_state.roundNumber || 0) ? primaryColor : isDark ? '#333' : '#ddd' }} />
                                        ))}
                                    </div>
                                )}

                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={currentCard.id}
                                        initial={{ rotateY: 90, opacity: 0 }}
                                        animate={{ rotateY: 0, opacity: 1 }}
                                        exit={{ rotateY: -90, opacity: 0 }}
                                        className="on-brand w-full aspect-[3/4] max-h-[500px] rounded-3xl shadow-2xl p-8 flex flex-col items-center justify-center text-center relative bg-gradient-to-br from-pink-500 to-rose-600 text-white"
                                    >
                                        <span className="bg-white/20 px-4 py-1 rounded-full text-sm font-medium mb-6">
                                            {currentCard.category}
                                        </span>
                                        <h2 className="text-3xl font-extrabold leading-tight mb-6">{currentCard.question}</h2>

                                        <div className="absolute left-6 top-6 text-sm text-white/80">Round {session.board_state.roundNumber || 0}{session.board_state.totalRounds ? ` / ${session.board_state.totalRounds}` : ''}</div>
                                        {countdown !== null && <div className="absolute right-6 top-6 text-2xl font-bold">{countdown > 0 ? countdown : '...'}</div>}

                                        <div className="mt-6 text-sm opacity-80">Type your answer below the card and tap <span className="font-bold">Submit Answer</span>.</div>
                                    </motion.div>
                                </AnimatePresence>

                                {/* Answer input & controls */}
                                <div className="w-full mt-8">
                                    {!session.board_state.isRevealed ? (
                                        (() => {
                                            const myRole = session.player_x === user?.id ? 'player_x' : 'player_o';
                                            const partnerRole = myRole === 'player_x' ? 'player_o' : 'player_x';
                                            const iSubmitted = !!session.board_state.answers?.[myRole];
                                            const partnerSubmitted = !!session.board_state.answers?.[partnerRole];
                                            return (
                                                <>
                                                    {/* Partner answered first — alert the current user */}
                                                    {!iSubmitted && partnerSubmitted && (
                                                        <motion.div
                                                            initial={{ scale: 0.9, opacity: 0 }}
                                                            animate={{ scale: 1, opacity: 1 }}
                                                            className="mb-4 px-4 py-3 rounded-2xl text-center font-bold text-sm"
                                                            style={{ backgroundColor: `${primaryColor}22`, color: primaryColor, border: `1.5px solid ${primaryColor}55` }}
                                                        >
                                                            💬 Your partner has answered — choose your answer!
                                                        </motion.div>
                                                    )}

                                                    <div className="mb-2 text-sm opacity-60">Your Answer</div>
                                                    <input
                                                        value={myAnswer}
                                                        onChange={e => setMyAnswer(e.target.value)}
                                                        className={`w-full px-4 py-3 rounded-2xl mb-3 outline-none transition-all ${isDark ? 'bg-white/10 text-white placeholder-white/40' : 'bg-gray-100 text-gray-900 placeholder-gray-400'} ${iSubmitted ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                        placeholder="Type your answer..."
                                                        disabled={iSubmitted || !!countdown}
                                                    />

                                                    {!iSubmitted ? (
                                                        <button
                                                            onClick={() => submitAnswer(myAnswer)}
                                                            disabled={!myAnswer || !!countdown}
                                                            className="w-full px-6 py-3 rounded-2xl font-bold text-white shadow-lg transition-all active:scale-95 mb-3"
                                                            style={{ backgroundColor: myAnswer ? primaryColor : isDark ? '#444' : '#ccc', opacity: myAnswer ? 1 : 0.5 }}>
                                                            Submit Answer
                                                        </button>
                                                    ) : (
                                                        <motion.div
                                                            initial={{ y: 10, opacity: 0 }}
                                                            animate={{ y: 0, opacity: 1 }}
                                                            className="w-full px-4 py-3 rounded-2xl text-center font-bold mb-3"
                                                            style={{ backgroundColor: '#10b98122', color: '#10b981', border: '1.5px solid #10b98155' }}
                                                        >
                                                            ✓ Your answer submitted
                                                        </motion.div>
                                                    )}

                                                    {/* Partner status */}
                                                    <div
                                                        className="w-full px-4 py-2.5 rounded-2xl text-center text-sm font-medium flex items-center justify-center gap-2"
                                                        style={{
                                                            backgroundColor: partnerSubmitted
                                                                ? '#10b98118'
                                                                : isDark ? `${primaryColor}15` : `${primaryColor}12`,
                                                            color: partnerSubmitted
                                                                ? '#10b981'
                                                                : primaryColor,
                                                            border: `1px solid ${partnerSubmitted ? '#10b98140' : `${primaryColor}30`}`
                                                        }}
                                                    >
                                                        {partnerSubmitted ? (
                                                            <>✓ Partner has answered</>
                                                        ) : (
                                                            <>
                                                                <motion.span
                                                                    animate={{ opacity: [0.4, 1, 0.4] }}
                                                                    transition={{ duration: 1.5, repeat: Infinity }}
                                                                >●</motion.span>
                                                                Waiting for partner...
                                                            </>
                                                        )}
                                                    </div>

                                                    <div className="text-xs opacity-40 mt-3 text-center">Both players submit an answer, then a 3…2…1 countdown reveals the answers.</div>
                                                </>
                                            );
                                        })()
                                    ) : (
                                        <div className="p-6 rounded-2xl bg-white/5 text-center">
                                            <div className="mb-4 text-sm text-gray-400">Revealed answers</div>
                                            <div className="flex gap-4 justify-around mb-4">
                                                <div className="text-center">
                                                    <div className="text-xs opacity-60">You</div>
                                                    <div className="font-bold mt-1">{session.board_state.answers?.[ session.player_x === user?.id ? 'player_x' : 'player_o' ] || '-'}</div>
                                                </div>
                                                <div className="text-center">
                                                    <div className="text-xs opacity-60">Partner</div>
                                                    <div className="font-bold mt-1">{session.board_state.answers?.[ session.player_x === user?.id ? 'player_o' : 'player_x' ] || '-'}</div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </>
                )}
            </main>
        </div>
    );
};

export default LoveTrivia;
