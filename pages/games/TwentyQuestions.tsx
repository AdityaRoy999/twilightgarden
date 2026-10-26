import { AppIcon } from '../../components/ui/Icons';
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

const MAX_QUESTIONS = 20;

const CATEGORIES = ['Animal','Person','Place','Food','Object','Movie','Song','Sport','Hobby','Other'] as const;

interface Question {
    text: string;
    answer: 'yes' | 'no' | 'kind-of' | null;
    askedBy: string;
}

interface TwentyQState {
    phase: 'setup' | 'playing' | 'guessing' | 'finished';
    thinker: string;
    asker: string;
    thingCategory: string;
    thingDescription: string; // private - only thinker sees
    questions: Question[];
    finalGuess: string;
    result: 'correct' | 'wrong' | null;
    scores: Record<string, number>;
}

interface GameSession {
    id: string;
    couple_id: string;
    game_type: string;
    board_state: TwentyQState;
    current_turn: string;
    player_x: string;
    player_o: string | null;
    winner: string | null;
    status: 'waiting' | 'active' | 'finished' | 'ended';
    created_at: string;
}

const emptyState = (thinkerId: string, askerId: string): TwentyQState => ({
    phase: 'setup', thinker: thinkerId, asker: askerId,
    thingCategory: '', thingDescription: '', questions: [],
    finalGuess: '', result: null, scores: {},
});

const TwentyQuestions: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { couple } = useCouples();
    const { theme, primaryColor } = useTheme();
    const { openTutorial } = useTutorial();
    const isDark = theme === 'dark';

    const [game, setGame] = useState<GameSession | null>(null);
    const [loading, setLoading] = useState(true);
    const [thingInput, setThingInput] = useState('');
    const [categoryInput, setCategoryInput] = useState('');
    const [questionInput, setQuestionInput] = useState('');
    const [guessInput, setGuessInput] = useState('');
    const [toast, setToast] = useState<{ isVisible: boolean; message: string; subMessage?: string; type: 'success' | 'error' }>({ isVisible: false, message: '', type: 'success' });
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
    const [ringCooldown, setRingCooldown] = useState(false);
    const ringCooldownRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    const scrollRef = useRef<HTMLDivElement>(null);

    const showToast = (m: string, s?: string, t: 'success' | 'error' = 'success') => setToast({ isVisible: true, message: m, subMessage: s, type: t });

    const state = game?.board_state;
    const amThinker = state?.thinker === user?.id;
    const amAsker = state?.asker === user?.id;
    const questionsLeft = MAX_QUESTIONS - (state?.questions?.length || 0);

    /* ─── init ─── */
    useEffect(() => {
        if (!couple?.id || !user?.id) return;
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const { data: existing } = await (supabase.from('game_sessions') as any).select('*')
                    .eq('couple_id', couple.id).eq('game_type', 'twenty_questions')
                    .in('status', ['waiting', 'active']).order('created_at', { ascending: false }).limit(1).maybeSingle();
                if (cancelled) return;

                if (existing) {
                    if (existing.status === 'waiting' && existing.player_x !== user.id && !existing.player_o) {
                        const updatedState = { ...existing.board_state, asker: user.id, scores: { [existing.player_x]: 0, [user.id]: 0 } };
                        const { data: updated } = await (supabase.from('game_sessions') as any)
                            .update({ player_o: user.id, status: 'active', board_state: updatedState }).eq('id', existing.id).select().single();
                        if (!cancelled && updated) { setGame(updated); setTimeout(() => channelRef.current?.send({ type: 'broadcast', event: 'game_update', payload: updated }), 80); }
                    } else { if (!cancelled) setGame(existing); }
                } else {
                    const initState = emptyState(user.id, '');
                    initState.scores = { [user.id]: 0 };
                    const { data: created } = await (supabase.from('game_sessions') as any).insert({
                        couple_id: couple.id, game_type: 'twenty_questions', board_state: initState,
                        current_turn: user.id, player_x: user.id, player_o: null, winner: null, status: 'waiting'
                    }).select().single();
                    if (!cancelled && created) setGame(created);
                    if (created) sendGameNotification(couple, user.id, '20 Questions', '/games/20-questions', 'invite');
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
        ch.on('broadcast', { event: 'game_update' }, ({ payload }) => setGame(payload as GameSession));
        ch.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_sessions', filter: `id=eq.${game.id}` },
            (p) => setGame(p.new as GameSession));
        ch.on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'game_sessions', filter: `id=eq.${game.id}` },
            () => { setGame(null); showToast('Game Ended', 'Partner left'); });
        ch.subscribe(); channelRef.current = ch;
        return () => { supabase.removeChannel(ch); channelRef.current = null; clearTimeout(ringCooldownRef.current); };
    }, [game?.id, user?.id]);

    // auto-scroll to bottom of questions
    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [state?.questions?.length]);

    const broadcast = (updated: GameSession) => {
        setGame(updated);
        channelRef.current?.send({ type: 'broadcast', event: 'game_update', payload: updated });
        (supabase.from('game_sessions') as any).update({ board_state: updated.board_state }).eq('id', updated.id);
    };

    /* ─── thinker sets up ─── */
    const handleSetup = () => {
        if (!game || !state || !thingInput.trim() || !categoryInput) return;
        const newState: TwentyQState = { ...state, thingDescription: thingInput.trim(), thingCategory: categoryInput, phase: 'playing' };
        broadcast({ ...game, board_state: newState } as GameSession);
        setThingInput('');
    };

    /* ─── asker asks question ─── */
    const handleAskQuestion = () => {
        if (!game || !state || !questionInput.trim() || !amAsker) return;
        if (state.questions.length >= MAX_QUESTIONS) return;
        const q: Question = { text: questionInput.trim(), answer: null, askedBy: user?.id || '' };
        const newState: TwentyQState = { ...state, questions: [...state.questions, q] };
        broadcast({ ...game, board_state: newState } as GameSession);
        setQuestionInput('');
    };

    /* ─── thinker answers ─── */
    const handleAnswer = (idx: number, answer: 'yes' | 'no' | 'kind-of') => {
        if (!game || !state || !amThinker) return;
        const questions = [...state.questions];
        questions[idx] = { ...questions[idx], answer };
        const newState: TwentyQState = { ...state, questions };
        broadcast({ ...game, board_state: newState } as GameSession);
    };

    /* ─── asker makes final guess ─── */
    const handleGuess = () => {
        if (!game || !state || !guessInput.trim() || !amAsker) return;
        const newState: TwentyQState = { ...state, finalGuess: guessInput.trim(), phase: 'guessing' };
        broadcast({ ...game, board_state: newState } as GameSession);
        setGuessInput('');
    };

    /* ─── thinker judges the guess ─── */
    const handleJudge = (correct: boolean) => {
        if (!game || !state || !amThinker) return;
        const newScores = { ...state.scores };
        if (correct) newScores[state.asker] = (newScores[state.asker] || 0) + 1;
        else newScores[state.thinker] = (newScores[state.thinker] || 0) + 1;
        const newState: TwentyQState = { ...state, result: correct ? 'correct' : 'wrong', phase: 'finished', scores: newScores };
        broadcast({ ...game, board_state: newState } as GameSession);
    };

    /* ─── give up (asker) ─── */
    const handleGiveUp = () => {
        if (!game || !state || !amAsker) return;
        const newScores = { ...state.scores };
        newScores[state.thinker] = (newScores[state.thinker] || 0) + 1;
        const newState: TwentyQState = { ...state, result: 'wrong', phase: 'finished', scores: newScores, finalGuess: '(gave up)' };
        broadcast({ ...game, board_state: newState } as GameSession);
    };

    /* ─── next round (swap) ─── */
    const handleNextRound = () => {
        if (!game || !state) return;
        try {
            const newState: TwentyQState = { ...state, phase: 'setup', thinker: state.asker, asker: state.thinker, thingCategory: '', thingDescription: '', questions: [], finalGuess: '', result: null };
            broadcast({ ...game, board_state: newState } as GameSession);
        } catch { /* broadcast handles errors internally */ }
    };

    const handleExit = async () => { try { if (game?.id) await endSession(game.id); } catch {} navigate('/games'); };

    if (loading) return <div className={`min-h-screen flex items-center justify-center bg-background-dark`}><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-10 h-10 rounded-full" style={{ borderWidth: 3, borderStyle: 'solid', borderColor: primaryColor, borderTopColor: 'transparent' }} /></div>;
    if (game?.status === 'ended') return <GameEndedScreen />;
    if (!game) return <GameEndedScreen />;

    const myScore = state?.scores?.[user?.id || ''] || 0;
    const partnerId = game.player_x === user?.id ? game.player_o : game.player_x;
    const partnerScore = partnerId ? (state?.scores?.[partnerId] || 0) : 0;
    const pendingAnswer = state?.questions?.some(q => q.answer === null) ?? false;

    return (
        <div className={`min-h-screen flex flex-col font-display transition-colors ${isDark ? 'bg-background-dark text-white' : 'bg-background-dark text-[var(--text-primary)]'}`}>
            <header className={`flex items-center justify-between px-5 py-4 sticky top-0 z-20 backdrop-blur-sm border-b ${isDark ? 'bg-background-dark/95 border-white/5' : 'bg-background-dark/95 border-gray-100'}`}>
                <button onClick={handleExit} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10"><span className="app-icon-glyph"><AppIcon name={"arrow_back"}/></span></button>
                <h1 className="text-lg font-bold">20 Questions</h1>
                <div className="flex items-center">
                    <button
                        onClick={() => openTutorial('20-questions')}
                        className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 transition-all active:scale-90 mr-1"
                        title="Watch Tutorial"
                    >
                        <span className="app-icon-glyph text-xl" style={{ color: primaryColor }}><AppIcon name={"play_circle"}/></span>
                    </button>
                    <button
                        onClick={async () => {
                            if (!couple || !user || ringCooldown) return;
                            setRingCooldown(true);
                            await sendGameNotification(couple, user.id, '20 Questions', '/games/20-questions', 'ring');
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

            <main className="flex-1 flex flex-col items-center px-5 gap-4 pb-24 pt-12">
                {/* Scores */}
                <div className="flex items-center justify-center gap-6 w-full max-w-xs">
                    <div className="flex flex-col items-center gap-1">
                        <div className="text-2xl font-black" style={{ color: primaryColor }}>{myScore}</div>
                        <span className="text-xs font-bold">{amThinker ? '🤔 Thinker' : '❓ Asker'}</span>
                    </div>
                    <div className={`text-sm font-bold px-3 py-1 rounded-full ${isDark ? 'bg-white/5 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>VS</div>
                    <div className="flex flex-col items-center gap-1">
                        <div className={`text-2xl font-black ${isDark ? 'text-pink-400' : 'text-pink-500'}`}>{partnerScore}</div>
                        <span className="text-xs font-bold">{amThinker ? '❓ Asker' : '🤔 Thinker'}</span>
                    </div>
                </div>

                {game.status === 'waiting' && (
                    <div className="flex-1 flex flex-col items-center justify-center w-full">
                        <h2 className="text-2xl font-bold mb-8 text-center">Waiting for partner to join...</h2>
                        <div className="flex flex-col items-center gap-6">
                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                                className="w-12 h-12 rounded-full" style={{ borderWidth: 4, borderStyle: 'solid', borderColor: primaryColor, borderTopColor: 'transparent' }} />
                            <p className="text-gray-400">Send your partner to Games → 20 Questions</p>
                        </div>
                    </div>
                )}

                {/* Setup phase - thinker picks thing */}
                {state?.phase === 'setup' && game.status === 'active' && (
                    <div className="flex flex-col items-center gap-5 mt-4 w-full max-w-sm">
                        {amThinker ? (
                            <>
                                <p className="text-lg font-bold" style={{ color: primaryColor }}>Think of something!</p>
                                <p className="text-sm text-gray-400 text-center">Pick a category and describe what you're thinking of (only you can see it).</p>
                                <div className="flex flex-wrap gap-2 justify-center">
                                    {CATEGORIES.map(cat => (
                                        <button key={cat} onClick={() => setCategoryInput(cat)}
                                            className={`px-3 py-1.5 rounded-full text-sm font-bold transition-all ${categoryInput === cat ? 'text-white scale-105' : isDark ? 'bg-white/10 text-gray-300' : 'bg-gray-100 text-gray-600'}`}
                                            style={categoryInput === cat ? { backgroundColor: primaryColor } : {}}>
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                                <input type="text" value={thingInput} onChange={e => setThingInput(e.target.value)}
                                    placeholder="What are you thinking of?"
                                    className={`w-full px-4 py-3 rounded-xl text-sm font-medium outline-none ${isDark ? 'bg-white/10 text-white placeholder-gray-500' : 'bg-gray-100 text-gray-800 placeholder-gray-400'}`}
                                    maxLength={50} />
                                <button onClick={handleSetup} disabled={!thingInput.trim() || !categoryInput}
                                    className="on-brand w-full py-4 rounded-2xl font-bold text-white active:scale-95 transition-transform disabled:opacity-40" style={{ backgroundColor: primaryColor }}>

                                    I'm Ready! <AppIcon name={"🧠"}/>
                                </button>
                            </>
                        ) : (
                            <div className="flex flex-col items-center gap-3 mt-8">
                                <motion.div animate={{ rotate:360 }} transition={{ duration:2, repeat:Infinity, ease:'linear' }}
                                    className="w-6 h-6 rounded-full" style={{ borderWidth:2, borderStyle:'solid', borderColor:primaryColor, borderTopColor:'transparent' }} />
                                <p className="text-sm text-gray-400">Partner is thinking of something...</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Playing phase */}
                {(state?.phase === 'playing' || state?.phase === 'guessing' || state?.phase === 'finished') && game.status === 'active' && (
                    <>
                        {/* Category badge */}
                        {state.thingCategory && (
                            <div className="px-4 py-1.5 rounded-full text-sm font-bold" style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}>
                                Category: {state.thingCategory}
                            </div>
                        )}

                        {/* Questions left */}
                        {state.phase === 'playing' && (
                            <p className="text-xs text-gray-400">{questionsLeft} questions remaining</p>
                        )}

                        {/* Thinker's secret note */}
                        {amThinker && state.thingDescription && (
                            <p className="text-xs text-gray-400">Your thing: <span className="font-bold" style={{ color: primaryColor }}>{state.thingDescription}</span></p>
                        )}

                        {/* Question list */}
                        <div ref={scrollRef} className={`w-full max-w-sm flex-1 overflow-y-auto rounded-2xl p-3 flex flex-col gap-2 max-h-[50vh] ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
                            {state.questions.length === 0 && state.phase === 'playing' && (
                                <p className="text-center text-gray-400 text-sm py-8">{amAsker ? 'Ask your first question!' : 'Waiting for a question...'}</p>
                            )}
                            {state.questions.map((q, i) => (
                                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                    className={`rounded-xl p-3 ${isDark ? 'bg-white/5' : 'bg-white'} shadow-sm`}>
                                    <div className="flex items-start gap-2">
                                        <span className="text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5"
                                            style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}>
                                            {i + 1}
                                        </span>
                                        <p className="text-sm font-medium flex-1">{q.text}</p>
                                    </div>
                                    {q.answer ? (
                                        <div className={`mt-2 ml-7 px-3 py-1 rounded-full text-xs font-bold inline-block ${
                                            q.answer === 'yes' ? 'bg-green-500/20 text-green-500'
                                                : q.answer === 'no' ? 'bg-red-500/20 text-red-500'
                                                : 'bg-yellow-500/20 text-yellow-500'
                                        }`}>
                                            {q.answer === 'yes' ? '✅ Yes' : q.answer === 'no' ? '❌ No' : '🤷 Kind of'}
                                        </div>
                                    ) : amThinker ? (
                                        <div className="mt-2 ml-7 flex gap-2">
                                            <button onClick={() => handleAnswer(i, 'yes')} className="px-3 py-1 rounded-full text-xs font-bold bg-green-500/20 text-green-500 active:scale-95"><AppIcon name={"✅"}/> Yes</button>
                                            <button onClick={() => handleAnswer(i, 'no')} className="px-3 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-500 active:scale-95"><AppIcon name={"❌"}/> No</button>
                                            <button onClick={() => handleAnswer(i, 'kind-of')} className="px-3 py-1 rounded-full text-xs font-bold bg-yellow-500/20 text-yellow-500 active:scale-95"><AppIcon name={"🤷"}/> Kinda</button>
                                        </div>
                                    ) : (
                                        <p className="mt-1 ml-7 text-xs text-gray-400 italic">Waiting for answer...</p>
                                    )}
                                </motion.div>
                            ))}
                        </div>

                        {/* Ask question input */}
                        {state.phase === 'playing' && amAsker && !pendingAnswer && (
                            <div className="flex gap-2 w-full max-w-sm">
                                <input type="text" value={questionInput} onChange={e => setQuestionInput(e.target.value)}
                                    placeholder="Ask a yes/no question..."
                                    className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium outline-none ${isDark ? 'bg-white/10 text-white placeholder-gray-500' : 'bg-gray-100 text-gray-800 placeholder-gray-400'}`}
                                    maxLength={100}
                                    onKeyDown={e => e.key === 'Enter' && handleAskQuestion()} />
                                <button onClick={handleAskQuestion} disabled={!questionInput.trim()}
                                    className="on-brand px-4 py-3 rounded-xl font-bold text-white disabled:opacity-40" style={{ backgroundColor: primaryColor }}>Ask</button>
                            </div>
                        )}

                        {state.phase === 'playing' && amAsker && pendingAnswer && (
                            <p className="text-sm text-gray-400">Waiting for partner to answer...</p>
                        )}

                        {/* Make final guess / give up (asker) */}
                        {state.phase === 'playing' && amAsker && !pendingAnswer && (
                            <div className="flex flex-col gap-2 w-full max-w-sm">
                                <div className="flex items-center gap-2 w-full">
                                    <div className="flex-1 h-px bg-gray-300 dark:bg-gray-700" />
                                    <span className="text-xs text-gray-400">or</span>
                                    <div className="flex-1 h-px bg-gray-300 dark:bg-gray-700" />
                                </div>
                                <div className="flex gap-2">
                                    <input type="text" value={guessInput} onChange={e => setGuessInput(e.target.value)}
                                        placeholder="Make your final guess..."
                                        className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium outline-none ${isDark ? 'bg-white/10 text-white placeholder-gray-500' : 'bg-gray-100 text-gray-800 placeholder-gray-400'}`}
                                        maxLength={50}
                                        onKeyDown={e => e.key === 'Enter' && handleGuess()} />
                                    <button onClick={handleGuess} disabled={!guessInput.trim()}
                                        className="on-brand px-4 py-3 rounded-xl font-bold text-white disabled:opacity-40" style={{ backgroundColor: primaryColor }}>Guess!</button>
                                </div>
                                <button onClick={handleGiveUp} className="text-xs text-gray-400 underline mt-1 px-4 py-2">I give up <AppIcon name={"😩"}/></button>
                            </div>
                        )}

                        {state.phase === 'playing' && amThinker && !pendingAnswer && (
                            <p className="text-sm text-gray-400">Waiting for partner to ask a question...</p>
                        )}

                        {/* Guessing phase — thinker judges */}
                        {state.phase === 'guessing' && (
                            <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} className="flex flex-col items-center gap-3 w-full max-w-sm">
                                <p className="text-lg font-bold">Final guess:</p>
                                <p className="text-xl font-black" style={{ color: primaryColor }}>"{state.finalGuess}"</p>
                                {amThinker ? (
                                    <>
                                        <p className="text-sm text-gray-400">Is this correct? (Your thing: <span className="font-bold">{state.thingDescription}</span>)</p>
                                        <div className="flex gap-3 mt-2">
                                            <button onClick={() => handleJudge(true)} className="on-brand px-6 py-3 rounded-2xl font-bold text-white bg-green-500 active:scale-95"><AppIcon name={"✅"}/> Correct!</button>
                                            <button onClick={() => handleJudge(false)} className="on-brand px-6 py-3 rounded-2xl font-bold text-white bg-red-500 active:scale-95"><AppIcon name={"❌"}/> Wrong!</button>
                                        </div>
                                    </>
                                ) : (
                                    <p className="text-sm text-gray-400">Waiting for partner to judge your guess...</p>
                                )}
                            </motion.div>
                        )}

                        {/* Finished */}
                        {state.phase === 'finished' && (
                            <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} className="flex flex-col items-center gap-3 text-center">
                                {state.result === 'correct' ? (
                                    <p className="text-xl font-bold text-green-500">{amAsker ? 'You got it! 🎉' : 'They guessed it! 😅'}</p>
                                ) : (
                                    <p className="text-xl font-bold text-red-400">{amAsker ? 'Nope! 💀' : 'They didn\'t get it! 🎯'}</p>
                                )}
                                <p className="text-sm text-gray-400">The answer was: <span className="font-bold" style={{ color: primaryColor }}>{state.thingDescription}</span></p>
                                <div className="flex flex-col items-center gap-3 w-full max-w-xs mt-4">
                                    <button onClick={handleNextRound} className="on-brand w-full px-6 py-4 rounded-2xl font-bold text-white shadow-lg active:scale-95" style={{ backgroundColor: primaryColor }}>Next Round (swap roles) <AppIcon name={"🔄"}/></button>
                                    <button onClick={handleExit} className={`w-full px-6 py-3 rounded-2xl font-bold ${isDark ? 'bg-white/5 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>Exit Game</button>
                                </div>
                            </motion.div>
                        )}
                    </>
                )}
            </main>

            <Toast message={toast.message} subMessage={toast.subMessage} isVisible={toast.isVisible} onClose={() => setToast(p => ({ ...p, isVisible: false }))} type={toast.type} />
        </div>
    );
};

export default TwentyQuestions;
