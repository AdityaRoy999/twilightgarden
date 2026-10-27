import { NearestPads } from '../components/wellness/NearestPads';
import { buildWellnessContext } from '../lib/wellnessContext';
import { GuidancePending } from '../components/wellness/GuidancePending';
import { IllustratedGuide } from '../components/wellness/IllustratedGuide';
import { SleepEnergy } from '../components/wellness/SleepEnergy';
import { WellnessIllustration } from '../components/wellness/WellnessIllustration';
import { useGeneratedText } from '../hooks/useGeneratedText';
import { useAppMotion } from '../hooks/useAppMotion';
import { springs, motionTransition } from '../lib/motion';
import { ReferenceHeading } from '../components/ui/ReferenceArt';
import { AppIcon } from '../components/ui/Icons';
import { useToday } from '../hooks/useToday';
import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useData } from '../contexts/DataContext';
import { useTheme } from '../contexts/ThemeContext';
import NotificationBell from '../components/NotificationBell';
import {
    generateWellnessTips,
    generateEmpathyAlerts,
    analyzeSleepEnergyCorrelations,
} from '../lib/wellnessAI';

type Tab = 'tips' | 'sleep' | 'empathy' | 'shops';

const Wellness: React.FC = () => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const { logs, getCyclePhase, cycleSettings } = useData();
    const cycleData = getCyclePhase();

    const [activeTab, setActiveTab] = useState<Tab>('tips');
    const { reduced } = useAppMotion();

    // Build context for AI
    const todayStr = useToday();
    const todayLog = logs.find(l => l.date === todayStr);

    const ctx = useMemo(()=>buildWellnessContext({phase:cycleData.phase,cycleDay:cycleData.currentDay,logs,today:todayStr}),[cycleData.phase,cycleData.currentDay,logs,todayStr]);

    // Sleep/Energy correlations (client-side)
    const sleepData = useMemo(() => analyzeSleepEnergyCorrelations(logs), [logs]);

    const guidance = useGeneratedText({ tips: (refresh) => generateWellnessTips(ctx,refresh), empathy: (refresh) => generateEmpathyAlerts(ctx,refresh) }, JSON.stringify(ctx));
    const tipsText = guidance.entries.tips?.text || '';
    const empathyText = guidance.entries.empathy?.text || '';
    const activeGuidance = activeTab === 'tips' || activeTab === 'empathy' ? guidance.entries[activeTab] : undefined;
    const loading = activeGuidance?.status === 'loading';
    const error = activeGuidance?.error || '';
    const fetchTips = () => void guidance.request('tips', true);
    const fetchEmpathy = () => void guidance.request('empathy', true);
    useEffect(() => {
        if (activeTab === 'tips' || activeTab === 'empathy') void guidance.request(activeTab);

    }, [activeTab, guidance.request]);

    const tabs: { key: Tab; label: string; icon: string }[] = [
        { key: 'tips', label: 'Tips', icon: 'spa' },
        { key: 'sleep', label: 'Sleep & Energy', icon: 'bedtime' },
        { key: 'empathy', label: 'Empathy', icon: 'favorite' },
        { key: 'shops', label: 'Nearest Pad', icon: 'location_on' },
    ];

    const renderTipsContent = () => {
        if (!activeGuidance || (loading && !tipsText)) return <GuidancePending/>;
        if (error) return <ErrorCard message={error} onRetry={fetchTips} isDark={isDark} />;

        return <IllustratedGuide text={tipsText} onRefresh={fetchTips} busy={loading}/>;
    };

    const renderSleepContent = () => <SleepEnergy data={sleepData}/>;

    const renderEmpathyContent = () => {
        if (!activeGuidance || (loading && !empathyText)) return <GuidancePending partner/>;
        if (error) return <ErrorCard message={error} onRetry={fetchEmpathy} isDark={isDark}/>;
        return <div className="care-guide-view"><aside className="care-preview-banner"><AppIcon name="info" size={26}/><p>A preview of the kind of care suggestions your partner can explore. Each guide is personalized when it’s generated.</p><WellnessIllustration id="kind-message" decorative/></aside><IllustratedGuide text={empathyText} partner onRefresh={fetchEmpathy} busy={loading}/></div>;
    };

    const renderShopsContent = () => <NearestPads/>;

    return (
        <div className="reference-page reference-wellness font-display flex flex-col">
            <ReferenceHeading title="Wellness" description="A little care, at your own pace." action={<NotificationBell/>}/>
            <section className="reference-card wellness-overview"><WellnessIllustration id={activeTab === 'sleep' ? 'sleep-chart' : activeTab === 'empathy' ? 'supportive-couple' : activeTab === 'shops' ? 'pharmacy' : 'gentle-stretch'} className="wellness-overview-art" decorative/><span className="reference-icon"><AppIcon name={activeTab === 'sleep' ? 'bedtime' : 'spa'} size={26}/></span><div><span className="bloom-eyebrow">Your daily rhythm</span><h2>{cycleData.phase === 'Unknown' ? 'One day at a time' : `${cycleData.phase} phase`}</h2><p>{cycleData.currentDay > 0 ? `Cycle day ${cycleData.currentDay}` : 'Start with a daily check-in'}{todayLog?.sleepHours !== undefined ? ` · ${todayLog.sleepHours}h of sleep logged` : ''}</p></div></section>

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
                        {activeTab === 'tips' && renderTipsContent()}
                        {activeTab === 'sleep' && renderSleepContent()}
                        {activeTab === 'empathy' && renderEmpathyContent()}
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

export default Wellness;
