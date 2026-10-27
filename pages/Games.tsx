import {SegmentedControl} from '../components/ui/SegmentedControl';
import { useAppMotion } from '../hooks/useAppMotion';
import { springs, motionTransition } from '../lib/motion';
import { GameSymbol } from '../components/ui/GameSymbol';
import { AppIcon } from '../components/ui/Icons';
import { ReferenceArt, ReferenceHeading } from '../components/ui/ReferenceArt';
import { Play, HelpCircle, Grid2X2, List } from '../components/ui/Icons';
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
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
                route: '/games/tictactoe',
                available: true,
                gameType: 'tictactoe',
            },
            {
                id: 'dots-boxes',
                title: 'Dots & Boxes',
                description: 'Connect dots to claim more boxes than your partner.',
                icon: 'border_all',
                route: '/games/dots-boxes',
                available: true,
                gameType: 'dots_boxes',
            },
            {
                id: 'connect-four',
                title: 'Connect Four',
                description: 'Drop discs & line up four in a row first!',
                icon: 'view_column',
                route: '/games/connect-four',
                available: true,
                gameType: 'connect_four',
            },
            {
                id: 'rps',
                title: 'Rock Paper Scissors',
                description: '3, 5 or 10 rounds — quick reflexes win!',
                icon: 'gesture',
                route: '/games/rps',
                available: true,
                gameType: 'rps',
            },
            {
                id: 'hangman',
                title: 'Hangman',
                description: 'Pick a word or guess your partner\'s!',
                icon: 'draw',
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
                route: '/games/trivia',
                available: true,
                gameType: 'love_trivia',
            },
            {
                id: 'wordle',
                title: 'Word Guess',
                description: 'Guess the word your partner picked!',
                icon: 'match_word',
                route: '/games/wordle',
                available: true,
                gameType: 'wordguess',
            },
            {
                id: 'truth-dare',
                title: 'Truth or Dare',
                description: 'Fresh truths and optional dares at your pace.',
                icon: 'local_fire_department',
                route: '/games/truth-dare',
                available: true,
                gameType: 'truth_dare',
            },
            {
                id: 'would-you-rather',
                title: 'Would You Rather',
                description: 'Tough choices, hilarious answers.',
                icon: 'swap_horiz',
                route: '/games/would-you-rather',
                available: true,
                gameType: 'would_you_rather',
            },
            {
                id: 'this-or-that',
                title: 'This or That',
                description: 'Pick a side — see if you match!',
                icon: 'compare',
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
                route: '/games/20-questions',
                available: true,
                gameType: 'twenty_questions',
            },
            {
                id: 'emoji-charades',
                title: 'Emoji Charades',
                description: 'Describe a movie or song with emojis only!',
                icon: 'emoji_emotions',
                route: '/games/emoji-charades',
                available: true,
                gameType: 'emoji_charades',
            },
            {
                id: 'memory',
                title: 'Memory Match',
                description: 'Find matching pairs together.',
                icon: 'playing_cards',
                route: '/games/memory',
                available: true,
                gameType: 'memory_match',
            },
            {
                id: 'story-builder',
                title: 'Story Builder',
                description: 'Take turns adding a sentence — build a wild story.',
                icon: 'auto_stories',
                route: '/games/story-builder',
                available: true,
                gameType: 'story_builder',
            },
            {
                id: 'riddle-me',
                title: 'Riddle Me',
                description: 'Solve tricky riddles before your partner!',
                icon: 'psychology',
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
                route: '/games/never-have-i-ever',
                available: true,
                gameType: 'never_have_i_ever',
            },
            {
                id: 'two-truths',
                title: 'Two Truths & a Lie',
                description: 'Can your partner spot the lie?',
                icon: 'fact_check',
                route: '/games/two-truths',
                available: true,
                gameType: 'two_truths',
            },
            {
                id: 'rapid-fire',
                title: 'Rapid Fire',
                description: 'Answer as fast as you can — no overthinking!',
                icon: 'bolt',
                route: '/games/rapid-fire',
                available: true,
                gameType: 'rapid_fire',
            },
            {
                id: 'song-lyrics',
                title: 'Finish the Verse',
                description: 'Finish a fresh original rhyme together.',
                icon: 'music_note',
                route: '/games/song-lyrics',
                available: true,
                gameType: 'song_lyrics',
            },
        ],
    },
];

/* ────────────── component ────────────── */
const Games: React.FC = () => {
    const { reduced } = useAppMotion();
    const navigate = useNavigate();
    const location = useLocation();
    const { couple } = useCouples();
    const { user } = useAuth();
    const { openTutorial } = useTutorial();

    const isPaired = couple?.status === 'active';
    const [activeTab, setActiveTab] = useState('classic');
    const [viewMode, setViewMode] = useState<'list' | 'card'>('list');
    const [liveGames, setLiveGames] = useState<Set<string>>(new Set());

    // Fetch partner-waiting sessions (live dots)
    useEffect(() => {
        if (!couple || !user) return;
        const partnerId = couple.partner_1_id === user.id ? couple.partner_2_id : couple.partner_1_id;
        if (!partnerId) return;

        const fetchLive = async () => {
            const { data } = await (supabase.from('game_sessions') as any)
                .select('game_type').eq('engine_version',2)
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

    return <div className="reference-page reference-games font-display">
      <ReferenceHeading title="Mini Games" description="Make a moment for the two of you. Pick a favorite and play together." action={<button aria-label={viewMode === 'list' ? 'Show grid view' : 'Show list view'} onClick={() => setViewMode(viewMode === 'list' ? 'card' : 'list')}>{viewMode === 'list' ? <Grid2X2 size={18}/> : <List size={18}/>}</button>}/>
      <SegmentedControl label="Game categories" value={activeTab} onChange={setActiveTab} options={categories.map(category=>({value:category.key,label:category.label,icon:category.emoji}))}/>

      {!isPaired && <p className="reference-card reference-description mb-4">Pair with your partner first to play games together.</p>}
      <main className={`reference-game-list ${viewMode === 'card' ? 'reference-game-grid' : ''}`}>
        {activeCategory.games.map((game, index) => <motion.div key={game.id} className="reference-card reference-game-card" initial={reduced ? false : { y: 8 }} animate={{ y: 0 }} transition={motionTransition(springs.section, reduced)}>
          <ReferenceArt kind="leaves" className="reference-card-art"/>
          <button className="reference-game-button" onClick={() => handleGameClick(game)} disabled={!isPaired || !game.available} aria-label={`Play ${game.title}`}>
            <span className="reference-game-symbol"><GameSymbol id={game.id}/></span>
            <span className="reference-game-copy"><strong>{game.title}</strong><small>{game.description}</small>{liveGames.has(game.gameType) && <small className="text-primary">Your partner is waiting</small>}{!game.available && <small>Coming soon</small>}</span>
            <span className="reference-play"><Play size={17} fill="currentColor"/></span>
          </button>
          {tutorialRegistry[game.id] && <button className="reference-game-help" aria-label={`How to play ${game.title}`} onClick={() => openTutorial(game.id)}><HelpCircle size={11} className="inline mr-1"/>How to play</button>}
        </motion.div>)}
      </main>
    </div>;
};
export default Games;
