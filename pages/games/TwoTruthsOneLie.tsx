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

interface Statement {
    text: string;
    isLie: boolean;
}

interface Round {
    writerId: string;
    statements: Statement[];
    guess: number | null; // index the guesser picked as the lie
    revealed: boolean;
}

interface TwoTruthsState {
    phase: 'writing' | 'guessing' | 'revealed' | 'finished';
    rounds: Round[];
    currentRound: number;
    currentWriter: string;
    currentGuesser: string;
    scores: Record<string, number>;
    totalRounds: number;
}

interface GameSession {
    id: string;
    couple_id: string;
    game_type: string;
    board_state: TwoTruthsState;
    current_turn: string;
    player_x: string;
    player_o: string | null;
    winner: string | null;
    status: 'waiting' | 'active' | 'finished' | 'ended';
    created_at: string;
}

const TOTAL_ROUNDS = 6; // 3 each

const emptyState = (writerId: string, guesserId: string): TwoTruthsState => ({
    phase: 'writing', rounds: [], currentRound: 0,
    currentWriter: writerId, currentGuesser: guesserId,
    scores: {}, totalRounds: TOTAL_ROUNDS,
});

const TwoTruthsOneLie: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { couple } = useCouples();
    const { theme, primaryColor } = useTheme();
    const { openTutorial } = useTutorial();
    const isDark = theme === 'dark';

    const [game, setGame] = useState<GameSession | null>(null);
    const [loading, setLoading] = useState(true);
    const [statements, setStatements] = useState(['', '', '']);
    const [lieIndex, setLieIndex] = useState<number | null>(null);
    const [toast, setToast] = useState<{ isVisible: boolean; message: string; subMessage?: string; type: 'success' | 'error' }>({ isVisible: false, message: '', type: 'success' });
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
    const [ringCooldown, setRingCooldown] = useState(false);
    const ringCooldownRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    const showToast = (m: string, s?: string, t: 'success' | 'error' = 'success') => setToast({ isVisible: true, message: m, subMessage: s, type: t });

    const state = game?.board_state;
    const amWriter = state?.currentWriter === user?.id;
    const amGuesser = state?.currentGuesser === user?.id;
    const partnerId = game ? (game.player_x === user?.id ? game.player_o : game.player_x) : null;

    /* ─── init ─── */
    useEffect(() => {
        if (!couple?.id || !user?.id) return;
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const { data: existing } = await (supabase.from('game_sessions') as any).select('*')
                    .eq('couple_id', couple.id).eq('game_type', 'two_truths')
                    .in('status', ['waiting', 'active']).order('created_at', { ascending: false }).limit(1).maybeSingle();
                if (cancelled) return;

                if (existing) {
                    if (existing.status === 'waiting' && existing.player_x !== user.id && !existing.player_o) {
                        const updatedState = { ...existing.board_state, currentGuesser: user.id, scores: { [existing.player_x]: 0, [user.id]: 0 } };
                        const { data: updated } = await (supabase.from('game_sessions') as any)
                            .update({ player_o: user.id, status: 'active', board_state: updatedState }).eq('id', existing.id).select().single();
                        if (!cancelled && updated) { setGame(updated); setTimeout(() => channelRef.current?.send({ type: 'broadcast', event: 'game_update', payload: updated }), 80); }
                    } else { if (!cancelled) setGame(existing); }
                } else {
                    const initState = emptyState(user.id, '');
                    initState.scores = { [user.id]: 0 };
                    const { data: created } = await (supabase.from('game_sessions') as any).insert({
                        couple_id: couple.id, game_type: 'two_truths', board_state: initState,
                        current_turn: user.id, player_x: user.id, player_o: null, winner: null, status: 'waiting'
                    }).select().single();
                    if (!cancelled && created) setGame(created);
                    if (created) sendGameNotification(couple, user.id, 'Two Truths & a Lie', '/games/two-truths', 'invite');
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

    const broadcast = (updated: GameSession) => {
        setGame(updated);
        channelRef.current?.send({ type: 'broadcast', event: 'game_update', payload: updated });
        (supabase.from('game_sessions') as any).update({ board_state: updated.board_state }).eq('id', updated.id);
    };

    /* ─── writer submits 3 statements ─── */
    const handleSubmitStatements = () => {
        if (!game || !state || !user || lieIndex === null) return;
        const filled = statements.filter(s => s.trim());
        if (filled.length < 3) { showToast('Fill all 3', 'All statements required', 'error'); return; }

        const stmts: Statement[] = statements.map((text, i) => ({ text: text.trim(), isLie: i === lieIndex }));
        // Shuffle so the lie isn't always in the same position
        const shuffled = [...stmts].sort(() => Math.random() - 0.5);

        const round: Round = { writerId: user.id, statements: shuffled, guess: null, revealed: false };
        const newRounds = [...state.rounds, round];
        const newState: TwoTruthsState = { ...state, rounds: newRounds, phase: 'guessing' };
        broadcast({ ...game, board_state: newState } as GameSession);
        setStatements(['', '', '']);
        setLieIndex(null);
    };

    /* ─── guesser picks the lie ─── */
    const handleGuess = (idx: number) => {
        if (!game || !state || !amGuesser || state.phase !== 'guessing') return;

        const currentRound = state.rounds[state.rounds.length - 1];
        if (!currentRound) return;

        const updatedRound: Round = { ...currentRound, guess: idx, revealed: true };
        const newRounds = [...state.rounds.slice(0, -1), updatedRound];

        const isCorrect = currentRound.statements[idx].isLie;
        const newScores = { ...state.scores };
        if (isCorrect) newScores[state.currentGuesser] = (newScores[state.currentGuesser] || 0) + 1;
        else newScores[state.currentWriter] = (newScores[state.currentWriter] || 0) + 1;

        const newState: TwoTruthsState = { ...state, rounds: newRounds, phase: 'revealed', scores: newScores };
        broadcast({ ...game, board_state: newState } as GameSession);
    };

    /* ─── next round ─── */
    const handleNextRound = () => {
        if (!game || !state) return;
        const nextRoundNum = state.currentRound + 1;

        if (nextRoundNum >= state.totalRounds) {
            // Game over
            const newState: TwoTruthsState = { ...state, phase: 'finished', currentRound: nextRoundNum };
            broadcast({ ...game, board_state: newState } as GameSession);
            return;
        }

        // Swap writer/guesser
        const newState: TwoTruthsState = {
            ...state,
            phase: 'writing',
            currentRound: nextRoundNum,
            currentWriter: state.currentGuesser,
            currentGuesser: state.currentWriter,
        };
        broadcast({ ...game, board_state: newState } as GameSession);
    };

    /* ─── play again ─── */
    const handlePlayAgain = () => {
        if (!game || !state) return;
        try {
            const newState = emptyState(state.currentGuesser, state.currentWriter);
            newState.scores = state.scores;
            broadcast({ ...game, board_state: newState } as GameSession);
        } catch { /* broadcast handles errors internally */ }
    };

    const handleExit = async () => { try { if (game?.id) await endSession(game.id); } catch {} navigate('/games'); };

    if (loading) return <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-background-dark' : 'bg-[#FDFCF8]'}`}><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-10 h-10 rounded-full" style={{ borderWidth: 3, borderStyle: 'solid', borderColor: primaryColor, borderTopColor: 'transparent' }} /></div>;
    if (game?.status === 'ended') return <GameEndedScreen />;
    if (!game) return <GameEndedScreen />;

    const myScore = state?.scores?.[user?.id || ''] || 0;
    const partnerScoreVal = partnerId ? (state?.scores?.[partnerId] || 0) : 0;
    const currentRound = state?.rounds?.[state.rounds.length - 1];

    return (
        <div className={`min-h-screen flex flex-col font-display transition-colors ${isDark ? 'bg-background-dark text-white' : 'bg-[#FDFCF8] text-[#121014]'}`}>
            <header className={`flex items-center justify-between px-5 py-4 sticky top-0 z-20 backdrop-blur-sm border-b ${isDark ? 'bg-[#121014]/95 border-white/5' : 'bg-[#FDFCF8]/95 border-gray-100'}`}>
                <button onClick={handleExit} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10"><span className="material-symbols-outlined">arrow_back</span></button>
                <h1 className="text-lg font-bold">Two Truths & a Lie</h1>
                <div className="flex items-center">
                    <button
                        onClick={() => openTutorial('two-truths')}
                        className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 transition-all active:scale-90 mr-1"
                        title="Watch Tutorial"
                    >
                        <span className="material-symbols-outlined text-xl" style={{ color: primaryColor }}>play_circle</span>
                    </button>
                    <button
                        onClick={async () => {
                            if (!couple || !user || ringCooldown) return;
                            setRingCooldown(true);
                            await sendGameNotification(couple, user.id, 'Two Truths & a Lie', '/games/two-truths', 'ring');
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
                        <span className="text-xs font-bold">{amWriter ? '✍️ Writer' : '🔍 Guesser'}</span>
                    </div>
                    <div className={`text-sm font-bold px-3 py-1 rounded-full ${isDark ? 'bg-white/5 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>VS</div>
                    <div className="flex flex-col items-center gap-1">
                        <div className={`text-2xl font-black ${isDark ? 'text-pink-400' : 'text-pink-500'}`}>{partnerScoreVal}</div>
                        <span className="text-xs font-bold">{amWriter ? '🔍 Guesser' : '✍️ Writer'}</span>
                    </div>
                </div>

                {/* Round counter */}
                {state && state.phase !== 'finished' && (
                    <div className="flex gap-1.5 items-center">
                        {Array.from({ length: state.totalRounds }).map((_, i) => (
                            <div key={i} className={`w-3 h-3 rounded-full transition-all ${
                                i < state.currentRound ? 'opacity-100' : i === state.currentRound ? 'opacity-100 scale-125' : 'opacity-30'
                            }`} style={{ backgroundColor: i <= state.currentRound ? primaryColor : isDark ? '#555' : '#ccc' }} />
                        ))}
                    </div>
                )}

                {game.status === 'waiting' && (
                    <div className="flex-1 flex flex-col items-center justify-center w-full">
                        <h2 className="text-2xl font-bold mb-8 text-center">Waiting for partner to join...</h2>
                        <div className="flex flex-col items-center gap-6">
                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                                className="w-12 h-12 rounded-full" style={{ borderWidth: 4, borderStyle: 'solid', borderColor: primaryColor, borderTopColor: 'transparent' }} />
                            <p className="text-gray-400">Send your partner to Games → Two Truths & a Lie</p>
                        </div>
                    </div>
                )}

                {/* Writing phase */}
                {state?.phase === 'writing' && game.status === 'active' && (
                    <div className="flex flex-col items-center gap-4 mt-2 w-full max-w-sm">
                        {amWriter ? (
                            <>
                                <p className="text-lg font-bold" style={{ color: primaryColor }}>Write 2 truths and 1 lie!</p>
                                <p className="text-sm text-gray-400 text-center">Tap the lie to mark it. Your partner will guess which is the lie.</p>
                                {statements.map((s, i) => (
                                    <div key={i} className="flex gap-2 w-full items-center">
                                        <button onClick={() => setLieIndex(i)}
                                            className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-lg transition-all ${
                                                lieIndex === i ? 'bg-red-500 text-white scale-110' : isDark ? 'bg-white/10 text-gray-400' : 'bg-gray-100 text-gray-400'
                                            }`}>
                                            {lieIndex === i ? '🤥' : i + 1}
                                        </button>
                                        <input type="text" value={s} onChange={e => {
                                            const copy = [...statements]; copy[i] = e.target.value; setStatements(copy);
                                        }}
                                            placeholder={lieIndex === i ? 'This is the lie...' : 'Write a truth...'}
                                            className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium outline-none ${
                                                isDark ? 'bg-white/10 text-white placeholder-gray-500' : 'bg-gray-100 text-gray-800 placeholder-gray-400'
                                            } ${lieIndex === i ? 'ring-2 ring-red-400' : ''}`}
                                            maxLength={100} />
                                    </div>
                                ))}
                                <button onClick={handleSubmitStatements}
                                    disabled={statements.some(s => !s.trim()) || lieIndex === null}
                                    className="w-full py-4 rounded-2xl font-bold text-white active:scale-95 transition-transform disabled:opacity-40 mt-2" style={{ backgroundColor: primaryColor }}>
                                    Submit! 📝
                                </button>
                            </>
                        ) : (
                            <div className="flex flex-col items-center gap-3 mt-8">
                                <motion.div animate={{ rotate:360 }} transition={{ duration:2, repeat:Infinity, ease:'linear' }}
                                    className="w-6 h-6 rounded-full" style={{ borderWidth:2, borderStyle:'solid', borderColor:primaryColor, borderTopColor:'transparent' }} />
                                <p className="text-sm text-gray-400">Partner is writing their statements...</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Guessing phase */}
                {state?.phase === 'guessing' && currentRound && game.status === 'active' && (
                    <div className="flex flex-col items-center gap-4 mt-2 w-full max-w-sm">
                        <p className="text-lg font-bold" style={{ color: primaryColor }}>
                            {amGuesser ? 'Which one is the lie?' : 'Partner is guessing...'}
                        </p>
                        {currentRound.statements.map((stmt, i) => (
                            <motion.button key={i}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.15 }}
                                onClick={() => amGuesser && handleGuess(i)}
                                disabled={!amGuesser}
                                className={`w-full p-4 rounded-2xl text-left text-sm font-medium transition-all ${
                                    amGuesser ? 'active:scale-95 cursor-pointer' : 'cursor-default'
                                } ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-50 hover:bg-gray-100'}`}
                                style={{ border: `2px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}` }}>
                                <span className="mr-2 inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold"
                                    style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}>
                                    {i + 1}
                                </span>
                                {stmt.text}
                            </motion.button>
                        ))}
                        {amWriter && (
                            <p className="text-xs text-gray-400 mt-1">Waiting for partner to pick the lie...</p>
                        )}
                    </div>
                )}

                {/* Revealed phase */}
                {state?.phase === 'revealed' && currentRound && (
                    <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
                        className="flex flex-col items-center gap-4 mt-2 w-full max-w-sm">
                        {currentRound.guess !== null && currentRound.statements[currentRound.guess]?.isLie ? (
                            <p className="text-xl font-bold text-green-500">{amGuesser ? 'Correct! 🎉' : 'They spotted it! 😅'}</p>
                        ) : (
                            <p className="text-xl font-bold text-red-400">{amGuesser ? 'Wrong! 💀' : 'Fooled them! 🎯'}</p>
                        )}
                        {currentRound.statements.map((stmt, i) => {
                            const isTheLie = stmt.isLie;
                            const wasGuessed = currentRound.guess === i;
                            return (
                                <div key={i} className={`w-full p-4 rounded-2xl text-sm font-medium relative ${
                                    isTheLie ? 'bg-red-500/10 ring-2 ring-red-400' : 'bg-green-500/10 ring-2 ring-green-400/30'
                                }`}>
                                    <div className="flex items-start gap-2">
                                        <span className={`text-lg ${isTheLie ? '' : ''}`}>
                                            {isTheLie ? '🤥' : '✅'}
                                        </span>
                                        <span className="flex-1">{stmt.text}</span>
                                        {wasGuessed && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-white/20 font-bold">
                                                👆 picked
                                            </span>
                                        )}
                                    </div>
                                    <p className={`text-xs mt-1 ml-7 font-bold ${isTheLie ? 'text-red-400' : 'text-green-500'}`}>
                                        {isTheLie ? 'THE LIE' : 'TRUTH'}
                                    </p>
                                </div>
                            );
                        })}
                        <button onClick={handleNextRound}
                            className="w-full px-6 py-4 rounded-2xl font-bold text-white shadow-lg active:scale-95 mt-2" style={{ backgroundColor: primaryColor }}>
                            {(state.currentRound + 1) >= state.totalRounds ? 'See Final Results 🏆' : 'Next Round ➡️'}
                        </button>
                    </motion.div>
                )}

                {/* Finished */}
                {state?.phase === 'finished' && (
                    <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} className="flex flex-col items-center gap-4 text-center mt-4">
                        <p className="text-3xl">🏆</p>
                        {myScore > partnerScoreVal && <p className="text-xl font-bold text-green-500">You win!</p>}
                        {partnerScoreVal > myScore && <p className="text-xl font-bold text-red-400">Partner wins!</p>}
                        {myScore === partnerScoreVal && <p className="text-xl font-bold text-yellow-500">It's a tie!</p>}
                        <p className="text-sm text-gray-400">Final: {myScore} – {partnerScoreVal}</p>
                        <div className="flex flex-col items-center gap-3 w-full max-w-xs mt-4">
                            <button onClick={handlePlayAgain} className="w-full px-6 py-4 rounded-2xl font-bold text-white shadow-lg active:scale-95" style={{ backgroundColor: primaryColor }}>Play Again 🔄</button>
                            <button onClick={handleExit} className={`w-full px-6 py-3 rounded-2xl font-bold ${isDark ? 'bg-white/5 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>Exit Game</button>
                        </div>
                    </motion.div>
                )}
            </main>

            <Toast message={toast.message} subMessage={toast.subMessage} isVisible={toast.isVisible} onClose={() => setToast(p => ({ ...p, isVisible: false }))} type={toast.type} />
        </div>
    );
};

export default TwoTruthsOneLie;
