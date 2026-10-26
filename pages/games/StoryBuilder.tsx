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

interface Starter {
    id: number;
    opening: string;
    genre: string;
}

interface StoryEntry {
    playerId: string;
    text: string;
    timestamp: number;
}

interface StoryBuilderState {
    phase: 'pick_genre' | 'writing' | 'finished';
    genre: string;
    starter: Starter | null;
    entries: StoryEntry[];
    currentWriter: string;
    maxTurns: number;
    usedStarterIds: number[];
}

interface GameSession {
    id: string;
    couple_id: string;
    game_type: string;
    board_state: StoryBuilderState;
    current_turn: string;
    player_x: string;
    player_o: string | null;
    winner: string | null;
    status: 'waiting' | 'active' | 'finished' | 'ended';
    created_at: string;
}

const GENRES = [
    { key: 'romance', icon: '💕', label: 'Romance' },
    { key: 'mystery', icon: '🔍', label: 'Mystery' },
    { key: 'adventure', icon: '⚔️', label: 'Adventure' },
    { key: 'funny', icon: '😂', label: 'Funny' },
    { key: 'fantasy', icon: '🧙', label: 'Fantasy' },
];

let starterCache: Starter[] | null = null;
const loadStarters = async (): Promise<Starter[]> => {
    if (starterCache) return starterCache;
    const res = await fetch('./Games_data/story_builder_10000.json');
    const data = await res.json();
    starterCache = data.starters;
    return starterCache!;
};

const pickStarter = (starters: Starter[], genre: string, usedIds: number[]): Starter | null => {
    const pool = starters.filter(s => s.genre === genre && !usedIds.includes(s.id));
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
};

const emptyState = (): StoryBuilderState => ({
    phase: 'pick_genre', genre: '', starter: null, entries: [],
    currentWriter: '', maxTurns: 12, usedStarterIds: [],
});

const StoryBuilder: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { couple } = useCouples();
    const { theme, primaryColor } = useTheme();
    const { openTutorial } = useTutorial();
    const isDark = theme === 'dark';

    const [game, setGame] = useState<GameSession | null>(null);
    const [loading, setLoading] = useState(true);
    const [starters, setStarters] = useState<Starter[]>([]);
    const [textInput, setTextInput] = useState('');
    const [toast, setToast] = useState<{ isVisible: boolean; message: string; subMessage?: string; type: 'success' | 'error' }>({ isVisible: false, message: '', type: 'success' });
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
    const [ringCooldown, setRingCooldown] = useState(false);
    const ringCooldownRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    const scrollRef = useRef<HTMLDivElement>(null);

    const showToast = (m: string, s?: string, t: 'success' | 'error' = 'success') => setToast({ isVisible: true, message: m, subMessage: s, type: t });
    const state = game?.board_state;
    const partnerId = game ? (game.player_x === user?.id ? game.player_o : game.player_x) : null;
    const isMyTurn = state?.currentWriter === user?.id;

    useEffect(() => { loadStarters().then(setStarters).catch(console.error); }, []);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [state?.entries?.length]);

    /* ─── init ─── */
    useEffect(() => {
        if (!couple?.id || !user?.id) return;
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const { data: existing } = await (supabase.from('game_sessions') as any).select('*')
                    .eq('couple_id', couple.id).eq('game_type', 'story_builder')
                    .in('status', ['waiting', 'active']).order('created_at', { ascending: false }).limit(1).maybeSingle();
                if (cancelled) return;
                if (existing) {
                    if (existing.status === 'waiting' && existing.player_x !== user.id && !existing.player_o) {
                        const { data: updated } = await (supabase.from('game_sessions') as any)
                            .update({ player_o: user.id, status: 'active' }).eq('id', existing.id).select().single();
                        if (!cancelled && updated) { setGame(updated); setTimeout(() => channelRef.current?.send({ type: 'broadcast', event: 'game_update', payload: updated }), 80); }
                    } else { if (!cancelled) setGame(existing); }
                } else {
                    const initState = emptyState();
                    const { data: created } = await (supabase.from('game_sessions') as any).insert({
                        couple_id: couple.id, game_type: 'story_builder', board_state: initState,
                        current_turn: user.id, player_x: user.id, player_o: null, winner: null, status: 'waiting'
                    }).select().single();
                    if (!cancelled && created) setGame(created);
                    if (created) sendGameNotification(couple, user.id, 'Story Builder', '/games/story-builder', 'invite');
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
        (supabase.from('game_sessions') as any).update({ board_state: updated.board_state, status: updated.status }).eq('id', updated.id);
    }, []);

    /* ─── pick genre ─── */
    const selectGenre = (genre: string) => {
        if (!game || !state || starters.length === 0) return;
        const starter = pickStarter(starters, genre, state.usedStarterIds);
        if (!starter) { showToast('No starters for that genre', '', 'error'); return; }
        const newState: StoryBuilderState = {
            ...state, phase: 'writing', genre, starter,
            entries: [{ playerId: '__system__', text: starter.opening, timestamp: Date.now() }],
            currentWriter: game.player_x, usedStarterIds: [...state.usedStarterIds, starter.id],
        };
        broadcast({ ...game, board_state: newState } as GameSession);
    };

    /* ─── add text ─── */
    const submitText = () => {
        if (!game || !state || !textInput.trim() || !isMyTurn || !user) return;
        const entry: StoryEntry = { playerId: user.id, text: textInput.trim(), timestamp: Date.now() };
        const newEntries = [...state.entries, entry];
        const finished = newEntries.length >= state.maxTurns + 1; // +1 for starter
        const nextWriter = state.currentWriter === game.player_x ? (game.player_o || game.player_x) : game.player_x;
        const newState: StoryBuilderState = {
            ...state, entries: newEntries, currentWriter: nextWriter, phase: finished ? 'finished' : 'writing',
        };
        broadcast({ ...game, board_state: newState, status: finished ? 'finished' as any : game.status } as GameSession);
        setTextInput('');
    };

    const handlePlayAgain = () => {
        if (!game) return;
        try {
            const freshState = emptyState();
            freshState.currentWriter = game.player_x;
            broadcast({ ...game, board_state: freshState, status: 'active' } as GameSession);
        } catch { /* broadcast handles errors internally */ }
    };

    const handleExit = async () => { try { if (game?.id) await endSession(game.id); } catch {} navigate('/games'); };

    if (loading) return <div className={`min-h-screen flex items-center justify-center bg-background-dark`}><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-10 h-10 rounded-full" style={{ borderWidth: 3, borderStyle: 'solid', borderColor: primaryColor, borderTopColor: 'transparent' }} /></div>;
    if (game?.status === 'ended') return <GameEndedScreen />;
    if (!game) return <GameEndedScreen />;

    return (
        <div className={`min-h-screen flex flex-col font-display transition-colors ${isDark ? 'bg-background-dark text-white' : 'bg-background-dark text-[var(--text-primary)]'}`}>
            <header className={`flex items-center justify-between px-5 py-4 sticky top-0 z-20 backdrop-blur-sm border-b ${isDark ? 'bg-background-dark/95 border-white/5' : 'bg-background-dark/95 border-gray-100'}`}>
                <button onClick={handleExit} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10"><span className="material-symbols-outlined">arrow_back</span></button>
                <h1 className="text-lg font-bold">Story Builder ✍️</h1>
                <div className="flex items-center">
                    <button
                        onClick={() => openTutorial('story-builder')}
                        className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 transition-all active:scale-90 mr-1"
                        title="Watch Tutorial"
                    >
                        <span className="material-symbols-outlined text-xl" style={{ color: primaryColor }}>play_circle</span>
                    </button>
                    <button
                        onClick={async () => {
                            if (!couple || !user || ringCooldown) return;
                            setRingCooldown(true);
                            await sendGameNotification(couple, user.id, 'Story Builder', '/games/story-builder', 'ring');
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
                {game.status === 'waiting' && (
                    <div className="flex-1 flex flex-col items-center justify-center w-full">
                        <h2 className="text-2xl font-bold mb-8 text-center">Waiting for partner to join...</h2>
                        <div className="flex flex-col items-center gap-6">
                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                                className="w-12 h-12 rounded-full" style={{ borderWidth: 4, borderStyle: 'solid', borderColor: primaryColor, borderTopColor: 'transparent' }} />
                            <p className="text-gray-400">Send your partner to Games → Story Builder</p>
                        </div>
                    </div>
                )}

                {/* Genre Pick */}
                {state?.phase === 'pick_genre' && game.status === 'active' && (
                    <div className="flex flex-col items-center gap-5 mt-6 w-full max-w-sm">
                        <p className="text-lg font-bold" style={{ color: primaryColor }}>Pick a genre!</p>
                        <div className="grid grid-cols-2 gap-3 w-full">
                            {GENRES.map(g => (
                                <button key={g.key} onClick={() => selectGenre(g.key)}
                                    className={`py-4 rounded-2xl font-bold text-center active:scale-95 transition-all ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-50 hover:bg-gray-100'}`}>
                                    <span className="text-2xl block mb-1">{g.icon}</span>
                                    <span className="text-sm">{g.label}</span>
                                </button>
                            ))}
                        </div>
                        <p className="text-xs text-gray-400">Take turns to build a story together!</p>
                    </div>
                )}

                {/* Writing / Finished */}
                {(state?.phase === 'writing' || state?.phase === 'finished') && (
                    <>
                        {/* Genre badge */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold px-3 py-1 rounded-full capitalize" style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}>
                                {GENRES.find(g => g.key === state.genre)?.icon} {state.genre}
                            </span>
                            <span className="text-xs text-gray-400">{state.entries.length - 1}/{state.maxTurns} turns</span>
                        </div>

                        {/* Story display */}
                        <div ref={scrollRef}
                            className={`w-full max-w-sm flex-1 overflow-y-auto rounded-2xl p-4 space-y-3 max-h-[55vh] ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
                            <AnimatePresence>
                                {state.entries.map((e, i) => (
                                    <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                        className={`text-sm leading-relaxed ${e.playerId === '__system__' ? 'italic text-gray-400' : ''}`}>
                                        {e.playerId === '__system__' ? (
                                            <p>{e.text}</p>
                                        ) : (
                                            <p>
                                                <span className="font-bold mr-1" style={{ color: e.playerId === user?.id ? primaryColor : '#EC4899' }}>
                                                    {e.playerId === user?.id ? 'You:' : 'Partner:'}
                                                </span>
                                                {e.text}
                                            </p>
                                        )}
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>

                        {/* Input */}
                        {state.phase === 'writing' && (
                            isMyTurn ? (
                                <div className="flex gap-2 w-full max-w-sm">
                                    <input type="text" value={textInput} onChange={e => setTextInput(e.target.value)}
                                        placeholder="Continue the story..."
                                        className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium outline-none ${isDark ? 'bg-white/10 text-white placeholder-gray-500' : 'bg-gray-100 text-gray-800 placeholder-gray-400'}`}
                                        maxLength={200} onKeyDown={e => e.key === 'Enter' && submitText()} />
                                    <button onClick={submitText} disabled={!textInput.trim()}
                                        className="on-brand px-5 py-3 rounded-xl font-bold text-white disabled:opacity-40 active:scale-95" style={{ backgroundColor: primaryColor }}>
                                        <span className="material-symbols-outlined text-xl">send</span>
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-2">
                                    <motion.div animate={{ rotate:360 }} transition={{ duration:2, repeat:Infinity, ease:'linear' }}
                                        className="w-5 h-5 rounded-full" style={{ borderWidth:2, borderStyle:'solid', borderColor:'#EC4899', borderTopColor:'transparent' }} />
                                    <p className="text-xs text-gray-400">Partner is writing...</p>
                                </div>
                            )
                        )}

                        {/* Finished */}
                        {state.phase === 'finished' && (
                            <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} className="flex flex-col items-center gap-3 mt-2">
                                <p className="text-lg font-bold" style={{ color: primaryColor }}>Story Complete! 📖</p>
                                <p className="text-xs text-gray-400">{state.entries.length - 1} lines • {state.genre}</p>
                                <div className="flex flex-col items-center gap-3 w-full max-w-xs mt-2">
                                    <button onClick={handlePlayAgain} className="on-brand w-full py-4 rounded-2xl font-bold text-white shadow-lg active:scale-95" style={{ backgroundColor: primaryColor }}>New Story 🔄</button>
                                    <button onClick={handleExit} className={`w-full py-3 rounded-2xl font-bold ${isDark ? 'bg-white/5 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>Exit Game</button>
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

export default StoryBuilder;
