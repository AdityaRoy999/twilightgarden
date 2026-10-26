import { AppIcon } from '../../components/ui/Icons';
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

interface ECItem {
    id: number;
    emojis: string;
    answer: string;
    category: string;
}

interface ECState {
    currentCard: ECItem | null;
    isRevealed: boolean;
    history: number[];
    ready?: { player_x?: boolean; player_o?: boolean };
    guesses?: { player_x?: string; player_o?: string };
    revealRequestedAt?: string | null;
    roundNumber: number;
    totalRounds: number | null; // null = unlimited
}

interface GameSession {
    id: string;
    couple_id: string;
    game_type: 'emoji_charades';
    board_state: ECState;
    player_x: string;
    player_o: string | null;
    status: 'waiting' | 'active' | 'ended';
}

const loadData = async (): Promise<ECItem[]> => {
    const res = await fetch('/Games_data/emoji_charades.json');
    return await res.json();
};

const emptyState = (): ECState => ({
    currentCard: null,
    isRevealed: false,
    history: [],
    roundNumber: 0,
    totalRounds: null,
});

const EmojiCharades: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { couple } = useCouples();
    const { theme, primaryColor } = useTheme();
    const { openTutorial } = useTutorial();
    const isDark = theme === 'dark';

    const [items, setItems] = useState<ECItem[]>([]);
    const [session, setSession] = useState<GameSession | null>(null);
    const [loading, setLoading] = useState(true);
    const [ringCooldown, setRingCooldown] = useState(false);
    const ringCooldownRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    const countdownIvRef = useRef<ReturnType<typeof setInterval>>(undefined);
    const advanceTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    const [myGuess, setMyGuess] = useState('');
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
                const { data, error } = await (supabase.from('game_sessions') as any)
                    .select('*')
                    .eq('couple_id', couple.id)
                    .eq('game_type', 'emoji_charades')
                    .neq('status', 'ended')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (error) throw error;
                if (cancelled) return;

                if (data) {
                    // if player_o is missing and current user is the joiner, set player_o
                    if (data.player_x !== user.id && !data.player_o) {
                        const { data: updatedRows } = await (supabase.from('game_sessions') as any)
                            .update({ player_o: user.id, status: 'active' })
                            .eq('id', data.id)
                            .select()
                            .order('created_at', { ascending: false })
                            .limit(1);

                        const updated = Array.isArray(updatedRows) ? updatedRows[0] : updatedRows;
                        if (!cancelled && updated) setSession(updated);
                    } else {
                        if (!cancelled) setSession(data);
                    }
                } else {
                    // Re-check for an existing session to avoid a race where both clients insert
                    const { data: existingRows } = await (supabase.from('game_sessions') as any)
                        .select('*')
                        .eq('couple_id', couple.id)
                        .eq('game_type', 'emoji_charades')
                        // IMPORTANT: only consider non-ended sessions when re-checking
                        .neq('status', 'ended')
                        .order('created_at', { ascending: false })
                        .limit(1);

                    const exists = Array.isArray(existingRows) && existingRows.length > 0 ? existingRows[0] : null;
                    if (exists) {
                        if (!cancelled) setSession(exists);
                    } else {
                        const newState = emptyState();
                        const { data: newRows, error: insErr } = await (supabase.from('game_sessions') as any)
                            .insert({
                                couple_id: couple.id,
                                game_type: 'emoji_charades',
                                board_state: newState,
                                player_x: user.id,
                                player_o: null,
                                status: 'waiting'
                            })
                            .select()
                            .order('created_at', { ascending: false })
                            .limit(1);

                        if (insErr) throw insErr;
                        const newSession = Array.isArray(newRows) ? newRows[0] : newRows;

                        if (!cancelled && newSession) {
                            setSession(newSession);
                            sendGameNotification(couple, user.id, 'Emoji Charades', '/games/emoji-charades', 'invite');
                            if (!newSession.board_state.currentCard && items.length > 0 && newSession.player_o) {
                                // only pick a card automatically if a partner is already present
                                const updated = await pickNewCard(newSession.board_state, items, newSession.id);
                                if (updated && !cancelled) setSession(updated);
                            }
                        }
                    }
                }
            } catch (err) {
                console.error('EmojiCharades init error:', err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchSession();
        return () => { cancelled = true; };
    }, [user?.id, couple?.id, items.length]);



    // Realtime Sync
    useEffect(() => {
        if (!session?.id) return;

        const ch = supabase.channel(`game_ec_${session.id}`, { config: { private: true } })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'game_sessions', filter: `id=eq.${session.id}` },
            (payload) => {
                const newSess = payload.new as GameSession;
                if (newSess && newSess.game_type === 'emoji_charades') {
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

    // Sync local guess state and reveal countdown whenever session updates
    useEffect(() => {
        // Always run this effect (no early return from component before this hook)
        if (!session || !user) {
            setCountdown(null);
            return;
        }

        const myRole = session.player_x === user.id ? 'player_x' : 'player_o';
        setMyGuess(session.board_state.guesses?.[myRole] || '');

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
    }, [session, user]);

    // If the currently-loaded session is `ended`, check for any newer non-ended session
    // for this couple/game and switch to it automatically (fixes race where an
    // ended session remains visible while a fresh session was created by partner).
    useEffect(() => {
        if (!session || session.status !== 'ended' || !couple) return;
        let cancelled = false;
        (async () => {
            try {
                const { data } = await (supabase.from('game_sessions') as any)
                    .select('*')
                    .eq('couple_id', couple.id)
                    .eq('game_type', 'emoji_charades')
                    .neq('status', 'ended')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (!cancelled && data) setSession(data as GameSession);
            } catch (err) {
                console.error('Error while recovering from ended session:', err);
            }
        })();
        return () => { cancelled = true; };
    }, [session?.status, couple?.id]);

    const pickNewCard = async (currentState: ECState, itemList: ECItem[], sessionId?: string) => {
        const available = itemList.filter(i => !currentState.history.includes(i.id));
        const pool = available.length > 0 ? available : itemList;
        const nextCard = pool[Math.floor(Math.random() * pool.length)];
        const nextRoundNum = (currentState.roundNumber || 0) + 1;

        // Check round limit
        const total = currentState.totalRounds;
        if (total && total > 0 && nextRoundNum > total) {
            await (supabase.from('game_sessions') as any)
                .update({ status: 'ended', board_state: { ...currentState, currentCard: null } })
                .eq('id', sessionId || session?.id);
            return null;
        }

        const newState: ECState = {
            ...currentState,
            currentCard: nextCard,
            isRevealed: false,
            history: [...currentState.history, nextCard.id],
            guesses: {},
            revealRequestedAt: null,
            roundNumber: nextRoundNum,
        };

        const { data: updatedRows, error } = await (supabase.from('game_sessions') as any)
            .update({ board_state: newState, status: 'active' })
            .eq(sessionId ? 'id' : 'couple_id', sessionId ?? couple?.id)
            .eq('game_type', 'emoji_charades')
            .select()
            .order('created_at', { ascending: false })
            .limit(1);

        if (error) {
            console.error('pickNewCard update error:', error);
            return null;
        }

        const updated = Array.isArray(updatedRows) ? updatedRows[0] : updatedRows;
        return updated as GameSession | null;
    };

    const startGameRounds = async (rounds: number | null) => {
        if (!session) return;
        const newBoard: ECState = { ...session.board_state, totalRounds: rounds, roundNumber: 0 };
        const { data: updated } = await (supabase.from('game_sessions') as any)
            .update({ board_state: newBoard })
            .eq('id', session.id)
            .select()
            .single();
        if (updated) setSession(updated);
    };

    const markReady = async () => {
        if (!session || !user) return;
        const role = session.player_x === user.id ? 'player_x' : 'player_o';
        const newBoard = { ...session.board_state, ready: { ...(session.board_state.ready || {}), [role]: true } };
        const { data: updatedRows, error } = await (supabase.from('game_sessions') as any)
            .update({ board_state: newBoard })
            .eq('id', session.id)
            .select()
            .order('created_at', { ascending: false })
            .limit(1);

        if (error) { console.error('markReady error', error); return; }
        const updated = Array.isArray(updatedRows) ? updatedRows[0] : updatedRows;
        if (updated) setSession(updated);

        // If both ready, and no current card, start round
        const both = newBoard.ready?.player_x && newBoard.ready?.player_o;
        if (both && !newBoard.currentCard && updated) {
            const started = await pickNewCard(newBoard, items, session.id);
            if (started) setSession(started);
        }
    };

    const submitGuess = async (text: string) => {
        if (!session || !user) return;
        const role = session.player_x === user.id ? 'player_x' : 'player_o';
        const newBoard = { ...(session.board_state || {}), guesses: { ...(session.board_state.guesses || {}), [role]: text } };
        const { data: updatedRows, error } = await (supabase.from('game_sessions') as any)
            .update({ board_state: newBoard })
            .eq('id', session.id)
            .select()
            .order('created_at', { ascending: false })
            .limit(1);

        if (error) { console.error('submitGuess error', error); return; }
        const updated = Array.isArray(updatedRows) ? updatedRows[0] : updatedRows;
        if (updated) setSession(updated);

        // If both guesses present, request reveal
        const bothGuesses = newBoard.guesses?.player_x && newBoard.guesses?.player_o;
        if (bothGuesses && !newBoard.revealRequestedAt) {
            const revealAt = new Date().toISOString();
            const { data: revRows, error: revErr } = await (supabase.from('game_sessions') as any)
                .update({ board_state: { ...(newBoard), revealRequestedAt: revealAt } })
                .eq('id', session.id)
                .select()
                .order('created_at', { ascending: false })
                .limit(1);

            if (revErr) { console.error('reveal request error', revErr); return; }
            const revUpdated = Array.isArray(revRows) ? revRows[0] : revRows;
            if (revUpdated) setSession(revUpdated);

            // Start local countdown, then reveal and advance
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
                        // set isRevealed true
                        const { data: rRows } = await (supabase.from('game_sessions') as any)
                            .update({ board_state: { ...(newBoard), isRevealed: true } })
                            .eq('id', session.id)
                            .select()
                            .order('created_at', { ascending: false })
                            .limit(1);
                        const rUpdated = Array.isArray(rRows) ? rRows[0] : rRows;
                        if (rUpdated) setSession(rUpdated);

                        // wait 2s then advance to next round
                        advanceTimerRef.current = setTimeout(async () => {
                            const next = await pickNewCard(rUpdated.board_state, items, session.id);
                            if (next) setSession(next);
                        }, 2000);
                    })();
                }
            }, 1000);
            countdownIvRef.current = iv;
        }
    };

    const toggleReveal = async () => {
        if (!session) return;
        const newState = { ...session.board_state, isRevealed: !session.board_state.isRevealed };
        await (supabase.from('game_sessions') as any).update({ board_state: newState }).eq('id', session.id);
    };

    const nextCard = () => {
        if (!session) return;
        try {
            pickNewCard(session.board_state, items);
        } catch { /* pickNewCard handles errors internally */ }
    };

    if (loading) return <Loading />;

    if (!session) return <Loading />;

    const { currentCard, isRevealed } = session.board_state;
    const bothJoined = !!(session.player_x && session.player_o);
    const isCreator = session.player_x === user?.id;
    const myRole = user && session ? (session.player_x === user.id ? 'player_x' : 'player_o') : null;



    if (session?.status === 'ended') return <GameEndedScreen />;

    return (
        <div className={`min-h-screen flex flex-col ${isDark ? 'bg-background-dark text-white' : 'bg-gray-50 text-gray-900'}`}>
            <div className={`p-4 flex items-center justify-between border-b ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                <button onClick={async () => { try { if (session?.id) await endSession(session.id); } catch {} navigate('/games'); }} className="p-2 -ml-2 rounded-full hover:bg-white/10 active:scale-95 transition-transform">
                    <span className="app-icon-glyph text-2xl"><AppIcon name={"arrow_back"}/></span>
                </button>
                <h1 className="text-lg font-bold">Emoji Charades</h1>
                <div className="flex items-center">
                    <button
                        onClick={() => openTutorial('emoji-charades')}
                        className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 transition-all active:scale-90 mr-1"
                        title="Watch Tutorial"
                    >
                        <span className="app-icon-glyph text-xl" style={{ color: primaryColor }}><AppIcon name={"play_circle"}/></span>
                    </button>
                    <button
                        onClick={async () => {
                            if (!couple || !user || ringCooldown) return;
                            setRingCooldown(true);
                            await sendGameNotification(couple, user.id, 'Emoji Charades', '/games/emoji-charades', 'ring');
                            ringCooldownRef.current = setTimeout(() => setRingCooldown(false), 30000);
                        }}
                        disabled={ringCooldown}
                        className={`p-2 rounded-full transition-all ${ringCooldown ? 'opacity-30' : 'hover:bg-white/10 active:scale-90'}`}
                        title="Ring Partner"
                    >
                        <span className="app-icon-glyph text-2xl"><AppIcon name={ringCooldown ? 'notifications_off' : 'notifications_active'}/></span>
                    </button>
                </div>
            </div>

            <main className="flex-1 p-6 pt-12 flex flex-col justify-center items-center max-w-md mx-auto w-full text-center">
                {session.status === 'waiting' && !session.board_state?.currentCard && (
                    <div className="w-full">
                        {isCreator ? (
                            <div className="text-center">
                                {session.board_state.totalRounds === null || session.board_state.totalRounds === undefined ? (
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
                                    </>
                                ) : (
                                    <p className="text-sm mb-2 opacity-60">Rounds: <span className="font-bold" style={{ color: primaryColor }}>{session.board_state.totalRounds ?? '∞ Unlimited'}</span></p>
                                )}
                                <div className="flex flex-col items-center gap-3 mt-6">
                                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                                        className="w-12 h-12 rounded-full" style={{ borderWidth: 4, borderStyle: 'solid', borderColor: primaryColor, borderTopColor: 'transparent' }} />
                                    <p className="text-lg font-bold">Waiting for partner to join...</p>
                                    <p className="text-sm text-gray-400">Send your partner to Games → Emoji Charades</p>
                                </div>
                                <div className="flex gap-3 justify-center mt-8">
                                    <button
                                        onClick={async () => {
                                            if (!couple || !user || ringCooldown) return;
                                            setRingCooldown(true);
                                            await sendGameNotification(couple, user.id, 'Emoji Charades', '/games/emoji-charades', 'ring');
                                            ringCooldownRef.current = setTimeout(() => setRingCooldown(false), 30000);
                                        }}
                                        disabled={ringCooldown}
                                        className={`on-brand px-4 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-500 text-white font-bold transition-all active:scale-95 ${ringCooldown ? 'opacity-50' : ''}`}
                                    >

                                        <AppIcon name={"🔔"}/> Ring Partner
                                    </button>
                                    <button onClick={async () => { try { if (session?.id) await endSession(session.id); } catch {} navigate('/games'); }} className="px-6 py-3 rounded-2xl border border-gray-200 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition-all">
                                        Back
                                    </button>
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

                {!currentCard && session.status !== 'waiting' && (
                    <div className="w-full max-w-md">
                        <div className="mb-6 text-center">
                            <h2 className="text-2xl font-bold mb-2">
                                {bothJoined ? 'Waiting to start' : 'Waiting for partner'}
                            </h2>
                            {bothJoined ? (
                                <p className="text-sm opacity-50">Both players are present. Tap Start when you're ready.</p>
                            ) : (
                                <div className="mt-8 mb-4">
                                     <div className="flex flex-col items-center gap-6">
                                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                                            className="w-10 h-10 rounded-full" style={{ borderWidth: 3, borderStyle: 'solid', borderColor: primaryColor, borderTopColor: 'transparent' }} />
                                        <p className="text-gray-400">Waiting for your partner to join the game...</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {bothJoined ? (
                            <div className="flex gap-4">
                                <button
                                    onClick={markReady}
                                    disabled={session.board_state.ready && myRole ? (session.board_state.ready[myRole] === true) : false}
                                    className={`flex-1 px-6 py-4 rounded-2xl font-bold shadow-lg bg-orange-500 text-white active:scale-95 transition-transform`}
                                >
                                    {session.board_state.ready && myRole && session.board_state.ready[myRole] ? 'Ready' : 'Start'}
                                </button>

                                <button
                                    onClick={async () => { try { if (session?.id) await endSession(session.id); } catch {} navigate('/games'); }}
                                    className="flex-1 px-6 py-4 rounded-2xl font-bold shadow-lg bg-white/5 border border-white/10"
                                >
                                    Exit
                                </button>
                            </div>
                        ) : (
                             <button
                                onClick={async () => { try { if (session?.id) await endSession(session.id); } catch {} navigate('/games'); }}
                                className="w-full px-6 py-4 rounded-2xl font-bold shadow-lg bg-white/5 border border-white/10"
                            >
                                Back to Games
                            </button>
                        )}
                    </div>
                )}

                {currentCard && (
                <>
                {/* Round indicator dots */}
                {session.board_state.totalRounds && session.board_state.totalRounds > 0 && (
                    <div className="flex gap-1.5 items-center mb-3">
                        {Array.from({ length: session.board_state.totalRounds }).map((_, i) => (
                            <div key={i} className={`w-2.5 h-2.5 rounded-full transition-all ${i + 1 === (session.board_state.roundNumber || 0) ? 'scale-125' : ''}`}
                                style={{ backgroundColor: i < (session.board_state.roundNumber || 0) ? primaryColor : isDark ? '#333' : '#ddd' }} />
                        ))}
                    </div>
                )}

                <div className="mb-4 bg-orange-500/10 text-orange-500 px-4 py-1 rounded-full text-sm font-bold uppercase tracking-wider">
                    {currentCard.category} {session.board_state.totalRounds ? `— Round ${session.board_state.roundNumber || 0} / ${session.board_state.totalRounds}` : ''}
                </div>

                <div className="w-full bg-white/5 rounded-3xl p-12 mb-8 border border-white/10">
                    <div className="text-6xl sm:text-7xl mb-6 tracking-widest leading-relaxed">
                        {currentCard.emojis}
                    </div>
                </div>

                <AnimatePresence>
                    {isRevealed ? (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="on-brand bg-green-500 text-white rounded-2xl p-6 w-full mb-8"
                        >
                            <h2 className="text-2xl font-bold">{currentCard.answer}</h2>
                        </motion.div>
                    ) : (
                         <div className="h-20 mb-8 flex items-center justify-center text-gray-500 italic">
                            Tap below to reveal the answer...
                         </div>
                    )}
                </AnimatePresence>

                {!isRevealed ? (
                    <div className="w-full max-w-md">
                        <div className="mb-4 text-left text-sm text-gray-400">
                            <div>Partner: {session.player_x === user?.id ? (session.player_o ? 'Joined' : 'Waiting') : (session.player_x ? 'Joined' : 'Waiting')}</div>
                        </div>

                        <div className="mb-4">
                            <div className="text-left text-sm text-gray-400 mb-2">Your Guess</div>
                            <input
                                value={myGuess}
                                onChange={(e) => setMyGuess(e.target.value)}
                                className="w-full px-4 py-3 rounded-2xl bg-white/5"
                                placeholder="Type your guess..."
                            />
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={() => submitGuess(myGuess)}
                                disabled={!myGuess || !bothJoined}
                                className={`flex-1 px-6 py-4 rounded-2xl font-bold ${myGuess ? 'bg-orange-500 text-white' : 'opacity-50 cursor-not-allowed'}`}
                            >
                                Submit Guess
                            </button>

                            <div className="flex-1 px-6 py-4 rounded-2xl font-bold bg-gray-200 text-center">
                                {session.board_state.guesses ? (session.board_state.guesses[ myRole === 'player_x' ? 'player_o' : 'player_x' ] || 'Waiting for partner...') : 'Waiting for partner...'}
                            </div>
                        </div>

                        {countdown !== null && (
                            <div className="mt-4 text-4xl font-bold">{countdown > 0 ? countdown : '...'}</div>
                        )}
                    </div>
                ) : (
                    <div className="flex gap-4 w-full">
                        <button onClick={() => { /* noop: revealed state will advance automatically */ }} className="on-brand flex-1 px-6 py-4 rounded-2xl font-bold bg-green-600 text-white">Answer revealed</button>
                    </div>
                )}
                </>
                )}
            </main>
        </div>
    );
};

const Loading = () => (
    <div className="flex h-screen items-center justify-center bg-background-dark">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
    </div>
);

export default EmojiCharades;
