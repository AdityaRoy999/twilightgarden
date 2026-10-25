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

interface Riddle {
    id: number;
    riddle: string;
    answer: string;
    hint: string;
    difficulty: 'easy' | 'medium' | 'hard';
}

interface RiddleRound {
    riddle: Riddle;
    guesses: Record<string, string>;       // playerId → their guess text
    hintUsed: Record<string, boolean>;
    result: Record<string, boolean>;       // playerId → correct?
    revealed: boolean;
}

interface RiddleMeState {
    phase: 'setup' | 'playing' | 'answered' | 'finished';
    difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
    rounds: RiddleRound[];
    currentRound: number;
    totalRounds: number;
    scores: Record<string, number>;
    usedIds: number[];
}

interface GameSession {
    id: string;
    couple_id: string;
    game_type: string;
    board_state: RiddleMeState;
    current_turn: string;
    player_x: string;
    player_o: string | null;
    winner: string | null;
    status: 'waiting' | 'active' | 'finished' | 'ended';
    created_at: string;
}

const ROUNDS_OPTIONS = [5, 10, 15];

let riddleCache: Riddle[] | null = null;
const loadRiddles = async (): Promise<Riddle[]> => {
    if (riddleCache) return riddleCache;
    const res = await fetch('./Games_data/riddle_me.json');
    const data = await res.json();
    riddleCache = data.riddles;
    return riddleCache!;
};

const pickRiddle = (riddles: Riddle[], difficulty: string, usedIds: number[]): Riddle | null => {
    const pool = difficulty === 'mixed' ? riddles : riddles.filter(r => r.difficulty === difficulty);
    const available = pool.filter(r => !usedIds.includes(r.id));
    if (available.length === 0) return null;
    return available[Math.floor(Math.random() * available.length)];
};

const emptyState = (): RiddleMeState => ({
    phase: 'setup', difficulty: 'mixed', rounds: [], currentRound: 0,
    totalRounds: 10, scores: {}, usedIds: [],
});

const RiddleMe: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { couple } = useCouples();
    const { theme, primaryColor } = useTheme();
    const { openTutorial } = useTutorial();
    const isDark = theme === 'dark';

    const [game, setGame] = useState<GameSession | null>(null);
    const [loading, setLoading] = useState(true);
    const [riddles, setRiddles] = useState<Riddle[]>([]);
    const [guessInput, setGuessInput] = useState('');
    const [toast, setToast] = useState<{ isVisible: boolean; message: string; subMessage?: string; type: 'success' | 'error' }>({ isVisible: false, message: '', type: 'success' });
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
    const [ringCooldown, setRingCooldown] = useState(false);
    const ringCooldownRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    const showToast = (m: string, s?: string, t: 'success' | 'error' = 'success') => setToast({ isVisible: true, message: m, subMessage: s, type: t });
    const state = game?.board_state;
    const partnerId = game ? (game.player_x === user?.id ? game.player_o : game.player_x) : null;
    const currentRoundData = state?.rounds?.[state.currentRound];
    const myGuess = currentRoundData?.guesses?.[user?.id || ''];
    const partnerGuess = currentRoundData?.guesses?.[partnerId || ''];

    // Load riddles JSON
    useEffect(() => { loadRiddles().then(setRiddles).catch(console.error); }, []);

    /* ─── init ─── */
    useEffect(() => {
        if (!couple?.id || !user?.id) return;
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const { data: existing } = await (supabase.from('game_sessions') as any).select('*')
                    .eq('couple_id', couple.id).eq('game_type', 'riddle_me')
                    .in('status', ['waiting', 'active']).order('created_at', { ascending: false }).limit(1).maybeSingle();
                if (cancelled) return;
                if (existing) {
                    if (existing.status === 'waiting' && existing.player_x !== user.id && !existing.player_o) {
                        const updatedState = { ...existing.board_state, scores: { [existing.player_x]: 0, [user.id]: 0 } };
                        const { data: updated } = await (supabase.from('game_sessions') as any)
                            .update({ player_o: user.id, status: 'active', board_state: updatedState }).eq('id', existing.id).select().single();
                        if (!cancelled && updated) { setGame(updated); setTimeout(() => channelRef.current?.send({ type: 'broadcast', event: 'game_update', payload: updated }), 80); }
                    } else { if (!cancelled) setGame(existing); }
                } else {
                    const initState = emptyState();
                    initState.scores = { [user.id]: 0 };
                    const { data: created } = await (supabase.from('game_sessions') as any).insert({
                        couple_id: couple.id, game_type: 'riddle_me', board_state: initState,
                        current_turn: user.id, player_x: user.id, player_o: null, winner: null, status: 'waiting'
                    }).select().single();
                    if (!cancelled && created) setGame(created);
                    if (created) sendGameNotification(couple, user.id, 'Riddle Me', '/games/riddle-me', 'invite');
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

    const broadcast = useCallback((updated: GameSession) => {
        setGame(updated);
        channelRef.current?.send({ type: 'broadcast', event: 'game_update', payload: updated });
        (supabase.from('game_sessions') as any).update({ board_state: updated.board_state }).eq('id', updated.id);
    }, []);

    /* ─── start game ─── */
    const startGame = (difficulty: string, totalRounds: number) => {
        if (!game || !state || riddles.length === 0) return;
        const riddle = pickRiddle(riddles, difficulty, []);
        if (!riddle) { showToast('No riddles found', '', 'error'); return; }
        const round: RiddleRound = { riddle, guesses: {}, hintUsed: {}, result: {}, revealed: false };
        const newState: RiddleMeState = {
            ...state, phase: 'playing', difficulty: difficulty as any, totalRounds,
            rounds: [round], currentRound: 0, usedIds: [riddle.id],
        };
        broadcast({ ...game, board_state: newState } as GameSession);
    };

    /* ─── submit guess ─── */
    const submitGuess = () => {
        if (!game || !state || !user || !guessInput.trim() || myGuess) return;
        const round = { ...state.rounds[state.currentRound] };
        const answer = round.riddle.answer.toLowerCase().trim();
        const guess = guessInput.trim().toLowerCase();
        const correct = answer.includes(guess) || guess.includes(answer) || levenshtein(guess, answer) <= 2;

        round.guesses = { ...round.guesses, [user.id]: guessInput.trim() };
        round.result = { ...round.result, [user.id]: correct };

        const newScores = { ...state.scores };
        if (correct) newScores[user.id] = (newScores[user.id] || 0) + 1;

        // Check if both players have guessed
        const bothGuessed = round.guesses[partnerId || ''] !== undefined;
        if (bothGuessed) round.revealed = true;

        const newRounds = [...state.rounds]; newRounds[state.currentRound] = round;
        const newState: RiddleMeState = {
            ...state, rounds: newRounds, scores: newScores,
            phase: bothGuessed ? 'answered' : 'playing',
        };
        broadcast({ ...game, board_state: newState } as GameSession);
        setGuessInput('');
    };

    /* ─── use hint ─── */
    const useHint = () => {
        if (!game || !state || !user || !currentRoundData) return;
        const round = { ...state.rounds[state.currentRound] };
        round.hintUsed = { ...round.hintUsed, [user.id]: true };
        const newRounds = [...state.rounds]; newRounds[state.currentRound] = round;
        broadcast({ ...game, board_state: { ...state, rounds: newRounds } } as GameSession);
    };

    /* ─── next round ─── */
    const nextRound = () => {
        if (!game || !state || riddles.length === 0) return;
        const nextIdx = state.currentRound + 1;
        if (nextIdx >= state.totalRounds) {
            broadcast({ ...game, board_state: { ...state, phase: 'finished' } } as GameSession);
            return;
        }
        const riddle = pickRiddle(riddles, state.difficulty, state.usedIds);
        if (!riddle) { broadcast({ ...game, board_state: { ...state, phase: 'finished' } } as GameSession); return; }
        const round: RiddleRound = { riddle, guesses: {}, hintUsed: {}, result: {}, revealed: false };
        const newRounds = [...state.rounds, round];
        const newState: RiddleMeState = {
            ...state, rounds: newRounds, currentRound: nextIdx, usedIds: [...state.usedIds, riddle.id], phase: 'playing',
        };
        broadcast({ ...game, board_state: newState } as GameSession);
    };

    const handlePlayAgain = () => {
        if (!game || !state) return;
        try {
            const newState = emptyState();
            newState.scores = state.scores;
            broadcast({ ...game, board_state: newState } as GameSession);
        } catch { /* broadcast handles errors internally */ }
    };

    const handleExit = async () => { try { if (game?.id) await endSession(game.id); } catch {} navigate('/games'); };

    if (loading) return <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-background-dark' : 'bg-[#FDFCF8]'}`}><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-10 h-10 rounded-full" style={{ borderWidth: 3, borderStyle: 'solid', borderColor: primaryColor, borderTopColor: 'transparent' }} /></div>;
    if (game?.status === 'ended') return <GameEndedScreen />;
    if (!game) return <GameEndedScreen />;

    const myScore = state?.scores?.[user?.id || ''] || 0;
    const pScore = partnerId ? (state?.scores?.[partnerId] || 0) : 0;

    return (
        <div className={`min-h-screen flex flex-col font-display transition-colors ${isDark ? 'bg-background-dark text-white' : 'bg-[#FDFCF8] text-[#121014]'}`}>
            <header className={`flex items-center justify-between px-5 py-4 sticky top-0 z-20 backdrop-blur-sm border-b ${isDark ? 'bg-[#121014]/95 border-white/5' : 'bg-[#FDFCF8]/95 border-gray-100'}`}>
                <button onClick={handleExit} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10"><span className="material-symbols-outlined">arrow_back</span></button>
                <h1 className="text-lg font-bold">Riddle Me</h1>
                <div className="flex items-center">
                    <button
                        onClick={() => openTutorial('riddle-me')}
                        className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 transition-all active:scale-90 mr-1"
                        title="Watch Tutorial"
                    >
                        <span className="material-symbols-outlined text-xl" style={{ color: primaryColor }}>play_circle</span>
                    </button>
                    <button
                        onClick={async () => {
                            if (!couple || !user || ringCooldown) return;
                            setRingCooldown(true);
                            await sendGameNotification(couple, user.id, 'Riddle Me', '/games/riddle-me', 'ring');
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
                {/* Scores */}
                <div className="flex items-center justify-center gap-6 w-full max-w-xs">
                    <div className="flex flex-col items-center gap-1">
                        <div className="text-2xl font-black" style={{ color: primaryColor }}>{myScore}</div>
                        <span className="text-xs font-bold">You</span>
                    </div>
                    <div className={`text-sm font-bold px-3 py-1 rounded-full ${isDark ? 'bg-white/5 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>VS</div>
                    <div className="flex flex-col items-center gap-1">
                        <div className={`text-2xl font-black ${isDark ? 'text-pink-400' : 'text-pink-500'}`}>{pScore}</div>
                        <span className="text-xs font-bold">Partner</span>
                    </div>
                </div>

                {game.status === 'waiting' && (
                    <div className="flex-1 flex flex-col items-center justify-center w-full">
                        <h2 className="text-2xl font-bold mb-8 text-center">Waiting for partner to join...</h2>
                        <div className="flex flex-col items-center gap-6">
                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                                className="w-12 h-12 rounded-full" style={{ borderWidth: 4, borderStyle: 'solid', borderColor: primaryColor, borderTopColor: 'transparent' }} />
                            <p className="text-gray-400">Send your partner to Games → Riddle Me</p>
                        </div>
                    </div>
                )}

                {/* Setup */}
                {state?.phase === 'setup' && game.status === 'active' && (
                    <div className="flex flex-col items-center gap-5 mt-4 w-full max-w-sm">
                        <p className="text-lg font-bold" style={{ color: primaryColor }}>Pick difficulty & rounds!</p>
                        <div className="flex flex-wrap gap-2 justify-center">
                            {(['easy', 'medium', 'hard', 'mixed'] as const).map(d => (
                                <button key={d} onClick={() => startGame(d, 10)}
                                    className="px-5 py-3 rounded-2xl font-bold text-white active:scale-95 transition-transform capitalize"
                                    style={{ backgroundColor: primaryColor }}>
                                    {d === 'mixed' ? '🎲 Mixed' : d === 'easy' ? '😊 Easy' : d === 'medium' ? '🤔 Medium' : '🔥 Hard'}
                                </button>
                            ))}
                        </div>
                        <p className="text-xs text-gray-400">10 rounds • Both guess simultaneously</p>
                    </div>
                )}

                {/* Playing */}
                {(state?.phase === 'playing' || state?.phase === 'answered') && currentRoundData && (
                    <>
                        {/* Round indicator */}
                        <div className="flex gap-1.5 items-center">
                            {Array.from({ length: state!.totalRounds }).map((_, i) => (
                                <div key={i} className={`w-2.5 h-2.5 rounded-full transition-all ${i === state!.currentRound ? 'scale-125' : ''}`}
                                    style={{ backgroundColor: i <= state!.currentRound ? primaryColor : isDark ? '#333' : '#ddd' }} />
                            ))}
                        </div>

                        {/* Difficulty badge */}
                        <span className={`text-xs px-3 py-1 rounded-full font-bold ${
                            currentRoundData.riddle.difficulty === 'easy' ? 'bg-green-500/20 text-green-500'
                                : currentRoundData.riddle.difficulty === 'medium' ? 'bg-yellow-500/20 text-yellow-500'
                                : 'bg-red-500/20 text-red-500'
                        }`}>
                            {currentRoundData.riddle.difficulty}
                        </span>

                        {/* Riddle */}
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                            className={`w-full max-w-sm p-5 rounded-2xl text-center ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
                            <p className="text-base font-medium leading-relaxed">{currentRoundData.riddle.riddle}</p>
                        </motion.div>

                        {/* Hint */}
                        {currentRoundData.hintUsed?.[user?.id || ''] ? (
                            <p className="text-sm text-yellow-500">💡 {currentRoundData.riddle.hint}</p>
                        ) : !myGuess && state?.phase === 'playing' ? (
                            <button onClick={useHint} className="text-xs text-gray-400 underline px-4 py-2">Need a hint? 💡</button>
                        ) : null}

                        {/* Partner answered notification */}
                        {!myGuess && partnerGuess && state?.phase === 'playing' && (
                            <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium ${isDark ? 'bg-green-500/10 text-green-400' : 'bg-green-50 text-green-600'}`}>
                                <span>✅</span> Partner has answered — your turn!
                            </motion.div>
                        )}

                        {/* Guess input */}
                        {!myGuess && state?.phase === 'playing' && (
                            <div className="flex gap-2 w-full max-w-sm">
                                <input type="text" value={guessInput} onChange={e => setGuessInput(e.target.value)}
                                    placeholder="Type your answer..."
                                    className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium outline-none ${isDark ? 'bg-white/10 text-white placeholder-gray-500' : 'bg-gray-100 text-gray-800 placeholder-gray-400'}`}
                                    maxLength={50} onKeyDown={e => e.key === 'Enter' && submitGuess()} />
                                <button onClick={submitGuess} disabled={!guessInput.trim()}
                                    className="px-6 py-3 rounded-xl font-bold text-white disabled:opacity-40" style={{ backgroundColor: primaryColor }}>Go</button>
                            </div>
                        )}

                        {/* My guess submitted, waiting */}
                        {myGuess && !currentRoundData.revealed && (
                            <div className="flex flex-col items-center gap-2">
                                <p className="text-sm font-medium">Your answer: <span style={{ color: primaryColor }}>{myGuess}</span></p>
                                <motion.div animate={{ rotate:360 }} transition={{ duration:2, repeat:Infinity, ease:'linear' }}
                                    className="w-5 h-5 rounded-full" style={{ borderWidth:2, borderStyle:'solid', borderColor:primaryColor, borderTopColor:'transparent' }} />
                                <p className="text-xs text-gray-400">Waiting for partner...</p>
                            </div>
                        )}

                        {/* Both answered — reveal */}
                        {currentRoundData.revealed && (
                            <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
                                className="flex flex-col items-center gap-3 w-full max-w-sm">
                                <p className="text-sm font-bold">Answer: <span className="text-lg" style={{ color: primaryColor }}>{currentRoundData.riddle.answer}</span></p>

                                <div className="flex gap-3 w-full">
                                    <div className={`flex-1 p-3 rounded-xl text-center ${currentRoundData.result[user?.id || ''] ? 'bg-green-500/10 ring-2 ring-green-400' : 'bg-red-500/10 ring-2 ring-red-400'}`}>
                                        <p className="text-xs text-gray-400 mb-1">You</p>
                                        <p className="text-sm font-bold">{currentRoundData.guesses[user?.id || '']}</p>
                                        <p className="text-lg mt-1">{currentRoundData.result[user?.id || ''] ? '✅' : '❌'}</p>
                                    </div>
                                    <div className={`flex-1 p-3 rounded-xl text-center ${currentRoundData.result[partnerId || ''] ? 'bg-green-500/10 ring-2 ring-green-400' : 'bg-red-500/10 ring-2 ring-red-400'}`}>
                                        <p className="text-xs text-gray-400 mb-1">Partner</p>
                                        <p className="text-sm font-bold">{currentRoundData.guesses[partnerId || '']}</p>
                                        <p className="text-lg mt-1">{currentRoundData.result[partnerId || ''] ? '✅' : '❌'}</p>
                                    </div>
                                </div>

                                <button onClick={nextRound}
                                    className="w-full px-6 py-4 rounded-2xl font-bold text-white shadow-lg active:scale-95 mt-2" style={{ backgroundColor: primaryColor }}>
                                    {(state!.currentRound + 1) >= state!.totalRounds ? 'See Results 🏆' : 'Next Riddle ➡️'}
                                </button>
                            </motion.div>
                        )}
                    </>
                )}

                {/* Finished */}
                {state?.phase === 'finished' && (
                    <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} className="flex flex-col items-center gap-4 text-center mt-4">
                        <p className="text-3xl">🏆</p>
                        {myScore > pScore && <p className="text-xl font-bold text-green-500">You win!</p>}
                        {pScore > myScore && <p className="text-xl font-bold text-red-400">Partner wins!</p>}
                        {myScore === pScore && <p className="text-xl font-bold text-yellow-500">It's a tie!</p>}
                        <p className="text-sm text-gray-400">Final: {myScore} – {pScore}</p>
                        <div className="flex flex-col items-center gap-3 w-full max-w-xs mt-4">
                            <button onClick={handlePlayAgain} className="w-full px-6 py-4 rounded-2xl font-bold text-white shadow-lg active:scale-95" style={{ backgroundColor: primaryColor }}>Play Again 🔄</button>
                            <button onClick={handleExit} className={`w-full py-3 rounded-2xl font-bold ${isDark ? 'bg-white/5 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>Exit Game</button>
                        </div>
                    </motion.div>
                )}
            </main>

            <Toast message={toast.message} subMessage={toast.subMessage} isVisible={toast.isVisible} onClose={() => setToast(p => ({ ...p, isVisible: false }))} type={toast.type} />
        </div>
    );
};

/* ─── Levenshtein distance for fuzzy matching ─── */
function levenshtein(a: string, b: string): number {
    const m = a.length, n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => {
        const row = new Array(n + 1).fill(0);
        row[0] = i;
        return row;
    });
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++)
        for (let j = 1; j <= n; j++)
            dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return dp[m][n];
}

export default RiddleMe;
