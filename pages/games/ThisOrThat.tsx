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

interface TTItem {
    id: number;
    optionA: string;
    optionB: string;
}

interface TTState {
    currentCard: TTItem | null;
    votes: Record<string, 'A' | 'B'>; // user_id -> choice
    history: number[];
    roundNumber: number;
    totalRounds: number | null; // null = unlimited
}

interface GameSession {
    id: string;
    couple_id: string;
    game_type: 'this_or_that';
    board_state: TTState;
    player_x: string;
    player_o: string | null;
    status: 'waiting' | 'active' | 'ended';
    updated_at: string;
}

const loadData = async (): Promise<TTItem[]> => {
    const res = await fetch('/Games_data/this_or_that.json');
    return await res.json();
};

const emptyState = (): TTState => ({
    currentCard: null,
    votes: {},
    history: [],
    roundNumber: 0,
    totalRounds: null,
});

const ThisOrThat: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { couple } = useCouples();
    const { theme, primaryColor } = useTheme();
    const { openTutorial } = useTutorial();
    const isDark = theme === 'dark';

    const [items, setItems] = useState<TTItem[]>([]);
    const [session, setSession] = useState<GameSession | null>(null);
    const [loading, setLoading] = useState(true);
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
    const [ringCooldown, setRingCooldown] = useState(false);
    const ringCooldownRef = useRef<ReturnType<typeof setTimeout>>(undefined);

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
                // Clean up stale waiting sessions (older than 10 min)
                const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
                await (supabase.from('game_sessions') as any)
                    .delete()
                    .eq('couple_id', couple.id)
                    .eq('game_type', 'this_or_that')
                    .eq('status', 'waiting')
                    .lt('created_at', cutoff);

                const { data, error } = await (supabase.from('game_sessions') as any)
                    .select('*')
                    .eq('couple_id', couple.id)
                    .eq('game_type', 'this_or_that')
                    .in('status', ['waiting', 'active'])
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (error) throw error;
                if (cancelled) return;

                if (data) {
                    if (data.player_x !== user.id && !data.player_o) {
                        const { data: updated } = await (supabase.from('game_sessions') as any)
                            .update({ player_o: user.id })
                            .eq('id', data.id)
                            .select()
                            .single();
                        if (!cancelled && updated) setSession(updated);
                    } else {
                        if (!cancelled) setSession(data);
                    }
                } else {
                    const newState = emptyState();
                    const { data: newSession, error: insErr } = await (supabase.from('game_sessions') as any)
                        .insert({
                            couple_id: couple.id,
                            game_type: 'this_or_that',
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
                        sendGameNotification(couple, user.id, 'This or That', '/games/this-or-that', 'invite');
                        if (!newSession.board_state.currentCard && items.length > 0) {
                            pickNewCard(newSession.board_state, items, newSession.id);
                        }
                    }
                }
            } catch (err) {
                console.error('ThisOrThat init error:', err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchSession();
        return () => { cancelled = true; };
    }, [user?.id, couple?.id, items.length > 0]);

    // Realtime Sync
    useEffect(() => {
        if (!session?.id) return;

        const ch = supabase.channel(`game_tt_${session.id}`, { config: { private: true } })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'game_sessions', filter: `id=eq.${session.id}` },
            (payload) => {
                const newSess = payload.new as GameSession;
                if (newSess && newSess.game_type === 'this_or_that') {
                    setSession(newSess);
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(ch);
            clearTimeout(ringCooldownRef.current);
        };
    }, [session?.id]);

    const pickNewCard = async (currentState: TTState, itemList: TTItem[], sessionId?: string) => {
        const idToUpdate = sessionId || session?.id;
        if (!idToUpdate) return;

        const available = itemList.filter(i => !currentState.history.includes(i.id));
        const pool = available.length > 0 ? available : itemList;
        const nextCard = pool[Math.floor(Math.random() * pool.length)];
        const nextRoundNum = (currentState.roundNumber || 0) + 1;

        const newState: TTState = {
            ...currentState,
            currentCard: nextCard,
            votes: {},
            history: [...currentState.history, nextCard.id],
            roundNumber: nextRoundNum,
        };

        await (supabase.from('game_sessions') as any).update({ board_state: newState }).eq('id', idToUpdate);
    };

    const startGameRounds = async (rounds: number | null) => {
        if (!session) return;
        const newBoard: TTState = { ...session.board_state, totalRounds: rounds, roundNumber: 0 };
        const { data: updated } = await (supabase.from('game_sessions') as any)
            .update({ status: 'active', board_state: newBoard })
            .eq('id', session.id)
            .select()
            .single();
        if (updated) setSession(updated);
    };

    const vote = async (choice: 'A' | 'B') => {
        if (!session || !user) return;
        const newVotes = { ...session.board_state.votes, [user.id]: choice };
        const newState = { ...session.board_state, votes: newVotes };
        await (supabase.from('game_sessions') as any).update({ board_state: newState }).eq('id', session.id);
    };

    const nextRound = async () => {
        if (!session) return;
        try {
            const total = session.board_state.totalRounds;
            const nextRoundNum = (session.board_state.roundNumber || 0) + 1;
            if (total && total > 0 && nextRoundNum > total) {
                await (supabase.from('game_sessions') as any)
                    .update({ status: 'ended', board_state: { ...session.board_state, currentCard: null } })
                    .eq('id', session.id);
                return;
            }
            pickNewCard(session.board_state, items);
        } catch { /* pickNewCard handles errors internally */ }
    };

    if (loading) return (
        <div className="flex h-screen items-center justify-center">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-10 h-10 rounded-full" style={{ borderWidth: 3, borderStyle: 'solid', borderColor: primaryColor, borderTopColor: 'transparent' }} />
        </div>
    );

    if (session?.status === 'ended') return <GameEndedScreen />;

    if (!session) {
        return (
            <div className="flex h-screen items-center justify-center flex-col px-4">
                <p className="mb-4 text-center">Could not load game session. Please try retrying or go back.</p>
                <div className="flex gap-2">
                <button onClick={async () => { try { if (session?.id) await endSession(session.id); } catch {} navigate('/games'); }} className="px-4 py-2 rounded border">Back</button>
                </div>
            </div>
        );
    }

    const { currentCard, votes } = session.board_state;

    const isCreator = session.player_x === user?.id;
    const board_state = session.board_state;

    if (!currentCard) {
        return (
            <div className={`min-h-screen flex flex-col ${isDark ? 'bg-background-dark text-white' : 'bg-gray-50 text-gray-900'}`}>
                <div className={`p-4 flex items-center justify-between border-b ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                    <button onClick={async () => { try { if (session?.id) await endSession(session.id); } catch {} navigate('/games'); }} className="p-2 -ml-2 rounded-full hover:bg-white/10 active:scale-95 transition-transform">
                        <span className="material-symbols-outlined text-2xl">arrow_back</span>
                    </button>
                    <h1 className="text-lg font-bold">This or That</h1>
                    <button
                        onClick={() => openTutorial('this-or-that')}
                        className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 transition-all active:scale-90"
                        title="Watch Tutorial"
                    >
                        <span className="material-symbols-outlined text-xl" style={{ color: primaryColor }}>play_circle</span>
                    </button>
                </div>
                <main className="flex-1 p-6 pt-12 flex flex-col justify-center items-center max-w-md mx-auto w-full">
                    {session.status === 'waiting' ? (
                        <div className="w-full">
                            {isCreator ? (
                                <div className="text-center">
                                    {board_state.totalRounds === null || board_state.totalRounds === undefined ? (
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
                                        <p className="text-sm mb-2 opacity-60">Rounds: <span className="font-bold" style={{ color: primaryColor }}>{board_state.totalRounds ?? '∞ Unlimited'}</span></p>
                                    )}
                                    <div className="flex flex-col items-center gap-3 mt-6">
                                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                                            className="w-12 h-12 rounded-full" style={{ borderWidth: 4, borderStyle: 'solid', borderColor: primaryColor, borderTopColor: 'transparent' }} />
                                        <p className="text-lg font-bold">Waiting for partner to join...</p>
                                        <p className="text-sm text-gray-400">Send your partner to Games → This or That</p>
                                    </div>
                                    <div className="flex gap-3 justify-center mt-8">
                                        <button
                                            onClick={async () => {
                                                if (!couple || !user || ringCooldown) return;
                                                setRingCooldown(true);
                                                await sendGameNotification(couple, user.id, 'This or That', '/games/this-or-that', 'ring');
                                                ringCooldownRef.current = setTimeout(() => setRingCooldown(false), 30000);
                                            }}
                                            disabled={ringCooldown}
                                            className={`on-brand px-4 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-500 text-white font-bold transition-all active:scale-95 ${ringCooldown ? 'opacity-50' : ''}`}
                                        >
                                            🔔 Ring Partner
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
                    ) : (
                        isCreator ? (
                            <>
                                <div className="text-center mb-12">
                                    <h2 className="text-3xl font-bold mb-2">Ready to start?</h2>
                                    <p className="opacity-70 text-center">Your partner is here! Tap start to begin This or That.</p>
                                </div>
                                <button onClick={() => { if (items.length > 0) pickNewCard(session.board_state, items); }} className="on-brand w-full py-4 rounded-2xl text-white font-bold shadow-lg active:scale-95 transition-transform" style={{ backgroundColor: primaryColor }}>Start Game</button>
                            </>
                        ) : (
                            <div className="text-center">
                                <h2 className="text-2xl font-bold mb-4 text-center">Waiting for creator</h2>
                                <p className="opacity-60 mb-8 text-center">The creator hasn't started the game yet.</p>
                                <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                                    className="w-8 h-8 rounded-full mx-auto" style={{ borderWidth: 2, borderStyle: 'solid', borderColor: primaryColor, borderTopColor: 'transparent' }} />
                            </div>
                        )
                    )}
                </main>
            </div>
        );
    }
    const myVote = votes[user?.id || ''];
    const partnerId = session.player_x === user?.id ? session.player_o : session.player_x;
    const partnerVote = partnerId ? votes[partnerId] : null;

    const showResult = myVote && partnerVote;
    const match = showResult && myVote === partnerVote;

    return (
        <div className={`min-h-screen flex flex-col ${isDark ? 'bg-background-dark text-white' : 'bg-gray-50 text-gray-900'}`}>
            <div className={`p-4 flex items-center justify-between border-b ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                <button onClick={async () => { try { if (session?.id) await endSession(session.id); } catch {} navigate('/games'); }} className="p-2 -ml-2 rounded-full hover:bg-white/10 active:scale-95 transition-transform">
                    <span className="material-symbols-outlined text-2xl">arrow_back</span>
                </button>
                <h1 className="text-lg font-bold">This or That</h1>
                <div className="flex items-center">
                    <button
                        onClick={() => openTutorial('this-or-that')}
                        className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 transition-all active:scale-90 mr-1"
                        title="Watch Tutorial"
                    >
                        <span className="material-symbols-outlined text-xl" style={{ color: primaryColor }}>play_circle</span>
                    </button>
                    <button
                        onClick={async () => {
                            if (!couple || !user || ringCooldown) return;
                            setRingCooldown(true);
                            await sendGameNotification(couple, user.id, 'This or That', '/games/this-or-that', 'ring');
                            ringCooldownRef.current = setTimeout(() => setRingCooldown(false), 30000);
                        }}
                        disabled={ringCooldown}
                        className={`p-2 rounded-full transition-all ${ringCooldown ? 'opacity-30' : 'hover:bg-white/10 active:scale-90'}`}
                        title="Ring Partner"
                    >
                        <span className="material-symbols-outlined text-2xl">{ringCooldown ? 'notifications_off' : 'notifications_active'}</span>
                    </button>
                </div>
            </div>

            <main className="flex-1 p-6 pt-12 flex flex-col justify-center items-center max-w-md mx-auto w-full gap-6">
                {/* Round indicator dots */}
                {board_state.totalRounds && board_state.totalRounds > 0 && (
                    <div className="flex gap-1.5 items-center mb-2">
                        {Array.from({ length: board_state.totalRounds }).map((_, i) => (
                            <div key={i} className={`w-2.5 h-2.5 rounded-full transition-all ${i + 1 === (board_state.roundNumber || 0) ? 'scale-125' : ''}`}
                                style={{ backgroundColor: i < (board_state.roundNumber || 0) ? primaryColor : isDark ? '#333' : '#ddd' }} />
                        ))}
                    </div>
                )}

                {/* Status or Result Header */}
                <div className="h-12 flex items-center justify-center">
                    {showResult ? (
                        <motion.div
                            initial={{ scale: 0 }} animate={{ scale: 1 }}
                            className={`px-6 py-2 rounded-full font-bold flex items-center gap-2 ${match ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}
                        >
                            {match ? '✨ It\'s a Match!' : '❌ Ops! Different Vibes'}
                        </motion.div>
                    ) : (myVote && !partnerVote) ? (
                         <div className="bg-yellow-500/20 text-yellow-500 px-4 py-2 rounded-lg text-sm font-medium">
                            ✅ You picked! Waiting for partner...
                        </div>
                    ) : (
                         <div className="text-gray-500 text-sm">Pick your favorite!</div>
                    )}
                </div>

                {/* Option A */}
                <button
                    onClick={() => !myVote && vote('A')}
                    disabled={!!myVote}
                    className={`w-full py-8 rounded-3xl border-2 transition-all relative overflow-hidden group ${
                        myVote === 'A' ? 'border-blue-500 bg-blue-500/10' :
                        isDark ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'
                    }`}
                >
                    <span className="text-2xl font-bold block mb-2">{currentCard.optionA}</span>
                    {showResult && partnerVote === 'A' && (
                        <div className="on-brand absolute top-2 right-2 text-xs bg-blue-500 text-white px-2 py-1 rounded-full">Partner</div>
                    )}
                </button>

                <div className="flex items-center justify-center w-full">
                    <span className="bg-white/10 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest text-gray-400">OR</span>
                </div>

                {/* Option B */}
                <button
                    onClick={() => !myVote && vote('B')}
                    disabled={!!myVote}
                    className={`w-full py-8 rounded-3xl border-2 transition-all relative overflow-hidden group ${
                        myVote === 'B' ? 'border-purple-500 bg-purple-500/10' :
                        isDark ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'
                    }`}
                >
                    <span className="text-2xl font-bold block mb-2">{currentCard.optionB}</span>
                    {showResult && partnerVote === 'B' && (
                        <div className="absolute top-2 right-2 text-xs bg-purple-500 text-white px-2 py-1 rounded-full">Partner</div>
                    )}
                </button>

                {showResult && (
                    <button
                        onClick={nextRound}
                        className={`w-full px-6 py-4 rounded-2xl font-bold shadow-lg mt-8 ${
                            isDark ? 'bg-white text-black' : 'bg-black text-white'
                        }`}
                    >
                        {board_state.totalRounds && board_state.totalRounds > 0 && (board_state.roundNumber || 0) >= board_state.totalRounds ? 'Finish Game 🏆' : 'Next Pair ➡️'}
                    </button>
                )}
            </main>
        </div>
    );
};

export default ThisOrThat;
