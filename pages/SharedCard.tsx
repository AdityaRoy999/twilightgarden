import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';

interface SharedCardData {
    userName: string;
    avatarUrl: string;
    cycleDay: number;
    phase: string;
    nextPeriodIn: number;
    moods: string[];
    symptoms: string[];
    flow: string | null;
    date: string;
}

const SharedCard: React.FC = () => {
    const { code } = useParams<{ code: string }>();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [cardData, setCardData] = useState<SharedCardData | null>(null);

    useEffect(() => {
        const fetchCard = async () => {
            if (!code) {
                setError('Invalid share link');
                setLoading(false);
                return;
            }

            try {
                const { data, error: fetchError } = await supabase.rpc('get_shared_card', { p_code: code });

                if (fetchError || !data) {
                    setError('Card not found or expired');
                } else {
                    setCardData(data as unknown as SharedCardData);
                }
            } catch (err) {
                setError('Failed to load card');
            } finally {
                setLoading(false);
            }
        };

        fetchCard();
    }, [code]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-[#1a1625] via-[#2d1f3d] to-[#1a1625] flex items-center justify-center">
                <div className="animate-pulse text-white/60">Loading...</div>
            </div>
        );
    }

    if (error || !cardData) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-[#1a1625] via-[#2d1f3d] to-[#1a1625] flex flex-col items-center justify-center p-6 text-center">
                <span className="material-symbols-outlined text-6xl text-white/30 mb-4">link_off</span>
                <h1 className="text-2xl font-bold text-white mb-2">Card Not Found</h1>
                <p className="text-white/60 mb-6">This share link may have expired or been deleted.</p>
                <button
                    onClick={() => navigate('/')}
                    className="px-6 py-3 bg-primary rounded-full text-white font-semibold"
                >
                    Go to Twilight Garden
                </button>
            </div>
        );
    }

    const phaseColors: Record<string, string> = {
        'Menstrual': 'from-red-500/20 to-pink-500/20',
        'Follicular': 'from-green-500/20 to-teal-500/20',
        'Ovulation': 'from-yellow-500/20 to-orange-500/20',
        'Luteal': 'from-purple-500/20 to-indigo-500/20'
    };

    const phaseGradient = phaseColors[cardData.phase] || 'from-primary/20 to-purple-500/20';

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#1a1625] via-[#2d1f3d] to-[#1a1625] flex flex-col items-center justify-center p-6 font-display">
            {/* Floating Orbs */}
            <div className="fixed top-10 right-10 w-64 h-64 bg-primary/20 rounded-full blur-[100px] animate-pulse" />
            <div className="fixed bottom-20 left-10 w-48 h-48 bg-purple-500/20 rounded-full blur-[80px] animate-pulse" style={{ animationDelay: '1s' }} />

            {/* Card */}
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className={`relative w-full max-w-sm rounded-[2rem] overflow-hidden bg-gradient-to-br ${phaseGradient} backdrop-blur-xl border border-white/10 shadow-2xl`}
            >
                {/* Glassmorphism overlay */}
                <div className="absolute inset-0 bg-white/5 backdrop-blur-sm" />

                <div className="relative z-10 p-8">
                    {/* Header */}
                    <div className="flex items-center gap-4 mb-8">
                        <div className="relative">
                            <img
                                src={cardData.avatarUrl || "https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png"}
                                alt="Profile"
                                className="w-16 h-16 rounded-full object-cover border-2 border-white/20"
                            />
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-400 rounded-full border-2 border-[#2d1f3d]" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">{cardData.userName || 'Anonymous'}</h2>
                            <p className="text-sm text-white/60">{new Date(cardData.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                        </div>
                    </div>

                    {/* Cycle Ring */}
                    <div className="flex justify-center mb-8">
                        <div className="relative w-36 h-36">
                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                <circle cx="50" cy="50" r="42" stroke="rgba(255,255,255,0.1)" strokeWidth="8" fill="none" />
                                <circle
                                    cx="50"
                                    cy="50"
                                    r="42"
                                    stroke="#984369"
                                    strokeWidth="8"
                                    fill="none"
                                    strokeLinecap="round"
                                    strokeDasharray={264}
                                    strokeDashoffset={264 - (264 * Math.min(1, cardData.cycleDay / 28))}
                                    className="drop-shadow-[0_0_10px_rgba(152,67,105,0.5)]"
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-4xl font-bold text-white">{cardData.cycleDay}</span>
                                <span className="text-xs text-white/60 uppercase tracking-wider">Day</span>
                            </div>
                        </div>
                    </div>

                    {/* Phase Badge */}
                    <div className="flex justify-center mb-6">
                        <div className="px-5 py-2 rounded-full bg-white/10 border border-white/20">
                            <span className="text-sm font-semibold text-white">{cardData.phase} Phase</span>
                        </div>
                    </div>

                    {/* Stats Row */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-white/5 rounded-2xl p-4 text-center border border-white/10">
                            <span className="material-symbols-outlined text-primary text-2xl mb-1">water_drop</span>
                            <p className="text-lg font-bold text-white">{Math.abs(cardData.nextPeriodIn)}</p>
                            <p className="text-xs text-white/50">{cardData.nextPeriodIn < 0 ? 'Days past estimate' : 'Days to period'}</p>
                        </div>
                        <div className="bg-white/5 rounded-2xl p-4 text-center border border-white/10">
                            <span className="material-symbols-outlined text-teal-400 text-2xl mb-1">favorite</span>
                            <p className="text-lg font-bold text-white capitalize">{cardData.flow || 'None'}</p>
                            <p className="text-xs text-white/50">Flow Today</p>
                        </div>
                    </div>

                    {/* Moods & Symptoms */}
                    {(cardData.moods?.length > 0 || cardData.symptoms?.length > 0) && (
                        <div className="space-y-3">
                            {cardData.moods?.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {cardData.moods.map((mood, i) => (
                                        <span key={i} className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-medium border border-purple-500/30">
                                            {mood}
                                        </span>
                                    ))}
                                </div>
                            )}
                            {cardData.symptoms?.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {cardData.symptoms.map((symptom, i) => (
                                        <span key={i} className="px-3 py-1 rounded-full bg-pink-500/20 text-pink-300 text-xs font-medium border border-pink-500/30">
                                            {symptom}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Footer Branding */}
                    <div className="mt-8 pt-6 border-t border-white/10 flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined text-primary text-lg">eco</span>
                        <span className="text-sm font-medium text-white/60">Twilight Garden</span>
                    </div>
                </div>
            </motion.div>

            {/* CTA */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="mt-8 text-center"
            >
                <p className="text-white/40 text-sm mb-3">Track your own cycle</p>
                <button
                    onClick={() => navigate('/signup')}
                    className="px-8 py-3 bg-primary hover:bg-primary/90 text-white font-bold rounded-full shadow-lg shadow-primary/30 transition-all"
                >
                    Join Twilight Garden
                </button>
            </motion.div>
        </div>
    );
};

export default SharedCard;
