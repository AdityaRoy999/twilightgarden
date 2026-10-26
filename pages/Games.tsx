import { Gamepad2 } from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../contexts/ThemeContext';
import { useCouples } from '../contexts/CouplesContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useTutorial } from '../contexts/TutorialContext';
import { tutorialRegistry } from '../components/tutorials/tutorialData';

/* ────────────── types ────────────── */
interface GameCard {
    id: string;
    title: string;
    description: string;
    icon: string;
    gradient: string;
    route: string;
    available: boolean;
    gameType: string;
}

interface Category {
    key: string;
    label: string;
    emoji: string;
    games: GameCard[];
}

/* ────────────── data ────────────── */
const categories: Category[] = [
    {
        key: 'classic',
        label: 'Classic',
        emoji: '🎲',
        games: [
            {
                id: 'tictactoe',
                title: 'Tic Tac Toe',
                description: 'Classic X & O — play live with your partner!',
                icon: 'grid_3x3',
                gradient: 'from-violet-500 to-purple-600',
                route: '/games/tictactoe',
                available: true,
                gameType: 'tictactoe',
            },
            {
                id: 'dots-boxes',
                title: 'Dots & Boxes',
                description: 'Connect dots to claim more boxes than your partner.',
                icon: 'border_all',
                gradient: 'from-sky-500 to-blue-600',
                route: '/games/dots-boxes',
                available: true,
                gameType: 'dots_boxes',
            },
            {
                id: 'connect-four',
                title: 'Connect Four',
                description: 'Drop discs & line up four in a row first!',
                icon: 'view_column',
                gradient: 'from-red-500 to-rose-600',
                route: '/games/connect-four',
                available: true,
                gameType: 'connect_four',
            },
            {
                id: 'rps',
                title: 'Rock Paper Scissors',
                description: 'Best of 5 — quick reflexes win!',
                icon: 'gesture',
                gradient: 'from-amber-500 to-yellow-600',
                route: '/games/rps',
                available: true,
                gameType: 'rps',
            },
            {
                id: 'hangman',
                title: 'Hangman',
                description: 'Pick a word or guess your partner\'s!',
                icon: 'draw',
                gradient: 'from-slate-500 to-gray-600',
                route: '/games/hangman',
                available: true,
                gameType: 'hangman',
            },
        ],
    },
    {
        key: 'couple',
        label: 'Couple',
        emoji: '💕',
        games: [
            {
                id: 'trivia',
                title: 'Love Trivia',
                description: 'How well do you really know each other?',
                icon: 'quiz',
                gradient: 'from-pink-500 to-rose-500',
                route: '/games/trivia',
                available: true,
                gameType: 'love_trivia',
            },
            {
                id: 'wordle',
                title: 'Word Guess',
                description: 'Guess the word your partner picked!',
                icon: 'match_word',
                gradient: 'from-emerald-500 to-teal-600',
                route: '/games/wordle',
                available: true,
                gameType: 'wordguess',
            },
            {
                id: 'truth-dare',
                title: 'Truth or Dare',
                description: 'Spicy truths & fun dares for couples.',
                icon: 'local_fire_department',
                gradient: 'from-orange-500 to-red-500',
                route: '/games/truth-dare',
                available: true,
                gameType: 'truth_dare',
            },
            {
                id: 'would-you-rather',
                title: 'Would You Rather',
                description: 'Tough choices, hilarious answers.',
                icon: 'swap_horiz',
                gradient: 'from-fuchsia-500 to-purple-500',
                route: '/games/would-you-rather',
                available: true,
                gameType: 'would_you_rather',
            },
            {
                id: 'this-or-that',
                title: 'This or That',
                description: 'Pick a side — see if you match!',
                icon: 'compare',
                gradient: 'from-cyan-500 to-blue-500',
                route: '/games/this-or-that',
                available: true,
                gameType: 'this_or_that',
            },
        ],
    },
    {
        key: 'brain',
        label: 'Brain',
        emoji: '🧠',
        games: [
            {
                id: '20-questions',
                title: '20 Questions',
                description: 'Yes or no — can you guess in 20?',
                icon: 'help',
                gradient: 'from-indigo-500 to-violet-600',
                route: '/games/20-questions',
                available: true,
                gameType: 'twenty_questions',
            },
            {
                id: 'emoji-charades',
                title: 'Emoji Charades',
                description: 'Describe a movie or song with emojis only!',
                icon: 'emoji_emotions',
                gradient: 'from-yellow-400 to-orange-500',
                route: '/games/emoji-charades',
                available: true,
                gameType: 'emoji_charades',
            },
            {
                id: 'memory',
                title: 'Memory Match',
                description: 'Find matching pairs together.',
                icon: 'playing_cards',
                gradient: 'from-teal-500 to-emerald-600',
                route: '/games/memory',
                available: true,
                gameType: 'memory_match',
            },
            {
                id: 'story-builder',
                title: 'Story Builder',
                description: 'Take turns adding a sentence — build a wild story.',
                icon: 'auto_stories',
                gradient: 'from-lime-500 to-green-600',
                route: '/games/story-builder',
                available: true,
                gameType: 'story_builder',
            },
            {
                id: 'riddle-me',
                title: 'Riddle Me',
                description: 'Solve tricky riddles before your partner!',
                icon: 'psychology',
                gradient: 'from-rose-400 to-pink-600',
                route: '/games/riddle-me',
                available: true,
                gameType: 'riddle_me',
            },
        ],
    },
    {
        key: 'party',
        label: 'Party',
        emoji: '🎉',
        games: [
            {
                id: 'never-have-i-ever',
                title: 'Never Have I Ever',
                description: 'Confess & discover — the classic party game.',
                icon: 'front_hand',
                gradient: 'from-violet-400 to-indigo-600',
                route: '/games/never-have-i-ever',
                available: true,
                gameType: 'never_have_i_ever',
            },
            {
                id: 'two-truths',
                title: 'Two Truths & a Lie',
                description: 'Can your partner spot the lie?',
                icon: 'fact_check',
                gradient: 'from-green-400 to-emerald-600',
                route: '/games/two-truths',
                available: true,
                gameType: 'two_truths',
            },
            {
                id: 'rapid-fire',
                title: 'Rapid Fire',
                description: 'Answer as fast as you can — no overthinking!',
                icon: 'bolt',
                gradient: 'from-red-400 to-orange-500',
                route: '/games/rapid-fire',
                available: true,
                gameType: 'rapid_fire',
            },
            {
                id: 'song-lyrics',
                title: 'Finish the Lyrics',
                description: 'Complete the song lyric your partner started.',
                icon: 'music_note',
                gradient: 'from-pink-400 to-fuchsia-500',
                route: '/games/song-lyrics',
                available: true,
                gameType: 'song_lyrics',
            },
        ],
    },
];

/* ────────────── component ────────────── */
const Games: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { theme, primaryColor } = useTheme();
    const { couple } = useCouples();
    const { user } = useAuth();
    const { openTutorial } = useTutorial();
    const isDark = theme === 'dark';

    const isPaired = couple?.status === 'active';
    const [activeTab, setActiveTab] = useState('classic');
    const [viewMode, setViewMode] = useState<'list' | 'card'>('list');
    const tabsRef = useRef<HTMLDivElement>(null);
    const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
    const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>({ left: 0, width: 0 });
    const [liveGames, setLiveGames] = useState<Set<string>>(new Set());

    // Fetch partner-waiting sessions (live dots)
    useEffect(() => {
        if (!couple || !user) return;
        const partnerId = couple.partner_1_id === user.id ? couple.partner_2_id : couple.partner_1_id;
        if (!partnerId) return;

        const fetchLive = async () => {
            const { data } = await (supabase.from('game_sessions') as any)
                .select('game_type')
                .eq('couple_id', couple.id)
                .eq('status', 'waiting')
                .eq('player_x', partnerId)
                .order('created_at', { ascending: false })
                .limit(1);
            if (data) setLiveGames(new Set(data.map((r: any) => r.game_type)));
        };
        fetchLive();

        // Subscribe for realtime updates
        const ch = supabase.channel(`live-games-${couple.id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'game_sessions',
                filter: `couple_id=eq.${couple.id}`,
            }, () => { fetchLive(); })
            .subscribe();

        return () => { supabase.removeChannel(ch); };
    }, [couple?.id, user?.id]);

    // Determine route prefix based on current path
    const routePrefix = location.pathname.startsWith('/admin')
        ? '/admin'
        : location.pathname.startsWith('/partner')
            ? '/partner'
            : '';

    const handleGameClick = async (game: GameCard) => {
        if (!isPaired || !game.available) return;
        
        // Navigate immediately for responsiveness
        navigate(`${routePrefix}${game.route}`);

        // Trigger Notification (Fire & Forget)
        if (user && couple) {
            try {
                const partnerId = couple.partner_1_id === user.id ? couple.partner_2_id : couple.partner_1_id;
                if (!partnerId) return;

                // Create notification logic
                // 1. Get nickname
                const { data: partnerProfile } = await supabase
                    .from('profiles')
                    .select('partner_nickname')
                    .eq('id', partnerId)
                    .single();

                const nickname = (partnerProfile as any)?.partner_nickname || 'partner';
                const message = `Your ${nickname} wants to play ${game.title} with you!`;

                // 2. Insert Notification
                await supabase.from('notifications').insert({
                    user_id: partnerId,
                    type: 'game_invite',
                    message: message,
                    data: { url: `${routePrefix}${game.route}`, gameName: game.title },
                    created_at: new Date().toISOString(),
                    is_read: false
                } as any);

            } catch (err) {
                console.error("Failed to send game invite:", err);
            }
        }
    };

    const activeCategory = categories.find(c => c.key === activeTab) || categories[0];

    // Update pill indicator position
    useEffect(() => {
        const btn = tabRefs.current[activeTab];
        const container = tabsRef.current;
        if (btn && container) {
            const containerRect = container.getBoundingClientRect();
            const btnRect = btn.getBoundingClientRect();
            setIndicatorStyle({
                left: btnRect.left - containerRect.left + container.scrollLeft,
                width: btnRect.width,
            });
        }
    }, [activeTab]);

    return (
        <div className={`min-h-screen flex flex-col font-display pb-24 transition-colors duration-300 ${
            isDark ? 'bg-background-dark text-white' : 'bg-background-dark text-[var(--text-primary)]'
        }`}>
            {/* Header */}
            <header className="px-6 pt-8 pb-2">
                <div className="flex items-center gap-3 mb-1">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
                        style={{ backgroundColor: `${primaryColor}20` }}>
                        <span className="material-symbols-outlined text-xl" style={{ color: primaryColor }}>sports_esports</span>
                    </div>
                    <div className="flex-1">
                        <h1 className="text-2xl font-bold tracking-tight">Games</h1>
                        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Play together, stay closer</p>
                    </div>
                    <div className={`relative flex rounded-xl p-0.5 ${isDark ? 'bg-white/5' : 'bg-gray-100'}`}>
                        {/* Animated sliding indicator */}
                        <motion.div
                            className="absolute top-0.5 bottom-0.5 w-8 rounded-lg"
                            style={{ backgroundColor: primaryColor }}
                            animate={{ left: viewMode === 'list' ? 2 : 34 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        />
                        <button
                            onClick={() => setViewMode('list')}
                            className={`relative z-10 w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                                viewMode === 'list'
                                    ? 'on-brand text-white'
                                    : isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'
                            }`}
                        >
                            <span className="material-symbols-outlined text-[18px]">view_list</span>
                        </button>
                        <button
                            onClick={() => setViewMode('card')}
                            className={`relative z-10 w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                                viewMode === 'card'
                                    ? 'on-brand text-white'
                                    : isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'
                            }`}
                        >
                            <span className="material-symbols-outlined text-[18px]">grid_view</span>
                        </button>
                    </div>
                </div>
            </header>

            <div className="px-6 pt-4"><section className="bloom-game-intro"><h2>A little play. A little closer.</h2><p>Make a moment for the two of you. Pick a favorite and play together.</p><Gamepad2 size={48}/></section></div>
            {/* Tabs */}
            <div className="px-6 pt-3 pb-1">
                <div
                    ref={tabsRef}
                    className={`relative flex gap-1 p-1 rounded-2xl overflow-x-auto no-scrollbar ${
                        isDark ? 'bg-white/5' : 'bg-gray-100'
                    }`}
                >
                    {/* Animated pill indicator */}
                    <motion.div
                        className="absolute top-1 bottom-1 rounded-xl z-0"
                        style={{ backgroundColor: primaryColor }}
                        animate={{ left: indicatorStyle.left, width: indicatorStyle.width }}
                        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                    />

                    {categories.map(cat => {
                        const isActive = activeTab === cat.key;
                        return (
                            <button
                                key={cat.key}
                                ref={el => { tabRefs.current[cat.key] = el; }}
                                onClick={() => setActiveTab(cat.key)}
                                className={`relative z-10 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors ${
                                    isActive
                                        ? 'on-brand text-white'
                                        : isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                <span className="text-sm">{cat.emoji}</span>
                                {cat.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            <main className="flex-1 px-6 pt-3">
                {!isPaired && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`mb-4 p-4 rounded-2xl flex items-center gap-3 ${
                            isDark ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-yellow-50 border border-yellow-200'
                        }`}
                    >
                        <span className="material-symbols-outlined text-yellow-500">info</span>
                        <p className={`text-sm ${isDark ? 'text-yellow-200' : 'text-yellow-700'}`}>
                            Pair with your partner first to play games together!
                        </p>
                    </motion.div>
                )}

                {/* Category description */}
                <div className="mb-4">
                    <p className={`text-xs font-medium uppercase tracking-widest ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        {activeCategory.emoji} {activeCategory.label} Games
                        <span className={`ml-2 ${isDark ? 'text-gray-600' : 'text-gray-300'}`}>
                            · {activeCategory.games.filter(g => g.available).length}/{activeCategory.games.length} live
                        </span>
                    </p>
                </div>

                <AnimatePresence mode="wait">
                    <motion.div
                        key={`${activeTab}-${viewMode}`}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2 }}
                        className={viewMode === 'card' ? 'grid grid-cols-2 gap-3' : 'grid gap-3'}
                    >
                        {activeCategory.games.map((game, i) => (
                            viewMode === 'list' ? (
                            /* ─── LIST VIEW ─── */
                            <motion.button
                                key={game.id}
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.06 }}
                                onClick={() => handleGameClick(game)}
                                disabled={!isPaired || !game.available}
                                className={`relative w-full text-left p-4 rounded-[20px] overflow-hidden transition-all group ${
                                    !isPaired || !game.available
                                        ? isDark ? 'bg-white/[0.03] opacity-50' : 'bg-gray-50 opacity-50'
                                        : isDark
                                            ? 'bg-white/5 hover:bg-white/10 active:scale-[0.98]'
                                            : 'bg-white hover:bg-gray-50 active:scale-[0.98] shadow-sm border border-gray-100'
                                }`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${game.gradient} flex items-center justify-center shadow-lg flex-shrink-0`}>
                                        <span className="material-symbols-outlined text-white text-xl">{game.icon}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-[15px]">{game.title}</h3>
                                            {!game.available && (
                                                <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                                    isDark ? 'bg-white/10 text-gray-400' : 'bg-gray-200 text-gray-500'
                                                }`}>
                                                    Soon
                                                </span>
                                            )}
                                        </div>
                                        <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{game.description}</p>
                                    </div>
                                    {game.available && isPaired && (
                                        <div className="flex items-center gap-3">
                                            {tutorialRegistry[game.id] && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        openTutorial(game.id);
                                                    }}
                                                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                                                        isDark ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-100 hover:bg-gray-200'
                                                    }`}
                                                    title="Watch Tutorial"
                                                >
                                                    <span className="material-symbols-outlined text-[18px]" style={{ color: primaryColor }}>play_circle</span>
                                                </button>
                                            )}
                                            <span className={`material-symbols-outlined text-sm ${isDark ? 'text-gray-600' : 'text-gray-300'} group-hover:translate-x-1 transition-transform`}>
                                                arrow_forward_ios
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Live badge — only when partner is waiting */}
                                {game.available && isPaired && liveGames.has(game.gameType) && (
                                    <div className="absolute top-3 right-3">
                                        <span className="relative flex h-2.5 w-2.5">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                                                style={{ backgroundColor: primaryColor }} />
                                            <span className="relative inline-flex rounded-full h-2.5 w-2.5"
                                                style={{ backgroundColor: primaryColor }} />
                                        </span>
                                    </div>
                                )}
                            </motion.button>
                            ) : (
                            /* ─── CARD VIEW ─── */
                            <motion.button
                                key={game.id}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: i * 0.06 }}
                                onClick={() => {
                                    if (!isPaired || !game.available) return;
                                    navigate(`${routePrefix}${game.route}`);
                                }}
                                disabled={!isPaired || !game.available}
                                className={`relative text-left rounded-[20px] overflow-hidden transition-all group min-h-[140px] ${
                                    !isPaired || !game.available
                                        ? isDark ? 'bg-white/[0.03] opacity-40' : 'bg-gray-100/80 opacity-40'
                                        : isDark
                                            ? 'bg-white/5 hover:bg-white/10 active:scale-[0.97]'
                                            : 'bg-background-dark hover:bg-background-dark active:scale-[0.97] border border-gray-200/60'
                                }`}
                            >
                                {/* Content */}
                                <div className="h-full p-4 flex flex-col justify-between">
                                    <div className="flex items-start justify-between">
                                        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${game.gradient} flex items-center justify-center shadow-lg`}>
                                            <span className="material-symbols-outlined text-white text-lg">{game.icon}</span>
                                        </div>
                                        {!game.available && (
                                            <span className={`text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                                isDark ? 'bg-white/10 text-gray-400' : 'bg-gray-200 text-gray-500'
                                            }`}>
                                                Soon
                                            </span>
                                        )}
                                        {game.available && isPaired && tutorialRegistry[game.id] && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    openTutorial(game.id);
                                                }}
                                                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                                                    isDark ? 'bg-white/10 hover:bg-white/20' : 'bg-white/50 hover:bg-white shadow-sm'
                                                }`}
                                                title="Watch Tutorial"
                                            >
                                                <span className="material-symbols-outlined text-[18px]" style={{ color: primaryColor }}>play_circle</span>
                                            </button>
                                        )}
                                        {game.available && isPaired && liveGames.has(game.gameType) && (
                                            <span className="relative flex h-2 w-2">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                                                    style={{ backgroundColor: primaryColor }} />
                                                <span className="relative inline-flex rounded-full h-2 w-2"
                                                    style={{ backgroundColor: primaryColor }} />
                                            </span>
                                        )}
                                    </div>
                                    <div className="mt-3">
                                        <h3 className="font-bold text-sm leading-tight">{game.title}</h3>
                                        <p className={`text-[10px] mt-1 leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{game.description}</p>
                                    </div>
                                </div>
                            </motion.button>
                            )
                        ))}
                    </motion.div>
                </AnimatePresence>
            </main>
        </div>
    );
};

export default Games;
