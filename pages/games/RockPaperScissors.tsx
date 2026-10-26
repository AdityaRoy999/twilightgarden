import React, { useState, useEffect, useCallback, useRef } from 'react';
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

type Choice = 'rock' | 'paper' | 'scissors' | null;

interface RoundResult {
    round: number;
    p1: Choice;
    p2: Choice;
    winner: string | null; // playerId or 'draw'
}

interface RPSState {
    currentRound: number;
    bestOf: number;
    choices: { [playerId: string]: Choice };
    rounds: RoundResult[];
    scores: { [playerId: string]: number };
    phase: 'choosing' | 'reveal' | 'finished';
}

interface GameSession {
    id: string;
    couple_id: string;
    game_type: string;
    board_state: RPSState;
    current_turn: string;
    player_x: string;
    player_o: string | null;
    winner: string | null;
    status: 'waiting' | 'active' | 'finished' | 'ended';
    created_at: string;
}

const emptyState = (): RPSState => ({
    currentRound: 1, bestOf: 5, choices: {}, rounds: [], scores: {}, phase: 'choosing'
});

const CHOICES: { id: Choice; label: string; emoji: string; beats: Choice }[] = [
    { id: 'rock', label: 'Rock', emoji: '🪨', beats: 'scissors' },
    { id: 'paper', label: 'Paper', emoji: '📄', beats: 'rock' },
    { id: 'scissors', label: 'Scissors', emoji: '✂️', beats: 'paper' },
];

const RockPaperScissors: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { couple } = useCouples();
    const { theme, primaryColor } = useTheme();
    const { openTutorial } = useTutorial();
    const isDark = theme === 'dark';

    const [game, setGame] = useState<GameSession | null>(null);
    const [loading, setLoading] = useState(true);
    const [myChoice, setMyChoice] = useState<Choice>(null);
    const [showResult, setShowResult] = useState(false);
    const [countdown, setCountdown] = useState<number | null>(null);
    const [toast, setToast] = useState<{ isVisible: boolean; message: string; subMessage?: string; type: 'success' | 'error' }>({ isVisible: false, message: '', type: 'success' });
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
    const [ringCooldown, setRingCooldown] = useState(false);
    const ringCooldownRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    const revealTimeoutRef = useRef<number | null>(null);
    const resolvingRef = useRef(false);

    const showToast = (m: string, s?: string, t: 'success' | 'error' = 'success') => setToast({ isVisible: true, message: m, subMessage: s, type: t });

    const partnerId = game ? (game.player_x === user?.id ? game.player_o : game.player_x) : null;

    const resolveRound = useCallback((state: RPSState, p1Id: string, p2Id: string): RPSState => {
        const p1 = state.choices[p1Id];
        const p2 = state.choices[p2Id];
        if (!p1 || !p2) return state;

        let roundWinner: string | null = null;
        if (p1 === p2) roundWinner = 'draw';
        else {
            const p1Entry = CHOICES.find(c => c.id === p1)!;
            roundWinner = p1Entry.beats === p2 ? p1Id : p2Id;
        }

        const newScores = { ...state.scores };
        if (roundWinner !== 'draw' && roundWinner) newScores[roundWinner] = (newScores[roundWinner] || 0) + 1;

        const newRounds = [...state.rounds, { round: state.currentRound, p1, p2, winner: roundWinner }];
        const winsNeeded = Math.ceil(state.bestOf / 2);
        const isFinished = Object.values(newScores).some(s => s >= winsNeeded) || newRounds.length >= state.bestOf;

        return {
            ...state,
            rounds: newRounds,
            scores: newScores,
            phase: isFinished ? 'finished' : 'reveal',
        };
    }, []);

    /* ─── init ─── */
    useEffect(() => {
        if (!couple?.id || !user?.id) return;
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const { data: existing } = await (supabase.from('game_sessions') as any).select('*')
                    .eq('couple_id', couple.id).eq('game_type', 'rps')
                    .in('status', ['waiting', 'active']).order('created_at', { ascending: false }).limit(1).maybeSingle();
                if (cancelled) return;

                if (existing) {
                    if (existing.status === 'waiting' && existing.player_x !== user.id && !existing.player_o) {
                        const initScores = { [existing.player_x]: 0, [user.id]: 0 };
                        const updatedState = { ...existing.board_state, scores: initScores };
                        const { data: updated } = await (supabase.from('game_sessions') as any)
                            .update({ player_o: user.id, status: 'active', board_state: updatedState }).eq('id', existing.id).select().single();
                        if (!cancelled && updated) { setGame(updated); setTimeout(() => channelRef.current?.send({ type: 'broadcast', event: 'game_update', payload: updated }), 80); }
                    } else { if (!cancelled) setGame(existing); }
                } else {
                    const initState = emptyState();
                    initState.scores = { [user.id]: 0 };
                    const { data: created } = await (supabase.from('game_sessions') as any).insert({
                        couple_id: couple.id, game_type: 'rps', board_state: initState,
                        current_turn: user.id, player_x: user.id, player_o: null, winner: null, status: 'waiting'
                    }).select().single();
                    if (!cancelled && created) setGame(created);
                    if (created) sendGameNotification(couple, user.id, 'Rock Paper Scissors', '/games/rps', 'invite');
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
        ch.on('broadcast', { event: 'game_update' }, ({ payload }) => {
            const g = payload as GameSession;
            setGame(prev => {
                if (!prev) return g;
                // Merge choices to prevent simultaneous-pick overwrite
                if (g.board_state.phase === 'choosing' && prev.board_state.phase === 'choosing') {
                    const mergedChoices = { ...prev.board_state.choices, ...g.board_state.choices };
                    const merged = { ...g, board_state: { ...g.board_state, choices: mergedChoices } };
                    // Both chose → resolve (only from broadcast, skip postgres_changes)
                    if (merged.player_o && Object.keys(mergedChoices).length === 2 && !resolvingRef.current) {
                        setTimeout(() => handleBothChose(merged), 0);
                    }
                    if (!g.board_state.choices[user.id]) {
                        setMyChoice(null); setShowResult(false);
                    }
                    return merged;
                }
                if (g.board_state.phase === 'choosing' && !g.board_state.choices[user.id]) {
                    setMyChoice(null); setShowResult(false);
                }
                return g;
            });
        });
        ch.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_sessions', filter: `id=eq.${game.id}` },
            (p) => {
                const u = p.new as GameSession;
                setGame(prev => {
                    if (!prev) return u;
                    // Merge choices from DB update too
                    if (u.board_state.phase === 'choosing' && prev.board_state.phase === 'choosing') {
                        const mergedChoices = { ...prev.board_state.choices, ...u.board_state.choices };
                        const merged = { ...u, board_state: { ...u.board_state, choices: mergedChoices } };
                        if (merged.player_o && Object.keys(mergedChoices).length === 2 && !resolvingRef.current) {
                            setTimeout(() => handleBothChose(merged), 0);
                        }
                        return merged;
                    }
                    return u;
                });
            });
        ch.on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'game_sessions', filter: `id=eq.${game.id}` },
            () => { setGame(null); showToast('Game Ended', 'Partner left'); });
        ch.subscribe(); channelRef.current = ch;
        return () => { supabase.removeChannel(ch); channelRef.current = null; if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current); clearTimeout(ringCooldownRef.current); };
    }, [game?.id, user?.id]);

    const handleBothChose = (g: GameSession) => {
        // Guard against multiple calls per round
        if (resolvingRef.current) return;
        resolvingRef.current = true;
        // Countdown then reveal
        setCountdown(3);
        let c = 3;
        const tick = () => {
            c--;
            if (c > 0) { setCountdown(c); revealTimeoutRef.current = window.setTimeout(tick, 600); }
            else {
                setCountdown(null);
                setShowResult(true);
                // Resolve round
                const resolved = resolveRound(g.board_state, g.player_x, g.player_o!);
                let winner: string | null = null;
                if (resolved.phase === 'finished') {
                    const entries = Object.entries(resolved.scores);
                    if (entries.length >= 2) {
                        winner = entries[0][1] > entries[1][1] ? entries[0][0] : entries[0][1] < entries[1][1] ? entries[1][0] : 'draw';
                    }
                }
                const updates: Record<string, any> = { board_state: resolved };
                if (resolved.phase === 'finished') { updates.status = 'finished'; updates.winner = winner; }
                const opt = { ...g, ...updates } as GameSession;
                setGame(opt);
                channelRef.current?.send({ type: 'broadcast', event: 'game_update', payload: opt });
                (supabase.from('game_sessions') as any).update(updates).eq('id', g.id);

                // After reveal delay, move to next round
                if (resolved.phase !== 'finished') {
                    revealTimeoutRef.current = window.setTimeout(() => {
                        resolvingRef.current = false;
                        const nextState: RPSState = {
                            ...resolved,
                            currentRound: resolved.currentRound + 1,
                            choices: {},
                            phase: 'choosing',
                        };
                        const nextUpdates = { board_state: nextState };
                        const nextOpt = { ...g, ...nextUpdates } as GameSession;
                        setGame(nextOpt);
                        setMyChoice(null);
                        setShowResult(false);
                        channelRef.current?.send({ type: 'broadcast', event: 'game_update', payload: nextOpt });
                        (supabase.from('game_sessions') as any).update(nextUpdates).eq('id', g.id);
                    }, 2500);
                }
            }
        };
        revealTimeoutRef.current = window.setTimeout(tick, 600);
    };

    /* ─── make choice ─── */
    const handleChoice = async (choice: Choice) => {
        if (!game || !user || myChoice || game.status !== 'active' || game.board_state.phase !== 'choosing') return;

        setMyChoice(choice);
        const newChoices = { ...game.board_state.choices, [user.id]: choice };
        const newState: RPSState = { ...game.board_state, choices: newChoices };
        const updates = { board_state: newState };
        const opt = { ...game, ...updates } as GameSession;
        setGame(opt);
        channelRef.current?.send({ type: 'broadcast', event: 'game_update', payload: opt });
        await (supabase.from('game_sessions') as any).update(updates).eq('id', game.id);
        // If both have chosen locally (partner's choice already arrived via realtime), trigger resolve
        if (game.player_o && Object.keys(newChoices).length === 2 && !resolvingRef.current) handleBothChose(opt);
    };

    const handlePlayAgain = async () => {
        if (!game || !user) return;
        resolvingRef.current = false;
        if (revealTimeoutRef.current) { clearTimeout(revealTimeoutRef.current); revealTimeoutRef.current = null; }
        const newPx = game.player_o || user.id;
        const freshState = emptyState();
        freshState.scores = { [newPx]: 0, [game.player_x]: 0 };
        const reset = { board_state: freshState, current_turn: newPx, player_x: newPx, player_o: game.player_x, winner: null, status: 'active' as const };
        const prev = game;
        const opt = { ...game, ...reset };
        setGame(opt); setMyChoice(null); setShowResult(false); setCountdown(null);
        channelRef.current?.send({ type: 'broadcast', event: 'game_update', payload: opt });
        const { error } = await (supabase.from('game_sessions') as any).update(reset).eq('id', game.id);
        if (error) { setGame(prev); showToast('Error', 'Failed to restart', 'error'); }
    };

    const handleExit = async () => {
        if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
        try { if (game?.id) await endSession(game.id); } catch {}
        navigate('/games');
    };

    if (loading) return <div className={`min-h-screen flex items-center justify-center bg-background-dark`}><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-10 h-10 rounded-full" style={{ borderWidth: 3, borderStyle: 'solid', borderColor: primaryColor, borderTopColor: 'transparent' }} /></div>;
    if (game?.status === 'ended') return <GameEndedScreen />;
    if (!game) return <GameEndedScreen />;

    const state = game.board_state;
    const myScoreVal = state.scores?.[user?.id || ''] || 0;
    const partnerScoreVal = partnerId ? (state.scores?.[partnerId] || 0) : 0;
    const partnerChose = partnerId ? !!state.choices[partnerId] : false;
    const lastRound = state.rounds.length > 0 ? state.rounds[state.rounds.length - 1] : null;
    const isP1 = game.player_x === user?.id;

    return (
        <div className={`min-h-screen flex flex-col font-display transition-colors ${isDark ? 'bg-background-dark text-white' : 'bg-background-dark text-[var(--text-primary)]'}`}>
            <header className={`flex items-center justify-between px-5 py-4 sticky top-0 z-20 backdrop-blur-sm border-b ${isDark ? 'bg-background-dark/95 border-white/5' : 'bg-background-dark/95 border-gray-100'}`}>
                <button onClick={handleExit} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10"><span className="material-symbols-outlined">arrow_back</span></button>
                <h1 className="text-lg font-bold">Rock Paper Scissors</h1>
                <div className="flex items-center">
                    <button
                        onClick={() => openTutorial('rps')}
                        className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 transition-all active:scale-90 mr-1"
                        title="Watch Tutorial"
                    >
                        <span className="material-symbols-outlined text-xl" style={{ color: primaryColor }}>play_circle</span>
                    </button>
                    <button
                        onClick={async () => {
                            if (!couple || !user || ringCooldown) return;
                            setRingCooldown(true);
                            await sendGameNotification(couple, user.id, 'Rock Paper Scissors', '/games/rps', 'ring');
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

            <main className="flex-1 flex flex-col items-center justify-center px-6 gap-6 pt-12 pb-24">
                {game.status === 'waiting' ? (
                    <div className="flex-1 flex flex-col items-center justify-center w-full">
                        <h2 className="text-2xl font-bold mb-8 text-center">Waiting for partner to join...</h2>
                        <div className="flex flex-col items-center gap-6">
                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                                className="w-12 h-12 rounded-full" style={{ borderWidth: 4, borderStyle: 'solid', borderColor: primaryColor, borderTopColor: 'transparent' }} />
                            <p className="text-gray-400">Send your partner to Games → Rock Paper Scissors</p>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Scores */}
                        <div className="flex items-center justify-center gap-8 w-full max-w-xs">
                            <div className="flex flex-col items-center gap-1">
                                <div className="text-3xl font-black" style={{ color: primaryColor }}>{myScoreVal}</div>
                                <span className="text-xs font-bold">You</span>
                            </div>
                            <div className={`text-sm font-medium px-3 py-1 rounded-full ${isDark ? 'bg-white/5 text-gray-500' : 'bg-gray-100 text-gray-400'}`}>
                                Best of {state.bestOf}
                            </div>
                            <div className="flex flex-col items-center gap-1">
                                <div className={`text-3xl font-black ${isDark ? 'text-pink-400' : 'text-pink-500'}`}>{partnerScoreVal}</div>
                                <span className="text-xs font-bold">Partner</span>
                            </div>
                        </div>

                        {/* Round indicator */}
                        <div className="flex gap-1.5">
                            {Array.from({ length: state.bestOf }, (_, i) => {
                                const round = state.rounds[i];
                                let bg = isDark ? 'bg-white/10' : 'bg-gray-200';
                                if (round) {
                                    if (round.winner === user?.id) bg = 'bg-green-500';
                                    else if (round.winner === 'draw') bg = 'bg-yellow-500';
                                    else bg = 'bg-red-400';
                                }
                                return <div key={i} className={`w-3 h-3 rounded-full ${bg} ${i === state.currentRound - 1 && !round ? 'ring-2 ring-offset-1' : ''}`}
                                    style={i === state.currentRound - 1 && !round ? { '--tw-ring-color': primaryColor, '--tw-ring-offset-color': isDark ? '#121014' : '#FDFCF8' } as any : {}} />;
                            })}
                        </div>
                    </>
                )}

                {/* Countdown */}
                <AnimatePresence>
                    {countdown !== null && (
                        <motion.div initial={{ scale: 2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
                            className="text-6xl font-black" style={{ color: primaryColor }}>
                            {countdown}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Result reveal */}
                {showResult && lastRound && (
                    <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-8">
                        <div className="flex flex-col items-center gap-2">
                            <motion.div initial={{ x: -60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="text-6xl">
                                {CHOICES.find(c => c.id === (isP1 ? lastRound.p1 : lastRound.p2))?.emoji}
                            </motion.div>
                            <span className="text-xs font-bold">You</span>
                        </div>
                        <span className="text-2xl font-black text-gray-400">VS</span>
                        <div className="flex flex-col items-center gap-2">
                            <motion.div initial={{ x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="text-6xl">
                                {CHOICES.find(c => c.id === (isP1 ? lastRound.p2 : lastRound.p1))?.emoji}
                            </motion.div>
                            <span className="text-xs font-bold">Partner</span>
                        </div>
                    </motion.div>
                )}

                {/* Choice buttons */}
                {game.status === 'active' && state.phase === 'choosing' && !countdown && (
                    <>
                        <p className={`text-center font-bold ${myChoice ? 'text-green-500' : ''}`} style={!myChoice ? { color: primaryColor } : {}}>
                            {myChoice ? `You chose ${CHOICES.find(c => c.id === myChoice)?.label}` : `Round ${state.currentRound} — Pick!`}
                        </p>

                        {partnerChose && !myChoice && (
                            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Partner has chosen — your turn!</p>
                        )}

                        <div className="flex gap-4">
                            {CHOICES.map(c => (
                                <motion.button key={c.id} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                                    onClick={() => handleChoice(c.id)}
                                    disabled={!!myChoice}
                                    className={`flex flex-col items-center gap-2 p-5 rounded-3xl transition-all ${
                                        myChoice === c.id ? 'ring-3 scale-105' : myChoice ? 'opacity-30' : ''
                                    } ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-white shadow-md hover:shadow-lg border border-gray-100'}`}
                                    style={myChoice === c.id ? { '--tw-ring-color': primaryColor } as any : {}}>
                                    <span className="text-4xl">{c.emoji}</span>
                                    <span className="text-xs font-bold">{c.label}</span>
                                </motion.button>
                            ))}
                        </div>

                        {myChoice && !partnerChose && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-sm text-gray-400">
                                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                                    className="w-4 h-4 rounded-full" style={{ borderWidth: 2, borderStyle: 'solid', borderColor: primaryColor, borderTopColor: 'transparent' }} />
                                Waiting for partner...
                            </motion.div>
                        )}
                    </>
                )}


                {/* Game over */}
                <AnimatePresence>
                    {game.status === 'finished' && (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-4 w-full max-w-xs">
                            <div className="text-5xl">{game.winner === user?.id ? '🏆' : game.winner === 'draw' ? '🤝' : '😢'}</div>
                            <p className="text-xl font-bold">
                                {game.winner === user?.id ? 'You won!' : game.winner === 'draw' ? "It's a draw!" : 'You lost!'}
                            </p>
                            <p className="text-sm text-gray-400">{myScoreVal} – {partnerScoreVal}</p>
                            <button onClick={handlePlayAgain} className="on-brand w-full px-6 py-4 rounded-2xl font-bold text-white shadow-lg active:scale-95" style={{ backgroundColor: primaryColor }}>Play Again 🔄</button>
                            <button onClick={handleExit} className={`w-full px-6 py-3 rounded-2xl font-bold ${isDark ? 'bg-white/5 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>Exit Game</button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            <Toast message={toast.message} subMessage={toast.subMessage} isVisible={toast.isVisible} onClose={() => setToast(p => ({ ...p, isVisible: false }))} type={toast.type} />
        </div>
    );
};

export default RockPaperScissors;
