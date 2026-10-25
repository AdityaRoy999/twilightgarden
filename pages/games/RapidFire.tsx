import React, { useState, useEffect, useRef, useCallback } from 'react';
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

interface RFItem {
    id: number;
    category: string;
    question: string;
}

interface RFState {
    phase: 'lobby' | 'countdown' | 'playing' | 'review' | 'finished';
    currentIndex: number;
    questions: RFItem[];
    answers: Record<string, Record<number, string>>; // user_id -> { questionIndex: answer }
    turn: string;
    roundQuestions: number; // how many Qs per round
    timePerQ: number; // seconds per question
    timerStartedAt: string | null;
}

interface GameSession {
    id: string;
    couple_id: string;
    game_type: 'rapid_fire';
    board_state: RFState;
    player_x: string;
    player_o: string | null;
    status: 'waiting' | 'active' | 'ended';
    updated_at: string;
}

const loadData = async (): Promise<RFItem[]> => {
    const res = await fetch('/Games_data/rapid_fire.json');
    return await res.json();
};

const ROUNDS = 10;
const TIME_PER_Q = 8; // seconds

const emptyState = (firstTurn: string, questions: RFItem[]): RFState => {
    const shuffled = [...questions].sort(() => Math.random() - 0.5).slice(0, ROUNDS);
    return {
        phase: 'lobby',
        currentIndex: 0,
        questions: shuffled,
        answers: {},
        turn: firstTurn,
        roundQuestions: ROUNDS,
        timePerQ: TIME_PER_Q,
        timerStartedAt: null,
    };
};

const CATEGORY_EMOJI: Record<string, string> = {
    Preferences: '⚡',
    Personal: '💭',
    Hypothetical: '🔮',
    Couple: '💕',
    Wild: '🔥',
    Deep: '🌊',
    Speed: '⏱️',
};

const RapidFire: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { couple } = useCouples();
    const { theme, primaryColor } = useTheme();
    const { openTutorial } = useTutorial();
    const isDark = theme === 'dark';

    const [allItems, setAllItems] = useState<RFItem[]>([]);
    const [session, setSession] = useState<GameSession | null>(null);
    const [loading, setLoading] = useState(true);
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
    const [ringCooldown, setRingCooldown] = useState(false);
    const ringCooldownRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    const [timer, setTimer] = useState(TIME_PER_Q);
    const [answer, setAnswer] = useState('');
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadData().then(setAllItems).catch(console.error);
    }, []);

    // Sync Game Session
    useEffect(() => {
        if (!user || !couple) {
            setLoading(false);
            return;
        }

        // (removed accidental JSX here)

        let cancelled = false;
        const fetchSession = async () => {
            setLoading(true);
            // Only proceed if allItems are loaded
            if (allItems.length === 0) {
                if (!cancelled) setLoading(false);
                return;
            }

            try {
                const { data, error } = await (supabase.from('game_sessions') as any)
                    .select('*')
                    .eq('couple_id', couple.id)
                    .eq('game_type', 'rapid_fire')
                    .neq('status', 'ended')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (error) throw error;
                if (cancelled) return;

                if (data) {
                    if (data.player_x !== user.id && !data.player_o) {
                        const { data: updated } = await (supabase.from('game_sessions') as any)
                            .update({ player_o: user.id, status: 'active' })
                            .eq('id', data.id)
                            .select()
                            .single();
                        if (!cancelled && updated) setSession(updated);
                    } else {
                        if (!cancelled) setSession(data);
                    }
                } else {
                    const newState = emptyState(user.id, allItems);
                    const { data: newSession, error: insErr } = await (supabase.from('game_sessions') as any)
                        .insert({
                            couple_id: couple.id,
                            game_type: 'rapid_fire',
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
                        sendGameNotification(couple, user.id, 'Rapid Fire', '/games/rapid-fire', 'invite');
                    }
                }
            } catch (err) {
                console.error('RapidFire init error:', err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchSession();
        return () => { cancelled = true; };
    }, [user?.id, couple?.id, allItems.length > 0]);

    // Realtime Sync
    useEffect(() => {
        if (!session?.id) return;

        const ch = supabase.channel(`game_rf_${session.id}`, { config: { private: true } })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'game_sessions', filter: `id=eq.${session.id}` },
            (payload) => {
                const newSess = payload.new as GameSession;
                if (newSess && newSess.game_type === 'rapid_fire') {
                    setSession(newSess);
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(ch);
            clearTimeout(ringCooldownRef.current);
        };
    }, [session?.id]);

    const updateState = async (updates: Partial<RFState>) => {
        if (!session) return;
        const newState = { ...session.board_state, ...updates };
        // @ts-ignore - Supabase generated types don't include dynamic game_type columns
        await (supabase.from('game_sessions') as any).update({ board_state: newState }).eq('id', session.id);
    };

    // Timer logic
    useEffect(() => {
        if (!session) return;
        const { phase } = session.board_state;
        const isMyTurn = session.board_state.turn === user?.id;

        if (phase === 'playing' && isMyTurn) {
            setTimer(TIME_PER_Q);
            setAnswer('');
            if (inputRef.current) inputRef.current.focus();

            timerRef.current = setInterval(() => {
                setTimer(prev => {
                    if (prev <= 1) {
                        // Time's up — auto submit
                        submitAnswer('⏰ (time up)');
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [session?.board_state.phase, session?.board_state.currentIndex, session?.board_state.turn]);

    const submitAnswer = useCallback((overrideAnswer?: string) => {
        if (!session || !user) return;
        if (timerRef.current) clearInterval(timerRef.current);

        const ans = overrideAnswer || answer || '(skipped)';
        const newAnswers = {
            ...session.board_state.answers,
            [user.id]: {
                ...(session.board_state.answers[user.id] || {}),
                [session.board_state.currentIndex]: ans,
            },
        };

        const nextIndex = session.board_state.currentIndex + 1;
        if (nextIndex >= session.board_state.questions.length) {
            updateState({ answers: newAnswers, phase: 'review', currentIndex: nextIndex });
        } else {
            updateState({ answers: newAnswers, currentIndex: nextIndex });
        }
        setAnswer('');
    }, [session, user, answer]);

    const startGame = () => {
        if (!session || allItems.length === 0 || !user) return;
        const shuffled = [...allItems].sort(() => Math.random() - 0.5).slice(0, ROUNDS);
        updateState({
            phase: 'playing',
            questions: shuffled,
            currentIndex: 0,
            answers: {},
            turn: user.id,
            timerStartedAt: new Date().toISOString(),
        });
    };

    const switchTurn = () => {
        if (!session || !user) return;
        const nextPlayer = session.player_x === user.id ? (session.player_o || user.id) : session.player_x;
        const shuffled = [...allItems].sort(() => Math.random() - 0.5).slice(0, ROUNDS);
        updateState({
            phase: 'playing',
            questions: shuffled,
            currentIndex: 0,
            turn: nextPlayer,
            timerStartedAt: new Date().toISOString(),
        });
    };

    const newGame = () => {
        if (!session || allItems.length === 0 || !user) return;
        try {
            const newState = emptyState(user.id, allItems);
            updateState(newState);
        } catch { /* updateState handles errors internally */ }
    };

    if (session?.status === 'ended') return <GameEndedScreen />;

    if (loading || !session) return (
        <div className="flex h-screen items-center justify-center">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-10 h-10 rounded-full" style={{ borderWidth: 3, borderStyle: 'solid', borderColor: primaryColor, borderTopColor: 'transparent' }} />
        </div>
    );

    const { board_state } = session;
    const isMyTurn = board_state.turn === user?.id;
    const partnerPresent = !!session.player_o;
    const currentQ = board_state.questions[board_state.currentIndex];
    const progress = board_state.questions.length > 0 ? ((board_state.currentIndex) / board_state.questions.length) * 100 : 0;
    const timerPercent = (timer / TIME_PER_Q) * 100;
    const timerColor = timer > 5 ? 'bg-green-500' : timer > 2 ? 'bg-yellow-500' : 'bg-red-500';

    return (
        <div className={`min-h-screen flex flex-col ${isDark ? 'bg-[#121014] text-white' : 'bg-gray-50 text-gray-900'}`}>
            {/* Header */}
            <div className={`p-4 flex items-center justify-between border-b ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                <button onClick={async () => { try { if (session?.id) await endSession(session.id); } catch {} navigate('/games'); }} className="p-2 -ml-2 rounded-full hover:bg-white/10 active:scale-95 transition-transform">
                    <span className="material-symbols-outlined text-2xl">arrow_back</span>
                </button>
                <h1 className="text-lg font-bold">⚡ Rapid Fire</h1>
                <button
                    onClick={async () => {
                        if (!couple || !user || ringCooldown) return;
                        setRingCooldown(true);
                        await sendGameNotification(couple, user.id, 'Rapid Fire', '/games/rapid-fire', 'ring');
                        ringCooldownRef.current = setTimeout(() => setRingCooldown(false), 30000);
                    }}
                    disabled={ringCooldown}
                    className={`p-2 rounded-full transition-all ${ringCooldown ? 'opacity-30' : 'hover:bg-white/10 active:scale-90'}`}
                >
                    <span className="material-symbols-outlined text-2xl">{ringCooldown ? 'notifications_off' : 'notifications_active'}</span>
                </button>
            </div>

            <main className="flex-1 p-6 flex flex-col items-center justify-center max-w-md mx-auto w-full">
                {session.status === 'waiting' ? (
                    <div className="flex-1 flex flex-col items-center justify-center w-full">
                        <h2 className="text-2xl font-bold mb-8 text-center">Waiting for partner to join...</h2>
                        <div className="flex flex-col items-center gap-6">
                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                                className="w-12 h-12 rounded-full" style={{ borderWidth: 4, borderStyle: 'solid', borderColor: primaryColor, borderTopColor: 'transparent' }} />
                            <p className="text-gray-400">Send your partner to Games → Rapid Fire</p>
                        </div>
                    </div>
                ) : (
                    <AnimatePresence mode="wait">
                        {/* LOBBY */}
                        {board_state.phase === 'lobby' && (
                            <motion.div key="lobby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center w-full">
                                <motion.div
                                    className="text-7xl mb-6"
                                    animate={{ scale: [1, 1.1, 1] }}
                                    transition={{ repeat: Infinity, duration: 1.5 }}
                                >
                                    ⚡
                                </motion.div>
                                <h2 className="text-2xl font-bold mb-2">Rapid Fire!</h2>
                                <p className="opacity-60 mb-2">{ROUNDS} questions • {TIME_PER_Q}s each</p>
                                <p className="opacity-40 text-sm mb-8">Answer as fast as you can — no overthinking!</p>

                                {isMyTurn ? (
                                    <button
                                        onClick={startGame}
                                        className="w-full py-4 rounded-2xl bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold text-lg shadow-lg active:scale-95 transition-transform"
                                    >
                                        🔥 Start Round
                                    </button>
                                ) : (
                                    <div className="flex flex-col items-center gap-6">
                                        <p className="opacity-50 italic">Waiting for partner to start...</p>
                                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                                            className="w-8 h-8 rounded-full" style={{ borderWidth: 2, borderStyle: 'solid', borderColor: primaryColor, borderTopColor: 'transparent' }} />
                                    </div>
                                )}
                            </motion.div>
                        )}

                    {/* PLAYING */}
                    {board_state.phase === 'playing' && currentQ && (
                        <motion.div key={`q-${board_state.currentIndex}`} initial={{ x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -60, opacity: 0 }} className="w-full">
                            {isMyTurn ? (
                                <>
                                    {/* Progress bar */}
                                    <div className="w-full h-1.5 rounded-full bg-white/10 mb-4">
                                        <motion.div className="h-full rounded-full bg-orange-500" style={{ width: `${progress}%` }} animate={{ width: `${progress}%` }} />
                                    </div>

                                    {/* Timer bar */}
                                    <div className="w-full h-2 rounded-full bg-white/10 mb-6 overflow-hidden">
                                        <motion.div
                                            className={`h-full rounded-full ${timerColor} transition-colors`}
                                            animate={{ width: `${timerPercent}%` }}
                                            transition={{ duration: 0.5 }}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between mb-2 text-sm opacity-50">
                                        <span>{board_state.currentIndex + 1} / {board_state.questions.length}</span>
                                        <span className={`font-bold text-lg ${timer <= 3 ? 'text-red-400' : ''}`}>{timer}s</span>
                                    </div>

                                    {/* Category */}
                                    <div className="mb-4">
                                        <span className={`text-xs px-2.5 py-1 rounded-full ${isDark ? 'bg-white/10' : 'bg-gray-200'}`}>
                                            {CATEGORY_EMOJI[currentQ.category] || '❓'} {currentQ.category}
                                        </span>
                                    </div>

                                    {/* Question */}
                                    <div className={`p-6 rounded-2xl mb-6 ${isDark ? 'bg-white/5 border border-white/10' : 'bg-white shadow-lg'}`}>
                                        <h2 className="text-xl font-bold text-center">{currentQ.question}</h2>
                                    </div>

                                    {/* Answer input */}
                                    <div className="flex gap-3">
                                        <input
                                            ref={inputRef}
                                            type="text"
                                            value={answer}
                                            onChange={(e) => setAnswer(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && submitAnswer()}
                                            placeholder="Type your answer..."
                                            className={`flex-1 px-4 py-3 rounded-2xl text-base outline-none transition-colors ${
                                                isDark ? 'bg-white/10 border border-white/10 focus:border-orange-500' : 'bg-white border border-gray-300 focus:border-orange-500'
                                            }`}
                                            autoFocus
                                        />
                                        <button
                                            onClick={() => submitAnswer()}
                                            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold shadow-lg active:scale-95 transition-transform"
                                        >
                                            →
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center">
                                    <motion.div
                                        className="text-6xl mb-4"
                                        animate={{ rotate: [0, 5, -5, 0] }}
                                        transition={{ repeat: Infinity, duration: 1 }}
                                    >
                                        ⏳
                                    </motion.div>
                                    <h2 className="text-xl font-bold mb-2">Partner is answering...</h2>
                                    <p className="opacity-50">Question {board_state.currentIndex + 1} of {board_state.questions.length}</p>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* REVIEW */}
                    {board_state.phase === 'review' && (
                        <motion.div key="review" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full">
                            <h2 className="text-2xl font-bold text-center mb-6">
                                {isMyTurn ? '🎉 Your Answers!' : "Partner's Answers!"}
                            </h2>

                            <div className="space-y-3 mb-6 max-h-[50vh] overflow-y-auto">
                                {board_state.questions.map((q, i) => {
                                    const myAns = board_state.answers[board_state.turn]?.[i];
                                    return (
                                        <div key={i} className={`p-4 rounded-2xl ${isDark ? 'bg-white/5' : 'bg-white shadow'}`}>
                                            <p className="text-sm opacity-50 mb-1">{CATEGORY_EMOJI[q.category] || '❓'} {q.category}</p>
                                            <p className="font-medium mb-1">{q.question}</p>
                                            <p className="text-orange-400 font-bold">{myAns || '(no answer)'}</p>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Check if partner already played */}
                            {(() => {
                                const partnerId = session.player_x === user?.id ? session.player_o : session.player_x;
                                const partnerPlayed = partnerId && board_state.answers[partnerId] && Object.keys(board_state.answers[partnerId]).length > 0;
                                const iPlayed = user && board_state.answers[user.id] && Object.keys(board_state.answers[user.id]).length > 0;

                                if (iPlayed && partnerPlayed) {
                                    return (
                                        <button
                                            onClick={newGame}
                                            className="w-full py-4 rounded-2xl bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold shadow-lg active:scale-95 transition-transform"
                                        >
                                            🔄 New Round
                                        </button>
                                    );
                                } else if (isMyTurn) {
                                    return (
                                        <button
                                            onClick={switchTurn}
                                            className="w-full py-4 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-bold shadow-lg active:scale-95 transition-transform"
                                        >
                                            ✨ Partner's Turn
                                        </button>
                                    );
                                } else {
                                    return <p className="text-center opacity-50 italic">Your turn next!</p>;
                                }
                            })()}
                        </motion.div>
                    )}
                </AnimatePresence>
                )}
            </main>
        </div>
    );
};

export default RapidFire;
