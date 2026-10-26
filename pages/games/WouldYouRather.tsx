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

interface WYRQuestion {
    id: number;
    category: string;
    question: string;
    option_a: string;
    option_b: string;
}

interface WYRRound {
    question: WYRQuestion;
    choices: Record<string, 'A' | 'B'>;
    revealed: boolean;
}

interface WYRState {
    phase: 'pick_rounds' | 'pick_category' | 'playing' | 'revealed' | 'finished';
    category: string;
    rounds: WYRRound[];
    currentRound: number;
    totalRounds: number;
    matchCount: number;
    usedIds: number[];
}

interface GameSession {
    id: string;
    couple_id: string;
    game_type: string;
    board_state: WYRState;
    current_turn: string;
    player_x: string;
    player_o: string | null;
    winner: string | null;
    status: 'waiting' | 'active' | 'finished' | 'ended';
    created_at: string;
}

const CATEGORIES = [
    { key: 'all', icon: '🎲', label: 'Random' },
    { key: 'Superpowers & Fantasy', icon: '🦸', label: 'Superpowers' },
    { key: 'Intimacy & Sex', icon: '🔥', label: 'Intimacy' },
    { key: 'Career & Money', icon: '💰', label: 'Career' },
    { key: 'Food & Lifestyle', icon: '🍕', label: 'Lifestyle' },
    { key: 'Love & Relationships', icon: '❤️', label: 'Love' },
];

let wyrCache: WYRQuestion[] | null = null;
const loadQuestions = async (): Promise<WYRQuestion[]> => {
    if (wyrCache) return wyrCache;
    const res = await fetch('./Games_data/would_you_rather.json');
    const data = await res.json();
    wyrCache = data.questions;
    return wyrCache!;
};

const pickQuestion = (questions: WYRQuestion[], category: string, usedIds: number[]): WYRQuestion | null => {
    const pool = category === 'all' ? questions : questions.filter(q => q.category === category);
    const available = pool.filter(q => !usedIds.includes(q.id));
    if (available.length === 0) return null;
    return available[Math.floor(Math.random() * available.length)];
};

const emptyState = (): WYRState => ({
    phase: 'pick_rounds', category: '', rounds: [], currentRound: 0,
    totalRounds: 0, matchCount: 0, usedIds: [],
});

const WouldYouRather: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { couple } = useCouples();
    const { theme, primaryColor } = useTheme();
    const { openTutorial } = useTutorial();
    const isDark = theme === 'dark';

    const [game, setGame] = useState<GameSession | null>(null);
    const [loading, setLoading] = useState(true);
    const [questions, setQuestions] = useState<WYRQuestion[]>([]);
    const [toast, setToast] = useState<{ isVisible: boolean; message: string; subMessage?: string; type: 'success' | 'error' }>({ isVisible: false, message: '', type: 'success' });
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
    const [ringCooldown, setRingCooldown] = useState(false);
    const ringCooldownRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    const showToast = (m: string, s?: string, t: 'success' | 'error' = 'success') => setToast({ isVisible: true, message: m, subMessage: s, type: t });
    const state = game?.board_state;
    const partnerId = game ? (game.player_x === user?.id ? game.player_o : game.player_x) : null;
    const currentRound = state?.rounds?.[state.currentRound];
    const myChoice = currentRound?.choices?.[user?.id || ''];
    const partnerChoice = currentRound?.choices?.[partnerId || ''];

    useEffect(() => { loadQuestions().then(setQuestions).catch(console.error); }, []);

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
                    .eq('couple_id', couple.id).eq('game_type', 'would_you_rather').in('status', ['waiting', 'active']).order('created_at', { ascending: false }).limit(1).maybeSingle();
                if (cancelled) return;

                if (existing) {
                    if (existing.status === 'waiting' && existing.player_x !== user.id && !existing.player_o) {
                        const { data: updated } = await (supabase.from('game_sessions') as any)
                            .update({ player_o: user.id }).eq('id', existing.id).select().single();
                        if (!cancelled && updated) { setGame(updated); setTimeout(() => channelRef.current?.send({ type: 'broadcast', event: 'game_update', payload: updated }), 80); }
                    } else { if (!cancelled) setGame(existing); }
                } else {
                    const { data: created } = await (supabase.from('game_sessions') as any).insert({
                        couple_id: couple.id, game_type: 'would_you_rather', board_state: emptyState(),
                        current_turn: user.id, player_x: user.id, player_o: null, winner: null, status: 'waiting'
                    }).select().single();
                    if (!cancelled && created) setGame(created);
                    if (created) sendGameNotification(couple, user.id, 'Would You Rather', '/games/would-you-rather', 'invite');
                }
            } catch (e) {
                console.error('WouldYouRather init error:', e);
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
        ch.on('broadcast', { event: 'game_update' }, ({ payload }) => setGame(payload as GameSession));
        ch.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_sessions', filter: `id=eq.${game.id}` },
            (p) => setGame(p.new as GameSession));
        ch.on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'game_sessions', filter: `id=eq.${game.id}` },
            () => { setGame(null); showToast('Game Ended', 'Partner left'); });
        ch.subscribe(); channelRef.current = ch;
        return () => { supabase.removeChannel(ch); channelRef.current = null; clearTimeout(ringCooldownRef.current); };
    }, [game?.id, user?.id]);

    const broadcast = useCallback(async (updated: GameSession) => {
        setGame(updated);
        channelRef.current?.send({ type: 'broadcast', event: 'game_update', payload: updated });
        await (supabase.from('game_sessions') as any).update({ board_state: updated.board_state, status: updated.status }).eq('id', updated.id);
    }, []);

    /* ─── select rounds ─── */
    const startGameRounds = async (rounds: number) => {
        if (!game || !state) return;
        const newState: WYRState = { ...state, phase: 'pick_category', totalRounds: rounds };
        broadcast({ ...game, board_state: newState, status: 'active' } as GameSession);
    };

    /* ─── select category ─── */
    const selectCategory = (cat: string) => {
        if (!game || !state || questions.length === 0) return;
        const q = pickQuestion(questions, cat, []);
        if (!q) { showToast('No questions found', '', 'error'); return; }
        const round: WYRRound = { question: q, choices: {}, revealed: false };
        const newState: WYRState = {
            ...state, phase: 'playing', category: cat, rounds: [round], currentRound: 0, usedIds: [q.id], matchCount: 0,
        };
        broadcast({ ...game, board_state: newState } as GameSession);
    };

    /* ─── make choice ─── */
    const makeChoice = (choice: 'A' | 'B') => {
        if (!game || !state || !user || myChoice) return;
        const round = { ...currentRound! };
        round.choices = { ...round.choices, [user.id]: choice };

        const bothChose = round.choices[partnerId || ''] !== undefined;
        if (bothChose) round.revealed = true;

        let newMatch = state.matchCount;
        if (bothChose && round.choices[user.id] === round.choices[partnerId || '']) newMatch++;

        const newRounds = [...state.rounds]; newRounds[state.currentRound] = round;
        broadcast({ ...game, board_state: { ...state, rounds: newRounds, matchCount: newMatch, phase: bothChose ? 'revealed' : 'playing' } } as GameSession);
    };

    /* ─── next round ─── */
    const nextRound = () => {
        if (!game || !state || questions.length === 0) return;
        const nextIdx = state.currentRound + 1;
        if (nextIdx >= state.totalRounds) {
            broadcast({ ...game, board_state: { ...state, phase: 'finished' } } as GameSession);
            return;
        }
        const q = pickQuestion(questions, state.category, state.usedIds);
        if (!q) { broadcast({ ...game, board_state: { ...state, phase: 'finished' } } as GameSession); return; }
        const round: WYRRound = { question: q, choices: {}, revealed: false };
        const newRounds = [...state.rounds, round];
        broadcast({ ...game, board_state: { ...state, rounds: newRounds, currentRound: nextIdx, usedIds: [...state.usedIds, q.id], phase: 'playing' } } as GameSession);
    };

    const handlePlayAgain = () => { if (game) try { broadcast({ ...game, board_state: emptyState() } as GameSession); } catch { /* broadcast handles errors internally */ } };
    const handleExit = async () => { try { if (game?.id) await endSession(game.id); } catch {} navigate(-1); };

    if (game?.status === 'ended') return <GameEndedScreen />;

    if (loading) return <div className={`min-h-screen flex items-center justify-center bg-background-dark`}><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-10 h-10 rounded-full" style={{ borderWidth: 3, borderStyle: 'solid', borderColor: primaryColor, borderTopColor: 'transparent' }} /></div>;
    if (!game) return <GameEndedScreen />;

    const matchPct = state && state.rounds.length > 0 ? Math.round((state.matchCount / Math.max(1, state.rounds.filter(r => r.revealed).length)) * 100) : 0;

    return (
        <div className={`min-h-screen flex flex-col font-display transition-colors ${isDark ? 'bg-background-dark text-white' : 'bg-background-dark text-[var(--text-primary)]'}`}>
            <header className={`flex items-center justify-between px-5 py-4 sticky top-0 z-20 backdrop-blur-sm border-b ${isDark ? 'bg-background-dark/95 border-white/5' : 'bg-background-dark/95 border-gray-100'}`}>
                <button onClick={handleExit} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10"><span className="material-symbols-outlined">arrow_back</span></button>
                <h1 className="text-lg font-bold">Would You Rather 🤔</h1>
                <div className="flex items-center">
                    <button
                        onClick={() => openTutorial('would-you-rather')}
                        className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 transition-all active:scale-90 mr-1"
                        title="Watch Tutorial"
                    >
                        <span className="material-symbols-outlined text-xl" style={{ color: primaryColor }}>play_circle</span>
                    </button>
                    <button
                        onClick={async () => {
                            if (!couple || !user || ringCooldown) return;
                            setRingCooldown(true);
                            await sendGameNotification(couple, user.id, 'Would You Rather', '/games/would-you-rather', 'ring');
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

            <main className="flex-1 flex flex-col items-center px-5 gap-4 pb-24 pt-12">
                {game.status === 'waiting' ? (
                    <div className="flex-1 flex flex-col items-center justify-center w-full">
                        {game.player_x === user?.id ? (
                            <div className="text-center w-full max-w-sm">
                                {state?.phase === 'pick_rounds' ? (
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
                                        </div>
                                    </>
                                ) : (
                                    <p className="text-sm mb-2 opacity-60">Rounds: <span className="font-bold" style={{ color: primaryColor }}>{state?.totalRounds}</span></p>
                                )}
                                <div className="flex flex-col items-center gap-3 mt-6">
                                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                                        className="w-12 h-12 rounded-full" style={{ borderWidth: 4, borderStyle: 'solid', borderColor: primaryColor, borderTopColor: 'transparent' }} />
                                    <p className="text-lg font-bold">Waiting for partner to join...</p>
                                    <p className="text-sm text-gray-400">Send your partner to Games → Would You Rather</p>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <h2 className="text-2xl font-bold mb-4">Waiting for creator</h2>
                                <p className="opacity-60 mb-8">The creator hasn't started the game yet.</p>
                                <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                                    className="w-10 h-10 rounded-full mx-auto" style={{ borderWidth: 3, borderStyle: 'solid', borderColor: primaryColor, borderTopColor: 'transparent' }} />
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Match % */}
                        {(state?.phase === 'playing' || state?.phase === 'revealed' || state?.phase === 'finished') && (
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1">
                                    <span className="text-lg">💕</span>
                                    <span className="text-sm font-bold" style={{ color: primaryColor }}>{matchPct}% match</span>
                                </div>
                                <span className="text-xs text-gray-400">•</span>
                                <span className="text-xs text-gray-400">{state?.rounds.filter(r => r.revealed).length}/{state?.totalRounds}</span>
                            </div>
                        )}

                        {/* Category Pick */}
                        {state?.phase === 'pick_category' && game.status === 'active' && (
                            <div className="flex flex-col items-center gap-5 mt-4 w-full max-w-sm">
                                <p className="text-lg font-bold" style={{ color: primaryColor }}>Pick a category!</p>
                                <div className="grid grid-cols-2 gap-3 w-full">
                                    {CATEGORIES.map(c => (
                                        <button key={c.key} onClick={() => selectCategory(c.key)}
                                            className={`py-4 rounded-2xl font-bold text-center active:scale-95 transition-all ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-50 hover:bg-gray-100'}`}>
                                            <span className="text-2xl block mb-1">{c.icon}</span>
                                            <span className="text-sm">{c.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Question */}
                        {(state?.phase === 'playing' || state?.phase === 'revealed') && currentRound && (
                            <>
                                {/* Progress */}
                                <div className="flex gap-1.5 items-center">
                                    {Array.from({ length: state!.totalRounds }).map((_, i) => (
                                        <div key={i} className={`w-2.5 h-2.5 rounded-full transition-all ${i === state!.currentRound ? 'scale-125' : ''}`}
                                            style={{ backgroundColor: i <= state!.currentRound ? primaryColor : isDark ? '#333' : '#ddd' }} />
                                    ))}
                                </div>

                                {/* Category badge */}
                                <span className="text-xs px-3 py-1 rounded-full font-bold" style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}>
                                    {currentRound.question.category}
                                </span>

                                {/* Question text */}
                                <motion.p key={state!.currentRound} initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
                                    className="text-center text-base font-medium leading-relaxed px-2">
                                    {currentRound.question.question}
                                </motion.p>

                                {/* Partner has chosen notification */}
                                {!myChoice && partnerChoice && !currentRound.revealed && (
                                    <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium ${isDark ? 'bg-green-500/10 text-green-400' : 'bg-green-50 text-green-600'}`}>
                                        <span>✅</span> Partner has chosen — your turn!
                                    </motion.div>
                                )}

                                {/* Options */}
                                <div className="flex flex-col gap-3 w-full max-w-sm mt-2">
                                    {(['A', 'B'] as const).map(opt => {
                                        const text = opt === 'A' ? currentRound.question.option_a : currentRound.question.option_b;
                                        const isMine = myChoice === opt;
                                        const isPartner = partnerChoice === opt;
                                        const isRevealed = currentRound.revealed;
                                        const showMatch = isRevealed && isMine && isPartner;

                                        return (
                                            <motion.button key={opt}
                                                whileTap={{ scale: myChoice ? 1 : 0.96 }}
                                                onClick={() => !myChoice && makeChoice(opt)}
                                                disabled={!!myChoice && !isRevealed}
                                                className={`relative p-5 rounded-2xl text-left text-sm font-medium leading-relaxed transition-all border-2 ${
                                                    isRevealed
                                                        ? showMatch
                                                            ? 'border-green-400 bg-green-500/10'
                                                            : isMine
                                                                ? `bg-opacity-10 border-current`
                                                                : isPartner
                                                                    ? 'border-pink-400 bg-pink-500/10'
                                                                    : isDark ? 'border-white/5 bg-white/5' : 'border-gray-100 bg-gray-50'
                                                        : isMine
                                                            ? 'border-current bg-opacity-10'
                                                            : isDark ? 'border-white/10 bg-white/5 hover:bg-white/10' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                                                }`}
                                                style={isMine && !showMatch ? { borderColor: primaryColor, backgroundColor: `${primaryColor}15` } : undefined}>
                                                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full mr-2 text-xs font-black ${isMine ? 'text-white' : isDark ? 'text-white/50 bg-white/10' : 'text-gray-400 bg-gray-200'}`}
                                                    style={isMine ? { backgroundColor: primaryColor } : undefined}>
                                                    {opt}
                                                </span>
                                                {text}

                                                {/* Reveal indicators */}
                                                {isRevealed && (
                                                    <span className="absolute top-2 right-3 flex gap-1">
                                                        {isMine && <span className="text-xs px-1.5 py-0.5 rounded-full font-bold" style={{ backgroundColor: `${primaryColor}30`, color: primaryColor }}>You</span>}
                                                        {isPartner && <span className="text-xs px-1.5 py-0.5 rounded-full font-bold bg-pink-500/20 text-pink-400">Partner</span>}
                                                    </span>
                                                )}
                                            </motion.button>
                                        );
                                    })}
                                </div>

                                {/* Waiting for partner / Match result */}
                                {myChoice && !currentRound.revealed && (
                                    <div className="flex flex-col items-center gap-2 mt-2">
                                        <motion.div animate={{ rotate:360 }} transition={{ duration:2, repeat:Infinity, ease:'linear' }}
                                            className="w-5 h-5 rounded-full" style={{ borderWidth:2, borderStyle:'solid', borderColor:primaryColor, borderTopColor:'transparent' }} />
                                        <p className="text-xs text-gray-400">Waiting for partner's choice...</p>
                                    </div>
                                )}

                                {currentRound.revealed && (
                                    <motion.div initial={{ opacity:0, scale:0.8 }} animate={{ opacity:1, scale:1 }} className="flex flex-col items-center gap-3 mt-2">
                                        <p className="text-2xl">{myChoice === partnerChoice ? '💕' : '😜'}</p>
                                        <p className="text-sm font-bold" style={{ color: myChoice === partnerChoice ? '#22C55E' : '#F59E0B' }}>
                                            {myChoice === partnerChoice ? 'You both agree!' : 'Different choices!'}
                                        </p>
                                        <button onClick={nextRound}
                                            className="on-brand w-full max-w-xs px-6 py-4 rounded-2xl font-bold text-white shadow-lg active:scale-95" style={{ backgroundColor: primaryColor }}>
                                            {(state!.currentRound + 1) >= state!.totalRounds ? 'See Results 🏆' : 'Next Question ➡️'}
                                        </button>
                                    </motion.div>
                                )}
                            </>
                        )}

                        {/* Finished */}
                        {state?.phase === 'finished' && (
                            <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} className="flex flex-col items-center gap-4 text-center mt-6">
                                <p className="text-4xl">{matchPct >= 80 ? '🥰' : matchPct >= 50 ? '😊' : '😜'}</p>
                                <p className="text-2xl font-black" style={{ color: primaryColor }}>{matchPct}% Compatible!</p>
                                <p className="text-sm text-gray-400">You matched on {state.matchCount} of {state.rounds.filter(r => r.revealed).length} questions</p>

                                {/* Breakdown */}
                                <div className="w-full max-w-xs mt-2">
                                    <div className="h-3 rounded-full overflow-hidden bg-gray-200 dark:bg-white/10">
                                        <motion.div initial={{ width:0 }} animate={{ width: `${matchPct}%` }} transition={{ duration:1, ease:'easeOut' }}
                                            className="h-full rounded-full" style={{ backgroundColor: primaryColor }} />
                                    </div>
                                </div>

                                <div className="flex flex-col items-center gap-3 w-full max-w-xs mt-4">
                                    <button onClick={handlePlayAgain} className="on-brand w-full px-6 py-4 rounded-2xl font-bold text-white shadow-lg active:scale-95" style={{ backgroundColor: primaryColor }}>Play Again 🔄</button>
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

export default WouldYouRather;
