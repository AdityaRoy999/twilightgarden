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

interface WordEntry { id: number; word: string; }
interface WordBank { easy: WordEntry[]; medium: WordEntry[]; hard: WordEntry[]; }

let wordBankCache: WordBank | null = null;
const loadWordBank = async (): Promise<WordBank> => {
    if (wordBankCache) return wordBankCache;
    try {
        const res = await fetch('./Games_data/words_30000_categorized.json');
        wordBankCache = await res.json();
    } catch {
        wordBankCache = { easy: [], medium: [], hard: [] };
    }
    return wordBankCache!;
};

const FALLBACK_WORDS = [
    'LOVE','HEART','KISS','ROSES','SWEET','DREAM','TRUST','ANGEL','SMILE','HAPPY',
    'CANDY','PEARL','OCEAN','FLAME','CLOUD','GRACE','BLOOM','LIGHT','BRAVE','CHARM',
];

const MAX_GUESSES = 6;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

interface WordGuessState {
    word: string;
    guesses: string[];
    phase: 'setup_rounds' | 'setup_difficulty' | 'picking' | 'guessing' | 'finished';
    picker: string;
    guesser: string;
    result: 'win' | 'lose' | null;
    scores: Record<string, number>;
    totalRounds: number;
    currentRound: number;
    difficulty: 'easy' | 'medium' | 'hard' | null;
}

interface GameSession {
    id: string;
    couple_id: string;
    game_type: string;
    board_state: WordGuessState;
    current_turn: string;
    player_x: string;
    player_o: string | null;
    winner: string | null;
    status: 'waiting' | 'active' | 'finished' | 'ended';
    created_at: string;
}

const emptyState = (pickerId: string, guesserId: string): WordGuessState => ({
    word: '', guesses: [], phase: 'setup_rounds',
    picker: pickerId, guesser: guesserId, result: null, scores: {},
    totalRounds: 0, currentRound: 0, difficulty: null,
});

const getCellColor = (letter: string, index: number, word: string, guess: string, isDark: boolean, primaryColor: string): { bg: string; border: string; text: string } => {
    // Exact match — green
    if (word[index] === letter) return { bg: primaryColor, border: primaryColor, text: '#fff' };
    // Count how many of this letter are in the word
    let letterCountInWord = 0;
    for (const ch of word) if (ch === letter) letterCountInWord++;
    // Subtract exact matches already accounted for in the guess
    for (let i = 0; i < guess.length; i++) {
        if (guess[i] === letter && word[i] === letter) letterCountInWord--;
    }
    // Count yellow claims before this index
    let yellowsBefore = 0;
    for (let i = 0; i < index; i++) {
        if (guess[i] === letter && word[i] !== letter && word.includes(letter)) yellowsBefore++;
    }
    // Present (yellow) only if there are remaining unmatched occurrences
    if (word.includes(letter) && yellowsBefore < letterCountInWord) {
        return { bg: '#EAB308', border: '#CA8A04', text: '#fff' };
    }
    return { bg: isDark ? '#333' : '#ddd', border: isDark ? '#555' : '#bbb', text: isDark ? '#888' : '#666' };
};

const WordGuess: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { couple } = useCouples();
    const { theme, primaryColor } = useTheme();
    const { openTutorial } = useTutorial();
    const isDark = theme === 'dark';

    const [game, setGame] = useState<GameSession | null>(null);
    const [loading, setLoading] = useState(true);
    const [customWord, setCustomWord] = useState('');
    const [currentGuess, setCurrentGuess] = useState('');
    const [shakeRow, setShakeRow] = useState(-1);
    const [wordBank, setWordBank] = useState<WordBank | null>(null);
    const [toast, setToast] = useState<{ isVisible: boolean; message: string; subMessage?: string; type: 'success' | 'error' }>({ isVisible: false, message: '', type: 'success' });
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
    const [ringCooldown, setRingCooldown] = useState(false);
    const ringCooldownRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    useEffect(() => { loadWordBank().then(setWordBank); }, []);

    const showToast = (m: string, s?: string, t: 'success' | 'error' = 'success') => setToast({ isVisible: true, message: m, subMessage: s, type: t });

    const state = game?.board_state;
    const amPicker = state?.picker === user?.id;
    const amGuesser = state?.guesser === user?.id;
    const wordLen = state?.word?.length || 5;

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
                    .eq('couple_id', couple.id).eq('game_type', 'wordguess')
                    .in('status', ['waiting', 'active']).order('created_at', { ascending: false }).limit(1).maybeSingle();
                if (cancelled) return;

                if (existing) {
                    if (existing.player_x !== user.id && !existing.player_o) {
                        const updatedState = { ...existing.board_state, guesser: user.id, scores: { [existing.player_x]: 0, [user.id]: 0 } };
                        const { data: updated } = await (supabase.from('game_sessions') as any)
                            .update({ player_o: user.id, board_state: updatedState }).eq('id', existing.id).select().single();
                        if (!cancelled && updated) { setGame(updated); setTimeout(() => channelRef.current?.send({ type: 'broadcast', event: 'game_update', payload: updated }), 80); }
                    } else { if (!cancelled) setGame(existing); }
                } else {
                    const initState = emptyState(user.id, '');
                    initState.scores = { [user.id]: 0 };
                    const { data: created } = await (supabase.from('game_sessions') as any).insert({
                        couple_id: couple.id, game_type: 'wordguess', board_state: initState,
                        current_turn: user.id, player_x: user.id, player_o: null, winner: null, status: 'waiting'
                    }).select().single();
                    if (!cancelled && created) setGame(created);
                    if (created) sendGameNotification(couple, user.id, 'Word Guess', '/games/wordle', 'invite');
                }
            } catch (e) {
                console.error('WordGuess init error:', e);
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

    /* ─── setup: pick rounds ─── */
    const startGameRounds = async (rounds: number) => {
        if (!game || !state) return;
        const newState: WordGuessState = { ...state, phase: 'setup_difficulty', totalRounds: rounds };
        const opt = { ...game, board_state: newState, status: 'active' as const } as GameSession;
        setGame(opt);
        channelRef.current?.send({ type: 'broadcast', event: 'game_update', payload: opt });
        await (supabase.from('game_sessions') as any).update({ board_state: newState, status: 'active' }).eq('id', game.id);
    };

    /* ─── setup: pick difficulty ─── */
    const startWithDifficulty = async (diff: 'easy' | 'medium' | 'hard') => {
        if (!game || !state) return;
        const newState: WordGuessState = { ...state, phase: 'picking', difficulty: diff, currentRound: 1 };
        const opt = { ...game, board_state: newState } as GameSession;
        setGame(opt);
        channelRef.current?.send({ type: 'broadcast', event: 'game_update', payload: opt });
        await (supabase.from('game_sessions') as any).update({ board_state: newState }).eq('id', game.id);
    };

    /* ─── pick word ─── */
    const pickRandom = async () => {
        if (!game || !user || !state?.difficulty) return;
        const pool = wordBank?.[state.difficulty];
        if (pool && pool.length > 0) {
            const entry = pool[Math.floor(Math.random() * pool.length)];
            await setWord(entry.word.toUpperCase());
        } else {
            const word = FALLBACK_WORDS[Math.floor(Math.random() * FALLBACK_WORDS.length)];
            await setWord(word);
        }
    };

    const pickCustom = async () => {
        if (!game || !user || !customWord.trim()) return;
        const clean = customWord.trim().toUpperCase().replace(/[^A-Z]/g, '');
        if (clean.length < 3 || clean.length > 8) { showToast('Invalid', 'Word must be 3-8 letters', 'error'); return; }
        await setWord(clean);
    };

    const setWord = async (word: string) => {
        if (!game) return;
        const newState: WordGuessState = { ...game.board_state, word, phase: 'guessing', guesses: [], result: null };
        const updates = { board_state: newState };
        const opt = { ...game, ...updates } as GameSession;
        setGame(opt); setCustomWord('');
        channelRef.current?.send({ type: 'broadcast', event: 'game_update', payload: opt });
        await (supabase.from('game_sessions') as any).update(updates).eq('id', game.id);
    };

    /* ─── submit guess ─── */
    const submitGuess = async () => {
        if (!game || !user || !amGuesser || !state || state.phase !== 'guessing') return;
        const guess = currentGuess.toUpperCase();
        if (guess.length !== wordLen) { showToast('Not enough letters', `Needs ${wordLen} letters`, 'error'); return; }

        const newGuesses = [...state.guesses, guess];
        const isWin = guess === state.word;
        const isLose = !isWin && newGuesses.length >= MAX_GUESSES;
        const isFinished = isWin || isLose;

        const newScores = { ...state.scores };
        if (isWin) newScores[state.guesser] = (newScores[state.guesser] || 0) + 1;
        if (isLose) newScores[state.picker] = (newScores[state.picker] || 0) + 1;

        const newState: WordGuessState = { ...state, guesses: newGuesses, result: isWin ? 'win' : isLose ? 'lose' : null, phase: isFinished ? 'finished' : 'guessing', scores: newScores };
        const updates = { board_state: newState };
        const opt = { ...game, ...updates } as GameSession;
        setGame(opt); setCurrentGuess('');
        channelRef.current?.send({ type: 'broadcast', event: 'game_update', payload: opt });
        await (supabase.from('game_sessions') as any).update(updates).eq('id', game.id);
    };

    /* ─── keyboard input ─── */
    const handleKey = (letter: string) => {
        if (currentGuess.length < wordLen) setCurrentGuess(prev => prev + letter);
    };
    const handleBackspace = () => setCurrentGuess(prev => prev.slice(0, -1));
    const handleEnter = () => {
        if (currentGuess.length === wordLen) submitGuess();
        else { setShakeRow(state?.guesses.length || 0); setTimeout(() => setShakeRow(-1), 500); }
    };

    /* ─── next round (swap) ─── */
    const handleNextRound = async () => {
        if (!game || !user || !state) return;
        const nextRound = (state.currentRound || 0) + 1;
        if (state.totalRounds > 0 && nextRound > state.totalRounds) {
            // Game over — all rounds played
            const opt = { ...game, board_state: { ...state, phase: 'finished' as const, result: null }, status: 'ended' as const } as GameSession;
            setGame(opt);
            channelRef.current?.send({ type: 'broadcast', event: 'game_update', payload: opt });
            await (supabase.from('game_sessions') as any).update({ board_state: opt.board_state, status: 'ended' }).eq('id', game.id);
            return;
        }
        const newState: WordGuessState = { ...state, word: '', guesses: [], phase: 'picking', picker: state.guesser, guesser: state.picker, result: null, currentRound: nextRound };
        const updates = { board_state: newState };
        const opt = { ...game, ...updates } as GameSession;
        setGame(opt);
        channelRef.current?.send({ type: 'broadcast', event: 'game_update', payload: opt });
        await (supabase.from('game_sessions') as any).update(updates).eq('id', game.id);
    };

    const handleExit = async () => { try { if (game?.id) await endSession(game.id); } catch {} navigate('/games'); };

    /* ─── keyboard letter status (for coloring) ─── */
    const getKeyStatus = (letter: string): 'correct' | 'present' | 'absent' | 'unused' => {
        if (!state?.word) return 'unused';
        for (const guess of state.guesses) {
            for (let i = 0; i < guess.length; i++) {
                if (guess[i] === letter && state.word[i] === letter) return 'correct';
            }
        }
        for (const guess of state.guesses) {
            if (guess.includes(letter) && state.word.includes(letter)) return 'present';
        }
        for (const guess of state.guesses) {
            if (guess.includes(letter)) return 'absent';
        }
        return 'unused';
    };

    if (loading) return <div className={`min-h-screen flex items-center justify-center bg-background-dark`}><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-10 h-10 rounded-full" style={{ borderWidth: 3, borderStyle: 'solid', borderColor: primaryColor, borderTopColor: 'transparent' }} /></div>;
    if (game?.status === 'ended') return <GameEndedScreen />;
    if (!game) return <GameEndedScreen />;

    const myScore = state?.scores?.[user?.id || ''] || 0;
    const partnerId = game.player_x === user?.id ? game.player_o : game.player_x;
    const partnerScore = partnerId ? (state?.scores?.[partnerId] || 0) : 0;

    return (
        <div className={`min-h-screen flex flex-col font-display transition-colors ${isDark ? 'bg-background-dark text-white' : 'bg-background-dark text-[var(--text-primary)]'}`}>
            <header className={`flex items-center justify-between px-5 py-4 sticky top-0 z-20 backdrop-blur-sm border-b ${isDark ? 'bg-background-dark/95 border-white/5' : 'bg-background-dark/95 border-gray-100'}`}>
                <button onClick={handleExit} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10"><span className="material-symbols-outlined">arrow_back</span></button>
                <h1 className="text-lg font-bold">Word Guess</h1>
                <div className="flex items-center">
                    <button
                        onClick={() => openTutorial('wordle')}
                        className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 transition-all active:scale-90 mr-1"
                        title="Watch Tutorial"
                    >
                        <span className="material-symbols-outlined text-xl" style={{ color: primaryColor }}>play_circle</span>
                    </button>
                    <button
                        onClick={async () => {
                            if (!couple || !user || ringCooldown) return;
                            setRingCooldown(true);
                            await sendGameNotification(couple, user.id, 'Word Guess', '/games/wordle', 'ring');
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

            <main className="flex-1 flex flex-col items-center px-4 gap-4 pb-24 pt-12">
                {/* Scores */}
                <div className="flex items-center justify-center gap-6 w-full max-w-xs">
                    <div className="flex flex-col items-center gap-1">
                        <div className="text-2xl font-black" style={{ color: primaryColor }}>{myScore}</div>
                        <span className="text-xs font-bold">{amPicker ? '🎯 Picker' : '💭 Guesser'}</span>
                    </div>
                    <div className={`text-sm font-bold px-3 py-1 rounded-full ${isDark ? 'bg-white/5 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>VS</div>
                    <div className="flex flex-col items-center gap-1">
                        <div className={`text-2xl font-black ${isDark ? 'text-pink-400' : 'text-pink-500'}`}>{partnerScore}</div>
                        <span className="text-xs font-bold">{amPicker ? '💭 Guesser' : '🎯 Picker'}</span>
                    </div>
                </div>

                {/* Waiting status */}
                {game.status === 'waiting' && (
                    <div className="flex flex-col items-center gap-5 mt-4 w-full max-w-sm">
                        {game.player_x === user?.id ? (
                            <div className="text-center w-full">
                                {state?.phase === 'setup_rounds' ? (
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
                                    <p className="text-sm text-gray-400">Send your partner to Games → Word Guess</p>
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
                )}

                {/* Difficulty selection (after rounds, once active) */}
                {state?.phase === 'setup_difficulty' && game.status === 'active' && (
                    <div className="flex flex-col items-center gap-5 mt-4 w-full max-w-sm">
                        {game.player_x === user?.id ? (
                            <>
                                <p className="text-lg font-bold" style={{ color: primaryColor }}>Choose difficulty!</p>
                                <p className="text-xs text-gray-400">This applies to all randomly picked words.</p>
                                <div className="flex gap-2 w-full">
                                    <button onClick={() => startWithDifficulty('easy')} className="flex-1 py-4 rounded-2xl font-bold text-white active:scale-95 transition-transform text-sm" style={{ backgroundColor: '#22C55E' }}>😊 Easy</button>
                                    <button onClick={() => startWithDifficulty('medium')} className="flex-1 py-4 rounded-2xl font-bold text-white active:scale-95 transition-transform text-sm" style={{ backgroundColor: '#EAB308' }}>🤔 Medium</button>
                                    <button onClick={() => startWithDifficulty('hard')} className="flex-1 py-4 rounded-2xl font-bold text-white active:scale-95 transition-transform text-sm" style={{ backgroundColor: '#EF4444' }}>🔥 Hard</button>
                                </div>
                                <p className="text-xs text-gray-400">30,000 words across 3 difficulty levels</p>
                            </>
                        ) : (
                            <div className="flex flex-col items-center gap-3 mt-8">
                                <motion.div animate={{ rotate:360 }} transition={{ duration:2, repeat:Infinity, ease:'linear' }}
                                    className="w-6 h-6 rounded-full" style={{ borderWidth:2, borderStyle:'solid', borderColor:primaryColor, borderTopColor:'transparent' }} />
                                <p className="text-sm text-gray-400">Creator is selecting difficulty...</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Picking phase */}
                {state?.phase === 'picking' && game.status === 'active' && (
                    <div className="flex flex-col items-center gap-5 mt-4 w-full max-w-sm">
                        {/* Round counter */}
                        {state.totalRounds > 0 && (
                            <div className="flex gap-1.5 items-center">
                                {Array.from({ length: state.totalRounds }).map((_, i) => (
                                    <div key={i} className={`w-2.5 h-2.5 rounded-full transition-all ${i + 1 === state.currentRound ? 'scale-125' : ''}`}
                                        style={{ backgroundColor: i < state.currentRound ? primaryColor : isDark ? '#333' : '#ddd' }} />
                                ))}
                            </div>
                        )}
                        {amPicker ? (
                            <>
                                <p className="text-lg font-bold" style={{ color: primaryColor }}>Pick a word for your partner!</p>
                                <button onClick={pickRandom}
                                    className="w-full py-4 rounded-2xl font-bold text-white active:scale-95 transition-transform shadow-lg"
                                    style={{ backgroundColor: primaryColor }}>
                                    🎲 Random {state.difficulty?.charAt(0).toUpperCase()}{state.difficulty?.slice(1)} Word
                                </button>
                                <div className="flex items-center gap-2 w-full">
                                    <div className="flex-1 h-px bg-gray-300 dark:bg-gray-700" />
                                    <span className="text-xs text-gray-400">or</span>
                                    <div className="flex-1 h-px bg-gray-300 dark:bg-gray-700" />
                                </div>
                                <div className="flex gap-2 w-full">
                                    <input type="text" value={customWord} onChange={e => setCustomWord(e.target.value.replace(/[^a-zA-Z]/g, ''))}
                                        placeholder="Type your own (3-8 letters)..."
                                        className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium outline-none ${isDark ? 'bg-white/10 text-white placeholder-gray-500' : 'bg-gray-100 text-gray-800 placeholder-gray-400'}`}
                                        maxLength={8} />
                                    <button onClick={pickCustom} disabled={!customWord.trim()}
                                        className="on-brand px-5 py-3 rounded-xl font-bold text-white disabled:opacity-40" style={{ backgroundColor: primaryColor }}>Set</button>
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center gap-3 mt-8">
                                <motion.div animate={{ rotate:360 }} transition={{ duration:2, repeat:Infinity, ease:'linear' }}
                                    className="w-6 h-6 rounded-full" style={{ borderWidth:2, borderStyle:'solid', borderColor:primaryColor, borderTopColor:'transparent' }} />
                                <p className="text-sm text-gray-400">Partner is picking a word...</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Guessing / Finished phase */}
                {(state?.phase === 'guessing' || state?.phase === 'finished') && state?.word && (
                    <>
                        {/* Round counter */}
                        {state.totalRounds > 0 && (
                            <div className="flex gap-1.5 items-center">
                                {Array.from({ length: state.totalRounds }).map((_, i) => (
                                    <div key={i} className={`w-2.5 h-2.5 rounded-full transition-all ${i + 1 === state.currentRound ? 'scale-125' : ''}`}
                                        style={{ backgroundColor: i < state.currentRound ? primaryColor : isDark ? '#333' : '#ddd' }} />
                                ))}
                            </div>
                        )}
                        {/* Board */}
                        <div className="flex flex-col gap-1.5 items-center">
                            {Array.from({ length: MAX_GUESSES }).map((_, row) => {
                                const guess = state.guesses[row];
                                const isCurrent = row === state.guesses.length && state.phase === 'guessing' && amGuesser;
                                const display = guess || (isCurrent ? currentGuess.padEnd(wordLen, ' ') : '');
                                const isShaking = shakeRow === row;
                                return (
                                    <motion.div key={row} animate={isShaking ? { x: [0, -8, 8, -8, 0] } : {}} transition={{ duration: 0.4 }}
                                        className="flex gap-1.5">
                                        {Array.from({ length: wordLen }).map((_, col) => {
                                            const letter = display[col] || '';
                                            const trimmed = letter.trim();
                                            if (guess) {
                                                const colors = getCellColor(letter, col, state.word, guess, isDark, primaryColor);
                                                return (
                                                    <motion.div key={col} initial={{ rotateX: 90 }} animate={{ rotateX: 0 }} transition={{ delay: col * 0.12, duration: 0.3 }}
                                                        className="w-11 h-11 rounded-lg flex items-center justify-center text-base font-black"
                                                        style={{ backgroundColor: colors.bg, borderWidth: 2, borderStyle: 'solid', borderColor: colors.border, color: colors.text }}>
                                                        {letter}
                                                    </motion.div>
                                                );
                                            }
                                            return (
                                                <div key={col} className={`w-11 h-11 rounded-lg flex items-center justify-center text-base font-black border-2 ${
                                                    isCurrent && trimmed ? (isDark ? 'border-white/40' : 'border-gray-400')
                                                        : (isDark ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-gray-50')}`}>
                                                    {trimmed}
                                                </div>
                                            );
                                        })}
                                    </motion.div>
                                );
                            })}
                        </div>

                        {/* Picker sees their word */}
                        {amPicker && state.phase === 'guessing' && (
                            <p className="text-xs text-gray-400 mt-1">Your word: <span className="font-bold" style={{ color: primaryColor }}>{state.word}</span></p>
                        )}

                        {/* Result */}
                        {state.phase === 'finished' && (
                            <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} className="text-center">
                                {state.result === 'win' && amGuesser && <p className="text-xl font-bold text-green-500">You got it! 🎉</p>}
                                {state.result === 'win' && amPicker && <p className="text-xl font-bold text-red-400">They guessed it! 😅</p>}
                                {state.result === 'lose' && amGuesser && <p className="text-xl font-bold text-red-400">The word was: <span style={{ color: primaryColor }}>{state.word}</span> 💀</p>}
                                {state.result === 'lose' && amPicker && <p className="text-xl font-bold text-green-500">They couldn't get it! 🎯</p>}
                            </motion.div>
                        )}

                        {/* Keyboard (guesser only during guessing) */}
                        {state.phase === 'guessing' && amGuesser && (
                            <div className="flex flex-col items-center gap-1.5 w-full max-w-sm mt-2">
                                {['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'].map((row, ri) => (
                                    <div key={ri} className="flex gap-1 justify-center">
                                        {ri === 2 && (
                                            <button onClick={handleEnter} className="px-3 h-10 rounded-lg text-xs font-bold" style={{ backgroundColor: primaryColor, color: '#fff' }}>
                                                ENTER
                                            </button>
                                        )}
                                        {row.split('').map(letter => {
                                            const status = getKeyStatus(letter);
                                            const bgColor = status === 'correct' ? primaryColor
                                                : status === 'present' ? '#EAB308'
                                                : status === 'absent' ? (isDark ? '#333' : '#bbb')
                                                : (isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb');
                                            const textColor = status === 'correct' || status === 'present' ? '#fff'
                                                : status === 'absent' ? (isDark ? '#666' : '#999')
                                                : (isDark ? '#fff' : '#333');
                                            return (
                                                <motion.button key={letter} whileTap={{ scale: 0.85 }} onClick={() => handleKey(letter)}
                                                    className="w-8 h-10 rounded-lg text-sm font-bold transition-colors"
                                                    style={{ backgroundColor: bgColor, color: textColor }}>
                                                    {letter}
                                                </motion.button>
                                            );
                                        })}
                                        {ri === 2 && (
                                            <button onClick={handleBackspace} className={`px-3 h-10 rounded-lg text-xs font-bold ${isDark ? 'bg-white/10' : 'bg-gray-200'}`}>
                                                ⌫
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {state.phase === 'guessing' && amPicker && (
                            <p className="text-sm text-gray-400 mt-2">Partner is guessing your word...</p>
                        )}

                        {/* Next / Exit */}
                        {state.phase === 'finished' && (
                            <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} className="flex flex-col items-center gap-3 w-full max-w-xs mt-2">
                                <button onClick={handleNextRound} className="on-brand w-full px-6 py-4 rounded-2xl font-bold text-white shadow-lg active:scale-95" style={{ backgroundColor: primaryColor }}>
                                    {state.totalRounds > 0 && (state.currentRound || 0) >= state.totalRounds ? 'See Results 🏆' : 'Next Round (swap roles) 🔄'}
                                </button>
                                <button onClick={handleExit} className={`w-full px-6 py-3 rounded-2xl font-bold ${isDark ? 'bg-white/5 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>Exit Game</button>
                            </motion.div>
                        )}
                    </>
                )}

            </main>

            <Toast message={toast.message} subMessage={toast.subMessage} isVisible={toast.isVisible} onClose={() => setToast(p => ({ ...p, isVisible: false }))} type={toast.type} />
        </div>
    );
};

export default WordGuess;
