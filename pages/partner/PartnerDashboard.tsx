import {ConnectionScreen} from '../../components/ConnectionScreen';
import { DailyGuidance } from '../../components/wellness/DailyGuidance';
import { AppIcon } from '../../components/ui/Icons';
import { CycleHero } from '../../components/ui/CycleHero';
import { CycleBloom, BotanicalSprig } from '../../components/ui/CycleBloom';
import { localDateKey } from '../../lib/dates';
import { useToday } from '../../hooks/useToday';
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCouples } from '../../contexts/CouplesContext';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import { calculateCyclePhase } from '../../lib/cycleUtils';
import LogDetailsModal from '../../components/LogDetailsModal';
import NotificationBell from '../../components/NotificationBell';
import PartnerInsightsView from '../../components/PartnerInsightsView';
import { useTheme } from '../../contexts/ThemeContext';

const PartnerDashboard: React.FC = () => {
    const { couple, partnerData, loading } = useCouples();
    const { user } = useAuth();
    const { theme } = useTheme();
    const todayStr = useToday();
    const [selectedLogDate, setSelectedLogDate] = React.useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = React.useState(false);

    // Use AuthContext user directly — refreshUser keeps it in sync after profile edits
    const myDisplayName = user?.name || user?.email?.split('@')[0] || 'Me';
    const myAvatarUrl = user?.avatar_url || null;

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!couple || couple.status === 'pending') return <ConnectionScreen/>;

    const { profile, settings, logs } = partnerData;
    const cycleSettings = settings || {
        avgCycleLength: 28,
        avgPeriodLength: 5,
        lastPeriodStart: '',
        onboardingCompleted: false,
        irregularCycle: false
    };

    const cycleData = calculateCyclePhase(todayStr, cycleSettings,logs);

    const phaseLabel = cycleData.phase === 'Unknown' ? 'Phase unavailable' : `${cycleData.phase} phase`;
    // Get today's log
    const todayLog = logs?.find(l => l.date === todayStr);

    // Get yesterday's log (for "Yesterday's Status" logic if today is empty? Or just show Latest Log?)
    // User dashboard shows "Track Symptoms" if today empty, or "View Today's Log" if full.
    // Partner dashboard should show "Partner hasn't logged today" or "View Today's Update".

    return (
        <div className="bloom-partner pb-8 pt-6 px-5 max-w-md md:max-w-5xl mx-auto min-h-screen">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden border-2 border-white shadow-sm">
                        {myAvatarUrl ? (
                            <img src={myAvatarUrl} alt="Me" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-primary/20 text-primary font-bold text-xl">
                                {myDisplayName.charAt(0).toUpperCase()}
                            </div>
                        )}
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                            {profile?.full_name || 'My Partner'}
                        </h1>
                        <p className="text-xs text-gray-500 font-medium tracking-wide uppercase">
                            CONNECTED
                        </p>
                    </div>
                </div>
                {/* Notification Bell — real-time via useNotifications */}
                <NotificationBell />
            </div>

            <div className="w-full">
            <div className="md:grid md:grid-cols-2 md:gap-8 md:items-start">
             <CycleHero className="mb-6 md:mb-0 md:col-span-2">
               <BotanicalSprig className="bloom-hero-leaves"/>
               <div className="bloom-cycle-copy"><p>Your partner’s rhythm</p><h2>{cycleData.currentDay ? `Day ${cycleData.currentDay}` : 'One day at a time'}</h2><h3>{phaseLabel}</h3><p className="bloom-muted">A little understanding goes a long way.</p></div>
               <CycleBloom periodLength={cycleSettings.avgPeriodLength} introKey={user?.id} day={cycleData.currentDay} length={cycleSettings.avgCycleLength} hasEstimate={cycleData.hasEstimate !== false}/>
             </CycleHero>

             {/* Right Column: Stats & Updates */}
             <div className="flex flex-col gap-6">
                 {/* Info Grid */}
                 <div className="grid grid-cols-2 gap-4">
                    {/* Next Period */}
                    <div className="bloom-card partner-metric-card">
                         <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                            <span className="app-icon-glyph text-4xl text-primary"><AppIcon name={"water_drop"}/></span>
                         </div>
                         <div>
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{cycleData.nextPeriodIn < 0 ? 'Past estimate' : 'Next period'}</span>
                            <div className="mt-1 flex items-baseline gap-1">
                                 <span className="text-3xl font-bold text-gray-800 dark:text-white">
                                     {cycleData.hasEstimate===false?'—':Math.abs(cycleData.nextPeriodIn)}
                                 </span>
                                 <span className="text-sm font-medium text-gray-500">{cycleData.hasEstimate===false?'No estimate yet':'days'}</span>
                            </div>
                         </div>
                         <div className="w-full bg-gray-100 dark:bg-white/10 h-1.5 rounded-full mt-3 overflow-hidden">
                            <div
                                className="h-full bg-primary rounded-full"
                                style={{ width: `${cycleData.hasEstimate===false?0:Math.max(0,Math.min(100,((cycleData.currentDay-1)/cycleSettings.avgCycleLength)*100))}%` }} // Reverse logic approx
                            ></div>
                         </div>
                    </div>

                    {/* Fertility Status */}
                    <div className="bloom-card partner-metric-card">
                         <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                            <span className="app-icon-glyph text-4xl text-teal-500"><AppIcon name={"egg_alt"}/></span>
                         </div>
                         <div>
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Fertility</span>
                            <div className="mt-1">
                                 <span className={`text-xl font-bold ${cycleData.isFertile ? 'text-teal-600 dark:text-teal-400' : 'text-gray-800 dark:text-white'}`}>
                                     {cycleData.hasEstimate===false?'Unavailable':cycleData.isOvulation?'Estimated ovulation':cycleData.isFertile?'Estimated window':'Outside window'}
                                 </span>
                            </div>
                         </div>
                         <p className="text-xs text-gray-500 leading-tight">
                             {cycleData.hasEstimate===false?'No reliable calendar estimate.':'Calendar estimates can vary.'}
                         </p>
                    </div>
                 </div>

                 {/* Today's Log Status */}
                <div className="bg-white dark:bg-surface-dark rounded-[28px] p-6 shadow-soft border border-gray-100 dark:border-white/5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-lg text-gray-800 dark:text-white">Today's Status</h3>
                        <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">{format(new Date(), 'MMM d')}</span>
                    </div>

                    {todayLog ? (
                        <div
                            onClick={() => {
                                setSelectedLogDate(todayStr);
                                setIsModalOpen(true);
                            }}
                            className="bg-gray-50 dark:bg-white/5 rounded-2xl p-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                        >
                             <div className="flex gap-4">
                                 {/* Mood Pill */}
                                 {todayLog.moods && todayLog.moods.length > 0 ? (
                                     <div className="flex flex-col gap-1">
                                         <span className="text-xs text-gray-500">Mood</span>
                                         <span className="font-bold text-gray-800 dark:text-white capitalize">{todayLog.moods[0]}</span>
                                     </div>
                                 ) : (
                                    <div className="flex flex-col gap-1">
                                         <span className="text-xs text-gray-500">Mood</span>
                                         <span className="font-bold text-gray-400">-</span>
                                     </div>
                                 )}

                                 <div className="w-px bg-gray-200 dark:bg-white/10"></div>

                                 {/* Symptoms Count */}
                                 <div className="flex flex-col gap-1">
                                     <span className="text-xs text-gray-500">Symptoms</span>
                                     <span className="font-bold text-gray-800 dark:text-white">{todayLog.symptoms?.length || 0}</span>
                                 </div>

                                 <div className="ml-auto flex items-center text-primary text-sm font-bold">
                                     View Details
                                     <span className="app-icon-glyph text-sm ml-1"><AppIcon name={"arrow_forward"}/></span>
                                 </div>
                             </div>
                        </div>
                    ) : (
                        <div className="bg-gray-50 dark:bg-white/5 rounded-2xl p-6 text-center border-2 border-dashed border-gray-200 dark:border-white/10">
                            <span className="app-icon-glyph text-gray-300 text-3xl mb-2"><AppIcon name={"history_toggle_off"}/></span>
                            <p className="text-gray-500 font-medium">No update yet today.</p>
                            <p className="text-xs text-gray-400 mt-1">Check back later or check in with her!</p>
                        </div>
                    )}
                </div>

                <DailyGuidance phase={cycleData.phase} cycleDay={cycleData.currentDay} logs={logs} today={todayStr} partner/>

             </div>
            </div>
            </div>

            {/* Modals */}
             {selectedLogDate && (
                 <LogDetailsModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    log={logs?.find(l => l.date === selectedLogDate) || null}
                    date={selectedLogDate}
                    readOnly={true}
                 />
             )}
        </div>
    );
};

export default PartnerDashboard;
