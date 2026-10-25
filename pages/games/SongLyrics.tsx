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

interface LyricItem {
    id: number;
    artist: string;
    song: string;
    lyric_start: string;
    answer: string;
    wrong: string[];
}

interface SLState {
    phase: 'lobby' | 'playing' | 'result' | 'finished';
    currentIndex: number;
    questions: LyricItem[];
    scores: Record<string, number>;
    turn: string;
    selectedAnswer: string | null;
    correctAnswer: string | null;
    totalRounds: number;
    roundsPlayed: number;
}

interface GameSession {
    id: string;
    couple_id: string;
    game_type: 'song_lyrics';
    board_state: SLState;
    player_x: string;
    player_o: string | null;
    status: 'waiting' | 'active' | 'ended';
    updated_at: string;
}

const loadData = async (): Promise<LyricItem[]> => {
    const res = await fetch('/Games_data/song_lyrics.json');
    return await res.json();
};

const TOTAL_ROUNDS = 10;

const emptyState = (firstTurn: string, questions: LyricItem[]): SLState => {
    const shuffled = [...questions].sort(() => Math.random() - 0.5).slice(0, TOTAL_ROUNDS);
    return {
        phase: 'lobby',
        currentIndex: 0,
        questions: shuffled,
        scores: {},
        turn: firstTurn,
        selectedAnswer: null,
        correctAnswer: null,
        totalRounds: TOTAL_ROUNDS,
        roundsPlayed: 0,
    };
};

const shuffleArray = <T,>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
};

const SongLyrics: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { couple } = useCouples();
    const { theme, primaryColor } = useTheme();
    const { openTutorial } = useTutorial();
    const isDark = theme === 'dark';

    const [allItems, setAllItems] = useState<LyricItem[]>([]);
    const [session, setSession] = useState<GameSession | null>(null);
    const [loading, setLoading] = useState(true);
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
    const [ringCooldown, setRingCooldown] = useState(false);
    const ringCooldownRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    const [choices, setChoices] = useState<string[]>([]);
    const [localSelected, setLocalSelected] = useState<string | null>(null);

    useEffect(() => {
        loadData().then(setAllItems).catch(console.error);
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
            // Only proceed if allItems are loaded
            if (allItems.length === 0) {
                if (!cancelled) setLoading(false);
                return;
            }

            try {
                const { data, error } = await (supabase.from('game_sessions') as any)
                    .select('*')
                    .eq('couple_id', couple.id)
                    .eq('game_type', 'song_lyrics')
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
                            game_type: 'song_lyrics',
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
                        sendGameNotification(couple, user.id, 'Song Lyrics', '/games/song-lyrics', 'invite');
                    }
                }
            } catch (err) {
                console.error('SongLyrics init error:', err);
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

        const ch = supabase.channel(`game_sl_${session.id}`, { config: { private: true } })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'game_sessions', filter: `id=eq.${session.id}` },
            (payload) => {
                const newSess = payload.new as GameSession;
                if (newSess && newSess.game_type === 'song_lyrics') {
                    setSession(newSess);
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(ch);
            clearTimeout(ringCooldownRef.current);
        };
    }, [session?.id]);

    // Generate shuffled choices when question changes
    useEffect(() => {
        if (!session) return;
        const q = session.board_state.questions[session.board_state.currentIndex];
        if (q && session.board_state.phase === 'playing') {
            setChoices(shuffleArray([q.answer, ...q.wrong]));
            setLocalSelected(null);
        }
    }, [session?.board_state.currentIndex, session?.board_state.phase]);

    const updateState = async (updates: Partial<SLState>) => {
        if (!session) return;
        const newState = { ...session.board_state, ...updates };
        // @ts-ignore - Supabase generated types don't include dynamic game_type columns
        await supabase.from('game_sessions').update({ board_state: newState } as any).eq('id', session.id);
    };

    const startGame = () => {
        if (!session || allItems.length === 0 || !user) return;
        const shuffled = [...allItems].sort(() => Math.random() - 0.5).slice(0, TOTAL_ROUNDS);
        updateState({
            phase: 'playing',
            questions: shuffled,
            currentIndex: 0,
            scores: {},
            turn: user.id,
            selectedAnswer: null,
            correctAnswer: null,
            roundsPlayed: 0,
        });
    };

    const selectAnswer = (choice: string) => {
        if (!session || !user || localSelected) return;
        setLocalSelected(choice);

        const currentQ = session.board_state.questions[session.board_state.currentIndex];
        const isCorrect = choice === currentQ.answer;
        const newScores = { ...session.board_state.scores };
        if (isCorrect) {
            newScores[user.id] = (newScores[user.id] || 0) + 1;
        }

        updateState({
            selectedAnswer: choice,
            correctAnswer: currentQ.answer,
            scores: newScores,
            phase: 'result',
            roundsPlayed: session.board_state.roundsPlayed + 1,
        });
    };

    const nextQuestion = () => {
        if (!session || !user || !couple) return;
        const nextIndex = session.board_state.currentIndex + 1;

        if (nextIndex >= session.board_state.questions.length) {
            // Switch to partner's turn or finish
            const partnerId = session.player_x === user.id ? session.player_o : session.player_x;
            const partnerPlayed = partnerId && (session.board_state.scores[partnerId] !== undefined || session.board_state.turn === partnerId || (session.board_state.turn !== user.id && session.board_state.roundsPlayed > 0));

            if (partnerPlayed || !partnerId) {
                updateState({ phase: 'finished' });
            } else {
                // Partner's turn
                const shuffled = [...allItems].sort(() => Math.random() - 0.5).slice(0, TOTAL_ROUNDS);
                updateState({
                    phase: 'playing',
                    questions: shuffled,
                    currentIndex: 0,
                    turn: partnerId,
                    selectedAnswer: null,
                    correctAnswer: null,
                });
            }
        } else {
            updateState({
                currentIndex: nextIndex,
                selectedAnswer: null,
                correctAnswer: null,
                phase: 'playing',
            });
        }
    };

    const newGame = () => {
        if (!session || allItems.length === 0 || !user) return;
        try {
            updateState(emptyState(user.id, allItems));
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
    const progress = board_state.questions.length > 0 ? ((board_state.currentIndex + (board_state.phase === 'result' ? 1 : 0)) / board_state.questions.length) * 100 : 0;

    return (
        <div className={`min-h-screen flex flex-col ${isDark ? 'bg-[#121014] text-white' : 'bg-gray-50 text-gray-900'}`}>
            {/* Header */}
            <div className={`p-4 flex items-center justify-between border-b ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                <button onClick={async () => { try { if (session?.id) await endSession(session.id); } catch {} navigate('/games'); }} className="p-2 -ml-2 rounded-full hover:bg-white/10 active:scale-95 transition-transform">
                    <span className="material-symbols-outlined text-2xl">arrow_back</span>
                </button>
                <h1 className="text-lg font-bold">🎵 Finish the Lyrics</h1>
                <button
                    onClick={async () => {
                        if (!couple || !user || ringCooldown) return;
                        setRingCooldown(true);
                        await sendGameNotification(couple, user.id, 'Finish the Lyrics', '/games/song-lyrics', 'ring');
                        ringCooldownRef.current = setTimeout(() => setRingCooldown(false), 30000);
                    }}
                    disabled={ringCooldown}
                    className={`p-2 rounded-full transition-all ${ringCooldown ? 'opacity-30' : 'hover:bg-white/10 active:scale-90'}`}
                >
                    <span className="material-symbols-outlined text-2xl">{ringCooldown ? 'notifications_off' : 'notifications_active'}</span>
                </button>
            </div>

            {/* Score & Progress */}
            {(board_state.phase === 'playing' || board_state.phase === 'result') && (
                <div className={`px-4 py-2 ${isDark ? 'bg-white/5' : 'bg-gray-100'}`}>
                    <div className="flex items-center justify-between text-sm mb-2">
                        <span className="font-medium">{board_state.currentIndex + 1} / {board_state.questions.length}</span>
                        <span className="font-bold text-pink-400">Score: {board_state.scores[board_state.turn] || 0}</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-white/10">
                        <motion.div className="h-full rounded-full bg-gradient-to-r from-pink-500 to-fuchsia-500" animate={{ width: `${progress}%` }} />
                    </div>
                </div>
            )}

            <main className="flex-1 p-6 flex flex-col items-center justify-center max-w-md mx-auto w-full">
                {session.status === 'waiting' ? (
                    <div className="flex-1 flex flex-col items-center justify-center w-full">
                        <h2 className="text-2xl font-bold mb-8 text-center">Waiting for partner to join...</h2>
                        <div className="flex flex-col items-center gap-6">
                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                                className="w-12 h-12 rounded-full" style={{ borderWidth: 4, borderStyle: 'solid', borderColor: primaryColor, borderTopColor: 'transparent' }} />
                            <p className="text-gray-400">Send your partner to Games → Finish the Lyrics</p>
                        </div>
                    </div>
                ) : (
                    <AnimatePresence mode="wait">
                        {/* LOBBY */}
                        {board_state.phase === 'lobby' && (
                            <motion.div key="lobby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center w-full">
                                <motion.div
                                    className="text-7xl mb-6"
                                    animate={{ y: [0, -8, 0] }}
                                    transition={{ repeat: Infinity, duration: 2 }}
                                >
                                    🎤
                                </motion.div>
                                <h2 className="text-2xl font-bold mb-2">Finish the Lyrics!</h2>
                                <p className="opacity-60 mb-2">{TOTAL_ROUNDS} rounds • Multiple choice</p>
                                <p className="opacity-40 text-sm mb-8">Complete the song lyric. Who knows more hits?</p>

                                {isMyTurn ? (
                                    <button
                                        onClick={startGame}
                                        className="w-full py-4 rounded-2xl bg-gradient-to-r from-pink-500 to-fuchsia-500 text-white font-bold text-lg shadow-lg active:scale-95 transition-transform"
                                    >
                                        🎶 Start Game
                                    </button>
                                ) : (
                                    <div className="flex flex-col items-center gap-6">
                                        <p className="opacity-50 italic text-lg font-bold">Waiting for creator to start...</p>
                                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                                            className="w-8 h-8 rounded-full" style={{ borderWidth: 2, borderStyle: 'solid', borderColor: primaryColor, borderTopColor: 'transparent' }} />
                                    </div>
                                )}
                            </motion.div>
                        )}

                    {/* PLAYING */}
                    {board_state.phase === 'playing' && currentQ && (
                        <motion.div key={`q-${board_state.currentIndex}`} initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -50, opacity: 0 }} className="w-full">
                            {isMyTurn ? (
                                <>
                                    {/* Song info */}
                                    <div className="text-center mb-6">
                                        <span className={`text-xs px-3 py-1 rounded-full ${isDark ? 'bg-white/10' : 'bg-gray-200'}`}>
                                            🎵 {currentQ.artist} — {currentQ.song}
                                        </span>
                                    </div>

                                    {/* Lyric card */}
                                    <div className="w-full p-6 rounded-3xl bg-gradient-to-br from-pink-500 to-fuchsia-600 text-white shadow-2xl mb-6 relative overflow-hidden">
                                        <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full" />
                                        <div className="absolute -bottom-4 -left-4 w-20 h-20 bg-white/10 rounded-full" />
                                        <p className="text-lg italic relative z-10 leading-relaxed">
                                            "{currentQ.lyric_start}"
                                        </p>
                                        <p className="text-3xl mt-2 relative z-10">...</p>
                                    </div>

                                    {/* Choices */}
                                    <div className="space-y-3">
                                        {choices.map((choice, i) => (
                                            <motion.button
                                                key={i}
                                                initial={{ y: 20, opacity: 0 }}
                                                animate={{ y: 0, opacity: 1 }}
                                                transition={{ delay: i * 0.1 }}
                                                onClick={() => selectAnswer(choice)}
                                                disabled={!!localSelected}
                                                className={`w-full p-4 rounded-2xl text-left font-medium transition-all active:scale-[0.98] ${
                                                    isDark
                                                        ? 'bg-white/5 border border-white/10 hover:border-pink-500/50'
                                                        : 'bg-white border border-gray-200 hover:border-pink-500 shadow-sm'
                                                } ${localSelected === choice ? 'border-pink-500 bg-pink-500/20' : ''}`}
                                            >
                                                <span className="opacity-40 mr-2">{String.fromCharCode(65 + i)}.</span>
                                                {choice}
                                            </motion.button>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <div className="text-center">
                                    <motion.div className="text-6xl mb-4" animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                                        🎧
                                    </motion.div>
                                    <h2 className="text-xl font-bold mb-2">Partner is playing...</h2>
                                    <p className="opacity-50">Question {board_state.currentIndex + 1} of {board_state.questions.length}</p>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* RESULT */}
                    {board_state.phase === 'result' && currentQ && (
                        <motion.div key="result" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full">
                            <div className="text-center mb-4">
                                <motion.div
                                    className="text-5xl mb-2"
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                                >
                                    {board_state.selectedAnswer === board_state.correctAnswer ? '🎉' : '😬'}
                                </motion.div>
                                <h2 className="text-xl font-bold">
                                    {board_state.selectedAnswer === board_state.correctAnswer ? 'Correct!' : 'Not quite!'}
                                </h2>
                            </div>

                            <div className={`p-5 rounded-2xl mb-4 ${isDark ? 'bg-white/5' : 'bg-white shadow-lg'}`}>
                                <p className="text-sm opacity-50 mb-2">🎵 {currentQ.artist} — {currentQ.song}</p>
                                <p className="italic opacity-70 mb-2">"{currentQ.lyric_start}"</p>
                                <p className="font-bold text-green-400">✅ {board_state.correctAnswer}</p>
                                {board_state.selectedAnswer !== board_state.correctAnswer && (
                                    <p className="text-red-400 text-sm mt-1">Your answer: {board_state.selectedAnswer}</p>
                                )}
                            </div>

                            <button
                                onClick={nextQuestion}
                                className="w-full py-4 rounded-2xl bg-gradient-to-r from-pink-500 to-fuchsia-500 text-white font-bold shadow-lg active:scale-95 transition-transform"
                            >
                                {board_state.currentIndex + 1 >= board_state.questions.length ? '🏁 See Results' : 'Next Song →'}
                            </button>
                        </motion.div>
                    )}

                    {/* FINISHED */}
                    {board_state.phase === 'finished' && (
                        <motion.div key="finished" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full text-center">
                            <motion.div className="text-6xl mb-4" animate={{ rotate: [0, 10, -10, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
                                🏆
                            </motion.div>
                            <h2 className="text-2xl font-bold mb-6">Final Scores</h2>

                            <div className={`p-6 rounded-2xl mb-6 ${isDark ? 'bg-white/5' : 'bg-white shadow-lg'}`}>
                                {Object.entries(board_state.scores).map(([playerId, score]) => (
                                    <div key={playerId} className="flex items-center justify-between py-3 border-b border-white/10 last:border-0">
                                        <span className="font-medium">{playerId === user?.id ? '🎤 You' : '🎧 Partner'}</span>
                                        <span className="text-2xl font-bold text-pink-400">{(score as number)} / {TOTAL_ROUNDS}</span>
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={newGame}
                                className="w-full py-4 rounded-2xl bg-gradient-to-r from-pink-500 to-fuchsia-500 text-white font-bold shadow-lg active:scale-95 transition-transform"
                            >
                                🔄 Play Again
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
                )}
            </main>
        </div>
    );
};

export default SongLyrics;
