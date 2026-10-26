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

const WORDS = [
    'love','heart','kiss','date','roses','forever','sunset','darling','cuddle','romance',
    'passion','angel','trust','dream','adore','beauty','gentle','happy','smile','sweet',
    'candle','garden','melody','sparkle','tender','twilight','blossom','cherish','destiny','embrace',
    'flower','heaven','journey','miracle','promise','whisper','delight','harmony','moonlight','starlight',
    'affection','butterfly','chocolate','diamond','enchant','firefly','gratitude','honeymoon','intimate','jewelry',
    'kindness','laughter','memories','paradise','serenade','treasure','universe','valentine','wonderful','adventure',
];

const MAX_WRONG = 6;

interface HangmanState {
    word: string;
    guessed: string[];
    wrong: number;
    phase: 'picking' | 'guessing' | 'finished';
    picker: string;
    guesser: string;
    result: 'win' | 'lose' | null;
    scores: Record<string, number>;
}

interface GameSession {
    id: string;
    couple_id: string;
    game_type: string;
    board_state: HangmanState;
    current_turn: string;
    player_x: string;
    player_o: string | null;
    winner: string | null;
    status: 'waiting' | 'active' | 'finished' | 'ended';
    created_at: string;
}

const emptyState = (pickerId: string, guesserId: string): HangmanState => ({
    word: '', guessed: [], wrong: 0, phase: 'picking',
    picker: pickerId, guesser: guesserId, result: null, scores: {},
});

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// Simple hangman SVG parts
const HangmanFigure: React.FC<{ wrong: number; color: string }> = ({ wrong, color }) => (
    <svg viewBox="0 0 200 220" className="w-full h-full max-w-[180px]">
        {/* Gallows */}
        <line x1="40" y1="210" x2="160" y2="210" stroke={color} strokeWidth="4" strokeLinecap="round" opacity={0.3} />
        <line x1="80" y1="210" x2="80" y2="30" stroke={color} strokeWidth="4" strokeLinecap="round" opacity={0.3} />
        <line x1="80" y1="30" x2="140" y2="30" stroke={color} strokeWidth="4" strokeLinecap="round" opacity={0.3} />
        <line x1="140" y1="30" x2="140" y2="50" stroke={color} strokeWidth="4" strokeLinecap="round" opacity={0.3} />
        {/* Head */}
        {wrong >= 1 && <motion.circle initial={{ scale: 0 }} animate={{ scale: 1 }} cx="140" cy="65" r="15" stroke={color} strokeWidth="3" fill="none" />}
        {/* Body */}
        {wrong >= 2 && <motion.line initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} x1="140" y1="80" x2="140" y2="130" stroke={color} strokeWidth="3" strokeLinecap="round" />}
        {/* Left arm */}
        {wrong >= 3 && <motion.line initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} x1="140" y1="95" x2="115" y2="115" stroke={color} strokeWidth="3" strokeLinecap="round" />}
        {/* Right arm */}
        {wrong >= 4 && <motion.line initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} x1="140" y1="95" x2="165" y2="115" stroke={color} strokeWidth="3" strokeLinecap="round" />}
        {/* Left leg */}
        {wrong >= 5 && <motion.line initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} x1="140" y1="130" x2="120" y2="165" stroke={color} strokeWidth="3" strokeLinecap="round" />}
        {/* Right leg */}
        {wrong >= 6 && <motion.line initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} x1="140" y1="130" x2="160" y2="165" stroke={color} strokeWidth="3" strokeLinecap="round" />}
    </svg>
);

const Hangman: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { couple } = useCouples();
    const { theme, primaryColor } = useTheme();
    const { openTutorial } = useTutorial();
    const isDark = theme === 'dark';

    const [game, setGame] = useState<GameSession | null>(null);
    const [loading, setLoading] = useState(true);
    const [customWord, setCustomWord] = useState('');
    const [toast, setToast] = useState<{ isVisible: boolean; message: string; subMessage?: string; type: 'success' | 'error' }>({ isVisible: false, message: '', type: 'success' });
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
    const [ringCooldown, setRingCooldown] = useState(false);
    const ringCooldownRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    const showToast = (m: string, s?: string, t: 'success' | 'error' = 'success') => setToast({ isVisible: true, message: m, subMessage: s, type: t });

    const amPicker = game?.board_state?.picker === user?.id;
    const amGuesser = game?.board_state?.guesser === user?.id;

    /* ─── init ─── */
    useEffect(() => {
        if (!couple?.id || !user?.id) return;
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const { data: existing } = await (supabase.from('game_sessions') as any).select('*')
                    .eq('couple_id', couple.id).eq('game_type', 'hangman')
                    .in('status', ['waiting', 'active']).order('created_at', { ascending: false }).limit(1).maybeSingle();
                if (cancelled) return;

                if (existing) {
                    if (existing.status === 'waiting' && existing.player_x !== user.id && !existing.player_o) {
                        const updatedState = { ...existing.board_state, guesser: user.id, scores: { [existing.player_x]: 0, [user.id]: 0 } };
                        const { data: updated } = await (supabase.from('game_sessions') as any)
                            .update({ player_o: user.id, status: 'active', board_state: updatedState }).eq('id', existing.id).select().single();
                        if (!cancelled && updated) { setGame(updated); setTimeout(() => channelRef.current?.send({ type: 'broadcast', event: 'game_update', payload: updated }), 80); }
                    } else { if (!cancelled) setGame(existing); }
                } else {
                    const initState = emptyState(user.id, '');
                    initState.scores = { [user.id]: 0 };
                    const { data: created } = await (supabase.from('game_sessions') as any).insert({
                        couple_id: couple.id, game_type: 'hangman', board_state: initState,
                        current_turn: user.id, player_x: user.id, player_o: null, winner: null, status: 'waiting'
                    }).select().single();
                    if (!cancelled && created) setGame(created);
                    if (created) sendGameNotification(couple, user.id, 'Hangman', '/games/hangman', 'invite');
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

    /* ─── pick random word ─── */
    const pickRandom = async () => {
        if (!game || !user) return;
        const word = WORDS[Math.floor(Math.random() * WORDS.length)].toUpperCase();
        await setWord(word);
    };

    const pickCustom = async () => {
        if (!game || !user || !customWord.trim()) return;
        const clean = customWord.trim().toUpperCase().replace(/[^A-Z]/g, '');
        if (clean.length < 2) { showToast('Too short', 'Word must be at least 2 letters', 'error'); return; }
        await setWord(clean);
    };

    const setWord = async (word: string) => {
        if (!game) return;
        const newState: HangmanState = { ...game.board_state, word, phase: 'guessing', guessed: [], wrong: 0, result: null };
        const updates = { board_state: newState };
        const opt = { ...game, ...updates } as GameSession;
        setGame(opt); setCustomWord('');
        channelRef.current?.send({ type: 'broadcast', event: 'game_update', payload: opt });
        await (supabase.from('game_sessions') as any).update(updates).eq('id', game.id);
    };

    /* ─── guess letter ─── */
    const guessLetter = async (letter: string) => {
        if (!game || !user || !amGuesser || game.board_state.phase !== 'guessing') return;
        if (game.board_state.guessed.includes(letter)) return;

        // Use functional update to avoid stale closure on rapid clicks
        setGame(prev => {
            if (!prev || prev.board_state.guessed.includes(letter)) return prev;
            const state = prev.board_state;
            const newGuessed = [...state.guessed, letter];
            const isCorrect = state.word.includes(letter);
            const newWrong = isCorrect ? state.wrong : state.wrong + 1;

            const wordLetters = new Set(state.word.split(''));
            const guessedCorrect = new Set(newGuessed.filter(l => wordLetters.has(l)));
            const isWin = wordLetters.size === guessedCorrect.size;
            const isLose = newWrong >= MAX_WRONG;
            const isFinished = isWin || isLose;

            const newScores = { ...state.scores };
            if (isWin) newScores[state.guesser] = (newScores[state.guesser] || 0) + 1;
            else if (isLose) newScores[state.picker] = (newScores[state.picker] || 0) + 1;

            const newState: HangmanState = {
                ...state,
                guessed: newGuessed,
                wrong: newWrong,
                result: isWin ? 'win' : isLose ? 'lose' : null,
                phase: isFinished ? 'finished' : 'guessing',
                scores: newScores,
            };

            const updates: Record<string, any> = { board_state: newState };
            const opt = { ...prev, ...updates } as GameSession;
            channelRef.current?.send({ type: 'broadcast', event: 'game_update', payload: opt });
            (supabase.from('game_sessions') as any).update(updates).eq('id', prev.id);
            return opt;
        });
    };

    /* ─── next round (swap roles) ─── */
    const handleNextRound = async () => {
        if (!game || !user) return;
        const prev = game;
        const state = game.board_state;
        const newState: HangmanState = {
            ...state,
            word: '',
            guessed: [],
            wrong: 0,
            phase: 'picking',
            picker: state.guesser,
            guesser: state.picker,
            result: null,
        };
        const updates = { board_state: newState };
        const opt = { ...game, ...updates } as GameSession;
        setGame(opt);
        try {
            channelRef.current?.send({ type: 'broadcast', event: 'game_update', payload: opt });
            const { error } = await (supabase.from('game_sessions') as any).update(updates).eq('id', game.id);
            if (error) { setGame(prev); }
        } catch {
            setGame(prev);
        }
    };

    const handleExit = async () => { try { if (game?.id) await endSession(game.id); } catch {} navigate('/games'); };

    if (loading) return <div className={`min-h-screen flex items-center justify-center bg-background-dark`}><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-10 h-10 rounded-full" style={{ borderWidth: 3, borderStyle: 'solid', borderColor: primaryColor, borderTopColor: 'transparent' }} /></div>;
    if (game?.status === 'ended') return <GameEndedScreen />;
    if (!game) return <GameEndedScreen />;

    const state = game.board_state;
    const myScore = state.scores?.[user?.id || ''] || 0;
    const partnerId = game.player_x === user?.id ? game.player_o : game.player_x;
    const partnerScore = partnerId ? (state.scores?.[partnerId] || 0) : 0;

    return (
        <div className={`min-h-screen flex flex-col font-display transition-colors ${isDark ? 'bg-background-dark text-white' : 'bg-background-dark text-[var(--text-primary)]'}`}>
            <header className={`flex items-center justify-between px-5 py-4 sticky top-0 z-20 backdrop-blur-sm border-b ${isDark ? 'bg-background-dark/95 border-white/5' : 'bg-background-dark/95 border-gray-100'}`}>
                <button onClick={handleExit} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10"><span className="material-symbols-outlined">arrow_back</span></button>
                <h1 className="text-lg font-bold">Hangman</h1>
                <div className="flex items-center">
                    <button
                        onClick={() => openTutorial('hangman')}
                        className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 transition-all active:scale-90 mr-1"
                        title="Watch Tutorial"
                    >
                        <span className="material-symbols-outlined text-xl" style={{ color: primaryColor }}>play_circle</span>
                    </button>
                    <button
                        onClick={async () => {
                            if (!couple || !user || ringCooldown) return;
                            setRingCooldown(true);
                            await sendGameNotification(couple, user.id, 'Hangman', '/games/hangman', 'ring');
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

            <main className="flex-1 flex flex-col items-center px-6 gap-5 pb-24 pt-12">
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

                {/* Status Indicator */}
                {game.status === 'waiting' && <h2 className="text-lg font-bold text-center mt-2">Waiting for partner to join...</h2>}

                {/* Picking phase */}
                {state.phase === 'picking' && (
                    <div className="flex flex-col items-center gap-5 mt-4 w-full max-w-sm">
                        {amPicker ? (
                            <>
                                <p className="text-lg font-bold" style={{ color: primaryColor }}>Choose a word for your partner!</p>
                                <button onClick={pickRandom}
                                    disabled={game.status !== 'active'}
                                    className={`w-full py-4 rounded-2xl font-bold text-white active:scale-95 transition-transform ${game.status !== 'active' ? 'opacity-50 grayscale pointer-events-none' : ''}`}
                                    style={{ backgroundColor: primaryColor }}>
                                    🎲 Random Word
                                </button>
                                <div className="flex items-center gap-2 w-full">
                                    <div className="flex-1 h-px bg-gray-300 dark:bg-gray-700" />
                                    <span className="text-xs text-gray-400">or</span>
                                    <div className="flex-1 h-px bg-gray-300 dark:bg-gray-700" />
                                </div>
                                <div className={`flex gap-2 w-full ${game.status !== 'active' ? 'opacity-50 grayscale pointer-events-none' : ''}`}>
                                    <input type="text" value={customWord} onChange={e => setCustomWord(e.target.value.replace(/[^a-zA-Z]/g, ''))}
                                        placeholder="Type your own word..."
                                        className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium outline-none ${isDark ? 'bg-white/10 text-white placeholder-gray-500' : 'bg-gray-100 text-gray-800 placeholder-gray-400'}`}
                                        maxLength={20} />
                                    <button onClick={pickCustom} disabled={!customWord.trim()}
                                        className="on-brand px-5 py-3 rounded-xl font-bold text-white disabled:opacity-40" style={{ backgroundColor: primaryColor }}>
                                        Set
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center gap-3 mt-8">
                                <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                                    className="w-6 h-6 rounded-full" style={{ borderWidth: 2, borderStyle: 'solid', borderColor: primaryColor, borderTopColor: 'transparent' }} />
                                <p className="text-sm text-gray-400">Partner is picking a word...</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Guessing phase */}
                {(state.phase === 'guessing' || state.phase === 'finished') && state.word && (
                    <>
                        {/* Hangman figure */}
                        <div className="w-44 h-44">
                            <HangmanFigure wrong={state.wrong} color={isDark ? '#fff' : '#333'} />
                        </div>

                        {/* Wrong count */}
                        <p className={`text-xs ${state.wrong >= MAX_WRONG - 1 ? 'text-red-400 font-bold' : 'text-gray-400'}`}>
                            {state.wrong} / {MAX_WRONG} wrong
                        </p>

                        {/* Word display */}
                        <div className="flex gap-2 flex-wrap justify-center">
                            {state.word.split('').map((letter, i) => {
                                const guessedByGuesser = state.guessed.includes(letter);
                                // Picker always sees the full word; guesser only sees guessed letters
                                const revealed = amPicker || guessedByGuesser || state.phase === 'finished';
                                return (
                                    <motion.div key={i}
                                        initial={revealed ? { scale: 0.5 } : {}}
                                        animate={{ scale: 1 }}
                                        className={`w-9 h-11 rounded-lg flex items-center justify-center text-lg font-black border-b-3 ${
                                            revealed ? (guessedByGuesser
                                                ? (isDark ? 'bg-white/10' : 'bg-gray-100')
                                                : amPicker && state.phase === 'guessing'
                                                    ? (isDark ? 'bg-white/5' : 'bg-gray-50')
                                                    : 'bg-red-500/20 text-red-400')
                                                : (isDark ? 'bg-white/5' : 'bg-gray-50 border-gray-300')
                                        }`}
                                        style={guessedByGuesser ? { color: primaryColor, borderBottomColor: primaryColor }
                                            : amPicker && state.phase === 'guessing' ? { color: isDark ? '#888' : '#aaa', borderBottomWidth: 3, borderBottomStyle: 'solid', borderBottomColor: isDark ? '#444' : '#ccc' }
                                            : { borderBottomWidth: 3, borderBottomStyle: 'solid', borderBottomColor: isDark ? '#444' : '#ccc' }}>
                                        {revealed ? letter : ''}
                                    </motion.div>
                                );
                            })}
                        </div>

                        {/* Result message */}
                        {state.phase === 'finished' && (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center">
                                {state.result === 'win' && amGuesser && <p className="text-xl font-bold text-green-500">You guessed it! 🎉</p>}
                                {state.result === 'win' && amPicker && <p className="text-xl font-bold text-red-400">They guessed it! 😅</p>}
                                {state.result === 'lose' && amGuesser && <p className="text-xl font-bold text-red-400">You didn't get it 💀</p>}
                                {state.result === 'lose' && amPicker && <p className="text-xl font-bold text-green-500">They couldn't get it! 🎯</p>}
                            </motion.div>
                        )}

                        {/* Keyboard (only for guesser during guessing phase) */}
                        {state.phase === 'guessing' && amGuesser && (
                            <div className="flex flex-wrap gap-1.5 justify-center max-w-sm">
                                {ALPHABET.map(letter => {
                                    const used = state.guessed.includes(letter);
                                    const correct = used && state.word.includes(letter);
                                    const wrong = used && !state.word.includes(letter);
                                    return (
                                        <motion.button key={letter} whileTap={{ scale: 0.85 }}
                                            onClick={() => guessLetter(letter)} disabled={used}
                                            className={`w-9 h-10 rounded-lg text-sm font-bold transition-all ${
                                                correct ? 'text-white' : wrong ? 'opacity-20' : (isDark ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-100 hover:bg-gray-200')
                                            }`}
                                            style={correct ? { backgroundColor: primaryColor } : {}}>
                                            {letter}
                                        </motion.button>
                                    );
                                })}
                            </div>
                        )}

                        {state.phase === 'guessing' && amPicker && (
                            <p className="text-sm text-gray-400 mt-2">Partner is guessing your word...</p>
                        )}

                        {/* Next round / exit */}
                        {state.phase === 'finished' && (
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-3 w-full max-w-xs mt-2">
                                <button onClick={handleNextRound} className="on-brand w-full px-6 py-4 rounded-2xl font-bold text-white shadow-lg active:scale-95" style={{ backgroundColor: primaryColor }}>Next Round (swap roles) 🔄</button>
                                <button onClick={handleExit} className={`w-full px-6 py-3 rounded-2xl font-bold ${isDark ? 'bg-white/5 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>Exit Game</button>
                            </motion.div>
                        )}
                    </>
                )}
                {/* Waiting spinner */}
                {game.status === 'waiting' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-3 mt-8">
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                            className="w-10 h-10 rounded-full" style={{ borderWidth: 3, borderStyle: 'solid', borderColor: primaryColor, borderTopColor: 'transparent' }} />
                        <p className="text-sm text-gray-400">Send your partner to Games → Hangman</p>
                    </motion.div>
                )}
            </main>

            <Toast message={toast.message} subMessage={toast.subMessage} isVisible={toast.isVisible} onClose={() => setToast(p => ({ ...p, isVisible: false }))} type={toast.type} />
        </div>
    );
};

export default Hangman;
