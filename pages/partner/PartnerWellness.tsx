import { NearestPads } from '../../components/wellness/NearestPads';
import { buildWellnessContext } from '../../lib/wellnessContext';
import { GuidancePending } from '../../components/wellness/GuidancePending';
import { IllustratedGuide } from '../../components/wellness/IllustratedGuide';
import { useGeneratedText } from '../../hooks/useGeneratedText';
import { useAppMotion } from '../../hooks/useAppMotion';
import { springs, motionTransition } from '../../lib/motion';
import { ReferenceHeading, ReferenceArt } from '../../components/ui/ReferenceArt';
import { AppIcon } from '../../components/ui/Icons';
import { useToday } from '../../hooks/useToday';
import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useCouples } from '../../contexts/CouplesContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { calculateCyclePhase } from '../../lib/cycleUtils';
import NotificationBell from '../../components/NotificationBell';
import {
    generateEmpathyAlerts,
    generateGiftRecommendations,
    searchShoppingProducts,
    Product,
} from '../../lib/wellnessAI';
import { ShoppingGrid } from '../../components/wellness/ShoppingCards';

type Tab = 'care' | 'gifts' | 'shops';

const PartnerWellness: React.FC = () => {
    const { theme } = useTheme();
    const { reduced } = useAppMotion();
    const isDark = theme === 'dark';
    const { user } = useAuth();
    const { partnerProfile, partnerSettings, partnerLogs, couple } = useCouples();

    const [activeTab, setActiveTab] = useState<Tab>('care');
    const [gifts, setGifts] = useState<Product[]>([]);
    const [platformFilter, setPlatformFilter] = useState<'All' | 'Amazon' | 'Flipkart' | 'Nykaa' | 'Myntra' | 'Blinkit'>('All');
    const [categoryFilter, setCategoryFilter] = useState<'All' | 'Jewelry' | 'Fashion' | 'Toys' | 'Comfort' | 'Food' | 'Self-care'>('All');
    const [shoppingLoading, setShoppingLoading] = useState(false);
    const [error, setError] = useState('');

    // Get partner's cycle data
    const todayStr = useToday();
    const partnerCycleData = useMemo(() => {
        if (!partnerSettings?.lastPeriodStart) return null;
        try {
            return calculateCyclePhase(
                todayStr,
                {
                    avgCycleLength: partnerSettings.avgCycleLength || 28,
                    avgPeriodLength: partnerSettings.avgPeriodLength || 5,
                    lastPeriodStart: partnerSettings.lastPeriodStart,
                    onboardingCompleted: true,
                    irregularCycle: partnerSettings.irregularCycle || false,
                },
                partnerLogs || []
            );
        } catch {
            return null;
        }
    }, [partnerSettings, partnerLogs, todayStr]);

    // Build context
    const todayLog = partnerLogs?.find((l: any) => l.date === todayStr);
    const partnerName = partnerProfile?.full_name || 'Your Partner';

    const ctx = useMemo(()=>buildWellnessContext({phase:partnerCycleData?.phase||'Unknown',cycleDay:partnerCycleData?.currentDay||0,logs:partnerLogs||[],today:todayStr,partnerName}),[partnerCycleData,partnerLogs,todayStr,partnerName]);

    const guidance = useGeneratedText({ care: (refresh) => generateEmpathyAlerts(ctx,refresh) }, JSON.stringify([partnerProfile?.id, couple?.id, ctx]));
    const careText = guidance.entries.care?.text || '';
    const loading = guidance.entries.care?.status === 'loading';
    const careError = guidance.entries.care?.error;
    const fetchCare = () => void guidance.request('care', true);

    const fetchGifts = async () => {
        setShoppingLoading(true);
        setError('');
        try {
            const result = await generateGiftRecommendations(ctx);
            if (result.error) {
                setError(result.error);
            } else {
                const terms = result.text.split(',').map(t => t.trim()).filter(Boolean);
                console.log('AI Search Terms:', terms);

                // Fetch products for each term in parallel (now 5 platforms)
                const productPromises = terms.slice(0, 5).map(term => searchShoppingProducts(term));
                const productGroups = await Promise.all(productPromises);

                // Flatten and deduplicate by link AND normalized title
                const allProducts = productGroups.flat();
                console.log('Raw Products Found:', allProducts.length);

                const uniqueProducts = Array.from(
                    new Map(
                        allProducts.map(p => {
                            // Normalize link and title for better deduplication
                            const normalizedLink = p.link.split('?')[0]; // Remove query params
                            const key = `${normalizedLink}-${p.title.toLowerCase().trim()}`;
                            return [key, p];
                        })
                    ).values()
                );

                console.log('Unique Products After Processing:', uniqueProducts);
                setGifts(uniqueProducts);
            }
        } catch (err: any) {
            console.error('Fetch gifts error:', err);
            setError(err.message || 'Failed to load shopping gifts');
        } finally {
            setShoppingLoading(false);
        }
    };

    const filteredGifts = useMemo(() => {
        return gifts.filter(p => {
            const platformMatch = platformFilter === 'All' || p.source === platformFilter;

            // Simple category heuristic based on title/link keywords
            let categoryMatch = true;
            if (categoryFilter !== 'All') {
                const text = (p.title + ' ' + p.link).toLowerCase();
                const keywords: Record<string, string[]> = {
                    'Jewelry': ['necklace', 'earring', 'jhumka', 'jewelry', 'pendant', 'gold', 'silver', 'bangle', 'ring', 'jewel', 'nykaa fashion'],
                    'Fashion': ['dress', 'kurti', 'top', 'skirt', 'floral', 'suit', 'cloth', 'apparel', 'wear', 'biba', 'anarkali', 't-shirt', 'tshirt', 'shirt', 'saree', 'clothing', 'myntra'],
                    'Toys': ['teddy', 'bear', 'plush', 'toy', 'soft toy', 'stuffed', 'hamleys', 'doll'],
                    'Comfort': ['heating pad', 'blanket', 'candle', 'diffuser', 'pillow', 'massager', 'socks', 'patch', 'wellness'],
                    'Food': ['chocolate', 'tea', 'coffee', 'snack', 'gift box', 'sweet', 'fruit', 'amul', 'cadbury', 'ferrer'],
                    'Self-care': ['journal', 'bath', 'skincare', 'mask', 'serum', 'lotion', 'spa', 'beauty', 'face']
                };

                // Use regex with word boundaries to avoid partial matches (e.g., 'tea' in 'Tear')
                const filterKeywords = keywords[categoryFilter] || [];
                categoryMatch = filterKeywords.some(k => {
                    const regex = new RegExp(`\\b${k}\\b`, 'i');
                    return regex.test(text);
                });
            }

            return platformMatch && categoryMatch;
        });
    }, [gifts, platformFilter, categoryFilter]);

    useEffect(() => {
        if (couple?.status !== 'active' || !partnerProfile) return;
        if (activeTab === 'care') void guidance.request('care');
        if (activeTab === 'gifts' && gifts.length === 0) fetchGifts();

    }, [activeTab, guidance.request, couple?.status, partnerProfile?.id]);

    const tabs: { key: Tab; label: string; icon: string }[] = [
        { key: 'care', label: 'Care Guide', icon: 'favorite' },
        { key: 'gifts', label: 'Gift Ideas', icon: 'redeem' },
        { key: 'shops', label: 'Nearest Pad', icon: 'location_on' },
    ];

    // Not connected state
    if (!couple || couple.status !== 'active') {
        return (
            <div className={`flex flex-col items-center justify-center min-h-screen p-6 ${isDark ? 'bg-background-dark text-white' : 'bg-background-dark text-gray-900'}`}>
                <span className="app-icon-glyph text-5xl text-gray-400 mb-4"><AppIcon name={"link_off"}/></span>
                <h2 className="text-xl font-bold mb-2">Not Connected</h2>
                <p className={`text-sm text-center ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
                    Connect with your partner to access personalized care guides and gift recommendations.
                </p>
            </div>
        );
    }

    // No shared data
    if (!partnerSettings && couple.share_enabled) {
        return (
            <div className={`flex flex-col items-center justify-center min-h-screen p-6 ${isDark ? 'bg-background-dark text-white' : 'bg-background-dark text-gray-900'}`}>
                <span className="app-icon-glyph text-5xl text-gray-400 mb-4"><AppIcon name={"hourglass_empty"}/></span>
                <h2 className="text-xl font-bold mb-2">Waiting for Data</h2>
                <p className={`text-sm text-center ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
                    Your partner hasn't logged any cycle data yet. Check back soon!
                </p>
            </div>
        );
    }

    const renderShopsContent = () => <NearestPads/>;

    return (
        <div className="reference-page reference-wellness font-display flex flex-col">
            <ReferenceHeading title="Wellness" description="Small moments of care, together." action={<NotificationBell/>}/>

            {/* Partner Context Banner */}
            {partnerCycleData && (
                <div className={`mx-6 mt-4 rounded-2xl p-4 ${isDark ? 'bg-gradient-to-br from-pink-500/15 to-purple-500/10 border border-pink-500/20' : 'bg-gradient-to-br from-pink-50 to-purple-50 border border-pink-100'}`}>
                    <div className="flex items-center gap-3">
                        {partnerProfile?.avatar_url ? (
                            <img src={partnerProfile.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDark ? 'bg-pink-500/30' : 'bg-pink-100'}`}>
                                <span className="app-icon-glyph text-pink-400"><AppIcon name={"person"}/></span>
                            </div>
                        )}
                        <div>
                            <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{partnerName}</p>
                            <p className={`text-xs ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
                                {partnerCycleData.phase} Phase · Day {partnerCycleData.currentDay}
                                {todayLog?.moods?.length > 0 && ` · Feeling ${todayLog.moods[0]}`}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="wellness-tabs">
                <div className="wellness-tab-list">
                    {tabs.map(tab => (
                        <button
                            key={tab.key}
                            aria-pressed={activeTab === tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex h-10 items-center gap-2 px-5 rounded-full text-sm font-semibold transition-all ${activeTab === tab.key
                                ? 'on-brand bg-primary text-white shadow-md shadow-primary/20'
                                : isDark ? 'bg-white/5 text-gray-400 hover:bg-white/10' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                }`}
                        >
                            <span className="app-icon-glyph text-base"><AppIcon name={tab.icon}/></span>
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <main className="wellness-content flex flex-col gap-4">
                <React.Fragment>
                    <motion.div
                        key={activeTab}
                        initial={reduced ? false : { y: 8 }}
                        animate={{ opacity: 1, y: 0 }}

                        transition={motionTransition(springs.section, reduced)}
                    >
                        {activeTab === 'care' && (
                            <div className="flex flex-col gap-4 max-w-4xl mx-auto w-full">
                                {!guidance.entries.care || (loading && !careText) ? (
                                    <GuidancePending partner/>
                                ) : careError ? (
                                    <ErrorCard message={careError} onRetry={fetchCare} isDark={isDark} />
                                ) : (
                                    <IllustratedGuide text={careText} partner onRefresh={fetchCare} busy={loading}/>
                                )}
                            </div>
                        )}

                        {activeTab === 'gifts' && (
                            <div className="flex flex-col md:grid md:grid-cols-[1fr_3fr] gap-6">
                                {/* Left Sidebar (Desktop) / Top (Mobile) */}
                                <div className="flex flex-col gap-4">
                                  {/* Gift context card */}
                                  <div className={`rounded-2xl p-4 ${isDark ? 'bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20' : 'bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100'}`}>
                                      <p className={`text-sm ${isDark ? 'text-amber-300/80' : 'text-amber-700'}`}>
                                          <span className="app-icon-glyph text-sm mr-1 align-middle"><AppIcon name={"lightbulb"}/></span>
                                          Personalized suggestions based on {partnerName}'s current phase and mood
                                      </p>
                                  </div>

                                  {!shoppingLoading && !error && gifts.length > 0 && (
                                     <>
                                        {/* Platform Filter */}
                                        <div className="flex flex-col gap-2">
                                            <p className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-white/40' : 'text-gray-400'}`}>Platform</p>
                                            <div className="flex flex-wrap gap-2 md:flex-col md:whitespace-normal pb-1">
                                                {['All', 'Amazon', 'Flipkart', 'Nykaa', 'Myntra', 'Blinkit'].map(p => (
                                                    <button
                                                        key={p}
                                                        onClick={() => setPlatformFilter(p as any)}
                                                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold md:w-full md:text-left transition-all border ${
                                                            platformFilter === p
                                                            ? 'bg-primary border-primary text-white shadow-sm'
                                                            : isDark ? 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10' : 'bg-white border-gray-100 text-gray-600 hover:bg-gray-50'
                                                        }`}
                                                    >
                                                        {p}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Category Filter */}
                                        <div className="flex flex-col gap-2">
                                            <p className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-white/40' : 'text-gray-400'}`}>Category</p>
                                            <div className="flex flex-wrap gap-2 md:flex-col md:whitespace-normal pb-1">
                                                {['All', 'Jewelry', 'Fashion', 'Toys', 'Comfort', 'Food', 'Self-care'].map(c => (
                                                    <button
                                                        key={c}
                                                        onClick={() => setCategoryFilter(c as any)}
                                                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold md:w-full md:text-left transition-all border ${
                                                            categoryFilter === c
                                                            ? 'bg-amber-500 border-amber-500 text-white shadow-sm'
                                                            : isDark ? 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10' : 'bg-white border-gray-100 text-gray-600 hover:bg-gray-50'
                                                        }`}
                                                    >
                                                        {c}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                     </>
                                  )}
                                </div>

                                {/* Right Content Area */}
                                <div className="flex flex-col gap-4">
                                  {shoppingLoading && gifts.length === 0 ? (
                                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                          {[1, 2, 3, 4, 5, 6].map(i => (
                                              <div key={i} className={`aspect-[4/5] rounded-2xl animate-pulse ${isDark ? 'bg-white/5' : 'bg-gray-100'}`} />
                                          ))}
                                      </div>
                                  ) : error ? (
                                      <ErrorCard message={error} onRetry={fetchGifts} isDark={isDark} />
                                  ) : (
                                      <div className="flex flex-col gap-4">
                                          <ShoppingGrid products={filteredGifts} loading={shoppingLoading} />

                                          {filteredGifts.length === 0 && !shoppingLoading && (
                                              <div className="text-center py-8 opacity-40">
                                                  <p className="text-xs">No items match your filters.</p>
                                              </div>
                                          )}

                                          <div className={`mt-2 p-4 rounded-xl border ${isDark ? 'bg-white/5 border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                                              <p className={`text-[11px] leading-relaxed text-center ${isDark ? 'text-white/40' : 'text-gray-500'}`}>
                                                  Shopping results from Amazon, Flipkart, Nykaa, Myntra & Blinkit. Prices and availability are live from search.
                                              </p>
                                          </div>
                                      </div>
                                  )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'shops' && renderShopsContent()}
                    </motion.div>
                </React.Fragment>
            </main>
        </div>
    );
};

// --- Sub-components ---

const ErrorCard = ({ message, onRetry, isDark }: { message: string; onRetry: () => void; isDark: boolean }) => (
    <div className={`rounded-2xl p-6 text-center ${isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-100'}`}>
        <span className="app-icon-glyph text-3xl text-red-400 mb-2"><AppIcon name={"error"}/></span>
        <p className={`text-sm mb-3 ${isDark ? 'text-white/60' : 'text-gray-600'}`}>{message}</p>
        <button onClick={onRetry} className="on-brand px-4 py-2 bg-primary text-white text-sm font-bold rounded-full">
            Try Again
        </button>
    </div>
);

export default PartnerWellness;
