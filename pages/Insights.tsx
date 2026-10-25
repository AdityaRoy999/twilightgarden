import { localDateKey } from '../lib/dates';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  ReferenceLine,
  PieChart,
  Pie,
  Legend
} from 'recharts';

import { useData } from '../contexts/DataContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { analyzeSleepEnergyCorrelations } from '../lib/wellnessAI';
import NotificationBell from '../components/NotificationBell';
import TodayReportModal from '../components/TodayReportModal';
import { ShareIcon, ShareIconHandle } from '../components/ui/AnimatedIcons';

const RECHARTS_SUPPRESS_STYLES = `.recharts-wrapper:focus-visible, .recharts-surface:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 3px; }`;

const Insights: React.FC = () => {
  useEffect(() => {
    // Suppress intrusive focus outlines on charts
    const id = 'recharts-suppress-focus';
    if (!document.getElementById(id)) {
      const style = document.createElement('style');
      style.id = id;
      style.innerHTML = RECHARTS_SUPPRESS_STYLES;
      document.head.appendChild(style);
    }
    // Intentionally not removing — shared across mounts, harmless singleton
  }, []);

  const { theme } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { cycleSettings, getCyclePhase, logs } = useData();

  const tooltipStyles = useMemo(() => ({
    contentStyle: {
      backgroundColor: theme === 'dark' ? '#1A161E' : '#FFFFFF',
      border: '1px solid ' + (theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'),
      borderRadius: '16px',
      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
      padding: '12px 16px',
    },
    itemStyle: {
      color: theme === 'dark' ? '#fff' : '#121014',
      fontSize: '14px',
      fontWeight: '600',
    },
    labelStyle: {
      color: theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
      fontSize: '11px',
      marginBottom: '4px',
      textTransform: 'uppercase' as const,
      fontWeight: '700',
      letterSpacing: '0.05em'
    }
  }), [theme]);
  const cycleData = getCyclePhase();
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');
  const [showTodayReport, setShowTodayReport] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [activeTab, setActiveTab] = useState<'history' | 'trends'>('history');
  const [trendsSubTab, setTrendsSubTab] = useState<'sleep' | 'energy'>('sleep');
  const shareIconRef = useRef<ShareIconHandle>(null);

  const [profile, setProfile] = useState<any>(() => {
    try {
      const cached = localStorage.getItem('twilight_profile');
      return cached ? JSON.parse(cached) : {};
    } catch { return {}; }
  });

  // Get today's log for the report card
  const todayStr = localDateKey();
  const todayLog = logs.find(l => l.date === todayStr) || null;

  // Share modal state
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);

  // Share functionality
  const handleShare = async () => {
    shareIconRef.current?.startAnimation();
    if (!user) {
      alert('Please log in to share');
      return;
    }
    if (isSharing) return; // Prevent double-click race

    setIsSharing(true);
    setCopied(false);
    try {
      const shareCode = crypto.randomUUID().replaceAll('-', '');
      const cardData = {
        userName: profile?.full_name || 'Anonymous',
        avatarUrl: profile?.avatar_url || '',
        cycleDay: cycleData.currentDay,
        phase: cycleData.phase,
        nextPeriodIn: cycleData.nextPeriodIn,
        moods: todayLog?.moods || [],
        symptoms: todayLog?.symptoms || [],
        flow: todayLog?.flow || null,
        date: todayStr
      };

      const { error } = await supabase.from('shared_cards').upsert({
        user_id: user.id, share_code: shareCode, card_data: cardData,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }, { onConflict: 'user_id' });
      if (error) throw error;
      const url = window.location.origin + '/#/share/' + shareCode;
      setShareUrl(url);
      setShowShareModal(true);
    } catch (err: any) {
      console.error('Share error:', err);
      alert('Failed to create share link: ' + err.message);
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  // 1. Calculate History & Real Averages
  const { historyData, stats } = React.useMemo(() => {
    if (!logs.length) return {
      historyData: [{ value: cycleSettings.avgCycleLength, label: 'Avg' }],
      stats: { avgCycle: cycleSettings.avgCycleLength, avgPeriod: cycleSettings.avgPeriodLength }
    };

    const periods: { start: Date, end: Date, length: number }[] = [];
    const sortedLogs = [...logs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let currentPeriodStart: Date | null = null;
    let currentPeriodEnd: Date | null = null;

    sortedLogs.forEach((log) => {
      if (log.flow) {
        const logDate = new Date(log.date);
        if (!currentPeriodStart) {
          currentPeriodStart = logDate;
          currentPeriodEnd = logDate;
        } else {
          const diffDays = (logDate.getTime() - currentPeriodEnd!.getTime()) / (1000 * 3600 * 24);
          if (diffDays > 7) {
            const length = Math.ceil((currentPeriodEnd!.getTime() - currentPeriodStart.getTime()) / (1000 * 3600 * 24)) + 1;
            periods.push({ start: currentPeriodStart, end: currentPeriodEnd!, length });
            currentPeriodStart = logDate;
            currentPeriodEnd = logDate;
          } else {
            currentPeriodEnd = logDate;
          }
        }
      }
    });

    if (currentPeriodStart && currentPeriodEnd) {
      const length = Math.ceil((currentPeriodEnd.getTime() - currentPeriodStart.getTime()) / (1000 * 3600 * 24)) + 1;
      periods.push({ start: currentPeriodStart, end: currentPeriodEnd, length });
    }

    const cycleLengths: { value: number, label: string }[] = [];
    for (let i = 0; i < periods.length - 1; i++) {
      const current = periods[i];
      const next = periods[i + 1];
      const diffTime = Math.abs(next.start.getTime() - current.start.getTime());
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays > 15 && diffDays < 60) {
        cycleLengths.push({
          value: diffDays,
          label: current.start.toLocaleString('default', { month: 'short' })
        });
      }
    }

    const totalPeriodLength = periods.reduce((sum, p) => sum + p.length, 0);
    const calculatedAvgPeriod = periods.length ? Math.round(totalPeriodLength / periods.length) : cycleSettings.avgPeriodLength;
    const totalCycleLength = cycleLengths.reduce((sum, c) => sum + c.value, 0);
    const calculatedAvgCycle = cycleLengths.length ? Math.round(totalCycleLength / cycleLengths.length) : cycleSettings.avgCycleLength;
    const finalHistory = cycleLengths.length > 0 ? cycleLengths.slice(-6) : [{ value: calculatedAvgCycle, label: 'Avg' }];

    return {
      historyData: finalHistory,
      stats: { avgCycle: calculatedAvgCycle, avgPeriod: calculatedAvgPeriod }
    };
  }, [logs, cycleSettings]);

  // 2. Calculate Top Symptoms
  const topSymptoms = React.useMemo(() => {
    const counts: Record<string, number> = {};
    logs.forEach(log => {
      log.symptoms?.forEach(sym => {
        counts[sym] = (counts[sym] || 0) + 1;
      });
    });

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3);
    if (sorted.length === 0) return [
      { name: 'No Data', level: '-', width: '0%', color: 'bg-gray-200' }
    ];

    const max = sorted[0][1];
    return sorted.map(([name, count], i) => {
      const baseline = Math.max(max, 5);
      const pct = (count / baseline) * 100;
      const color = i === 0 ? 'bg-primary' : i === 1 ? 'bg-[#E7D6A7]' : 'bg-[#2DD4BF]';
      const level = count > 5 ? 'High' : count > 2 ? 'Med' : 'Low';
      return { name, level, width: `${Math.max(pct, 5)}%`, color };
    });
  }, [logs]);

  // 3. Process Trends Data
  const trendsData = React.useMemo(() => {
    const sortedLogs = [...logs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const last30Logs = sortedLogs.slice(-30);
    const sleepMap: Record<string, number> = { 'good': 3, 'fair': 2, 'poor': 1 };
    const energyMap: Record<string, number> = { 'high': 3, 'medium': 2, 'low': 1 };

    return last30Logs.map(log => {
      const sleepRaw = log.sleepQuality;
      const energyRaw = log.energyLevel;
      return {
        date: new Date(log.date).toLocaleDateString('default', { month: 'short', day: 'numeric' }),
        sleep: sleepMap[sleepRaw as string] || null,
        energy: energyMap[energyRaw as string] || null
      };
    }).filter(d => d.sleep !== null || d.energy !== null);
  }, [logs]);

  const correlations = React.useMemo(() => {
    try {
      return analyzeSleepEnergyCorrelations(logs);
    } catch { return null; }
  }, [logs]);

  // 4. Calculate Sub-tab specific stats
  const sleepStats = React.useMemo(() => {
    const sleepLogs = logs.filter(l => l.sleepQuality);
    if (!sleepLogs.length) return null;

    const distribution = [
      { name: 'Good', value: sleepLogs.filter(l => (l.sleepQuality) === 'good').length, color: '#6366f1' },
      { name: 'Fair', value: sleepLogs.filter(l => (l.sleepQuality) === 'fair').length, color: '#a5b4fc' },
      { name: 'Poor', value: sleepLogs.filter(l => (l.sleepQuality) === 'poor').length, color: '#e0e7ff' }
    ].filter(d => d.value > 0);

    const scores = sleepLogs.map(l => {
      const q = l.sleepQuality;
      return q === 'good' ? 3 : q === 'fair' ? 2 : 1;
    });
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const avgLabel = avgScore > 2.5 ? 'Good' : avgScore > 1.5 ? 'Fair' : 'Poor';

    return { distribution, avgLabel, count: sleepLogs.length };
  }, [logs]);

  const energyStats = React.useMemo(() => {
    const energyLogs = logs.filter(l => l.energyLevel);
    if (!energyLogs.length) return null;

    const distribution = [
      { name: 'High', value: energyLogs.filter(l => (l.energyLevel) === 'high').length, color: '#f59e0b' },
      { name: 'Medium', value: energyLogs.filter(l => (l.energyLevel) === 'medium').length, color: '#fbbf24' },
      { name: 'Low', value: energyLogs.filter(l => (l.energyLevel) === 'low').length, color: '#fef3c7' }
    ].filter(d => d.value > 0);

    const scores = energyLogs.map(l => {
      const e = l.energyLevel;
      return e === 'high' ? 3 : e === 'medium' ? 2 : 1;
    });
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const avgLabel = avgScore > 2.5 ? 'High' : avgScore > 1.5 ? 'Medium' : 'Low';

    return { distribution, avgLabel, count: energyLogs.length };
  }, [logs]);

  return (
    <div className="animate-slideIn font-display flex flex-col pb-24 bg-[#FDFCF8] dark:bg-background-dark min-h-screen transition-colors">
      <header className="sticky top-0 z-10 flex items-center justify-between bg-[#FDFCF8] dark:bg-[#121014] backdrop-blur-md px-6 py-4 transition-all duration-200 border-b border-gray-100 dark:border-white/5">
        <h1 className="text-3xl font-bold tracking-tight text-[#121014] dark:text-white">Insights</h1>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <button
            onClick={handleShare}
            disabled={isSharing}
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-[#121014] dark:text-white disabled:opacity-50"
          >
            {isSharing ? (
              <span className="material-symbols-outlined text-2xl animate-spin">hourglass_empty</span>
            ) : (
              <ShareIcon ref={shareIconRef} size={24} />
            )}
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="w-full overflow-x-auto no-scrollbar py-2 px-6 bg-[#FDFCF8] dark:bg-background-dark mb-4 transition-colors">
        <div className="flex gap-3 min-w-max relative">
          <button
            onClick={() => setActiveTab('history')}
            className={`relative z-10 flex h-10 items-center justify-center px-6 rounded-full text-sm font-semibold transition-all ${
              activeTab === 'history'
                ? 'text-white'
                : 'bg-white/5 dark:bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            {activeTab === 'history' && (
              <motion.div
                layoutId="activeInsightsTab"
                className="absolute inset-0 bg-primary rounded-full shadow-md shadow-primary/20"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
              />
            )}
            <span className="relative z-20">History</span>
          </button>
          <button
            onClick={() => setActiveTab('trends')}
            className={`relative z-10 flex h-10 items-center justify-center px-6 rounded-full text-sm font-semibold transition-all ${
              activeTab === 'trends'
                ? 'text-white'
                : 'bg-white/5 dark:bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            {activeTab === 'trends' && (
              <motion.div
                layoutId="activeInsightsTab"
                className="absolute inset-0 bg-primary rounded-full shadow-md shadow-primary/20"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
              />
            )}
            <span className="relative z-20">Trends</span>
          </button>
          <button
            onClick={() => navigate('/breathing')}
            className="flex h-10 items-center justify-center px-6 rounded-full bg-white/5 dark:bg-white/5 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10 text-sm font-semibold transition-colors"
          >
            Breathe
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'history' ? (
          <motion.main
            key="history"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col gap-6 px-6"
          >
            <section className="relative overflow-hidden rounded-[2rem] bg-white dark:bg-surface-dark p-6 shadow-soft border border-gray-100 dark:border-white/5 transition-colors">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Prediction</p>
                  <h2 className="text-2xl font-bold text-[#121014] dark:text-white mb-1">{cycleData.nextPeriodIn < 0 ? `Period estimate passed by ${Math.abs(cycleData.nextPeriodIn)} days` : `Period in ${cycleData.nextPeriodIn} days`}</h2>
                  <p className="text-sm text-gray-400">based on {cycleSettings.avgCycleLength}d cycle</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-pink-100 dark:bg-pink-500/20 text-primary">
                  <span className="material-symbols-filled text-2xl">water_drop</span>
                </div>
              </div>
              <div className="flex justify-between text-xs font-medium text-gray-400 mb-2">
                <span>Day {cycleData.currentDay}</span>
                <span>{cycleSettings.avgCycleLength} Days Cycle</span>
              </div>
              <div className="h-3 w-full rounded-full bg-gray-100 dark:bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.min((cycleData.currentDay / cycleSettings.avgCycleLength) * 100, 100)}%` }}
                ></div>
              </div>
            </section>

            <section className="grid grid-cols-2 gap-4">
              <div className="flex flex-col items-center justify-center gap-3 rounded-[2rem] bg-white dark:bg-surface-dark p-6 shadow-soft border border-gray-100 dark:border-white/5 text-center h-48 transition-colors">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400">
                  <span className="material-symbols-outlined text-2xl">refresh</span>
                </div>
                <h3 className="text-3xl font-bold text-[#121014] dark:text-white">{stats.avgCycle}</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest max-w-[80px]">Avg Cycle Length</p>
              </div>
              <div className="flex flex-col items-center justify-center gap-3 rounded-[2rem] bg-white dark:bg-surface-dark p-6 shadow-soft border border-gray-100 dark:border-white/5 text-center h-48 transition-colors">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400">
                  <span className="material-symbols-outlined text-2xl">bar_chart</span>
                </div>
                <h3 className="text-3xl font-bold text-[#121014] dark:text-white">{stats.avgPeriod}</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest max-w-[80px]">Avg Period Duration</p>
              </div>
            </section>

            <section className="rounded-[2rem] bg-white dark:bg-surface-dark p-6 shadow-soft border border-gray-100 dark:border-white/5 transition-colors">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-lg font-bold text-[#121014] dark:text-white">Cycle History</h3>
                  <p className="text-sm text-gray-400">Length variation over time</p>
                </div>
                <div className="flex items-center bg-white/5 rounded-xl p-1 gap-1 relative">
                  <div className="absolute inset-0 p-1 pointer-events-none">
                    <div className={`h-full w-1/2 rounded-lg bg-primary shadow-sm transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] ${chartType === 'line' ? 'translate-x-full' : 'translate-x-0'}`}></div>
                  </div>
                  <button onClick={() => setChartType('bar')} className={`relative z-10 flex-1 p-2 rounded-lg transition-colors duration-300 ${chartType === 'bar' ? 'text-white' : 'text-gray-400 hover:text-white'}`}>
                    <span className="material-symbols-outlined text-lg block text-center">bar_chart</span>
                  </button>
                  <button onClick={() => setChartType('line')} className={`relative z-10 flex-1 p-2 rounded-lg transition-colors duration-300 ${chartType === 'line' ? 'text-white' : 'text-gray-400 hover:text-white'}`}>
                    <span className="material-symbols-outlined text-lg block text-center">show_chart</span>
                  </button>
                </div>
              </div>

              <div className="relative h-48 mt-4 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === 'bar' ? (
                    <BarChart data={historyData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }} barCategoryGap="20%">
                      <YAxis hide domain={['dataMin - 5', 'dataMax + 5']} />
                      <ReferenceLine y={stats.avgCycle} stroke={theme === 'dark' ? 'rgba(255,255,255,0.2)' : '#E5E7EB'} strokeDasharray="3 3" />
                      <Tooltip
                        cursor={{ fill: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
                        contentStyle={tooltipStyles.contentStyle}
                        itemStyle={tooltipStyles.itemStyle}
                        labelStyle={tooltipStyles.labelStyle}
                      />
                      <Bar dataKey="value" radius={[8, 8, 0, 0]} animationDuration={1500} animationEasing="ease-out" maxBarSize={40}>
                        {historyData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index >= historyData.length - 1 ? '#984369' : (theme === 'dark' ? '#ffffff1a' : '#E5E7EB')} />
                        ))}
                      </Bar>
                    </BarChart>
                  ) : (
                    <AreaChart data={historyData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorHistory" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#984369" stopOpacity={0.6} /><stop offset="95%" stopColor="#984369" stopOpacity={0} /></linearGradient>
                      </defs>
                      <YAxis hide domain={['dataMin - 5', 'dataMax + 5']} />
                      <Tooltip
                        contentStyle={tooltipStyles.contentStyle}
                        itemStyle={tooltipStyles.itemStyle}
                        labelStyle={tooltipStyles.labelStyle}
                      />
                      <Area type="monotone" dataKey="value" stroke="#984369" strokeWidth={3} fillOpacity={1} fill="url(#colorHistory)" dot={{ r: 4, fill: "#984369" }} activeDot={{ r: 6 }} />
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              </div>
            </section>

            <section className="rounded-[2rem] bg-white dark:bg-surface-dark p-6 shadow-soft border border-gray-100 dark:border-white/5 transition-colors">
              <h3 className="text-lg font-bold text-[#121014] dark:text-white mb-6 flex items-center gap-2">
                <span className="material-symbols-filled text-primary text-xl">Auto_Awesome</span>
                Common Symptoms
              </h3>
              <div className="flex flex-col gap-5">
                {topSymptoms.map((s) => (
                  <div key={s.name} className="flex flex-col gap-2">
                    <div className="flex justify-between text-sm font-semibold">
                      <span className="capitalize text-gray-700 dark:text-gray-300">{s.name}</span>
                      <span className="text-gray-400">{s.level}</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-gray-100 dark:bg-white/5">
                      <div className={`h-full rounded-full ${s.color}`} style={{ width: s.width }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[2rem] bg-[#F9F7F2] dark:bg-[#2C2A24] p-6 shadow-sm border border-transparent">
              <div className="flex items-start gap-4">
                <div className="text-orange-300 dark:text-orange-400 mt-1">
                  <span className="material-symbols-filled text-2xl">lightbulb</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Did you know?</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-3">
                    Your cycle tends to be <span className="font-bold text-primary">2 days shorter</span> when you report higher sleep quality during the luteal phase.
                  </p>
                  <button
                    onClick={() => {
                      setActiveTab('trends');
                      setTrendsSubTab('sleep');
                    }}
                    className="text-primary text-sm font-bold flex items-center gap-1 hover:gap-2 transition-all"
                  >
                    View Sleep Trends <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </button>
                </div>
              </div>
            </section>

            <div className="mt-2 text-center">
              <button
                onClick={() => setShowTodayReport(true)}
                className="w-full bg-[#984369] hover:bg-[#984369]/90 text-white font-bold py-4 rounded-2xl shadow-lg shadow-[#984369]/20 transition-all flex items-center justify-center gap-2 mb-3"
              >
                <span className="material-symbols-outlined">today</span>
                Generate Today's Report Card
              </button>
              <p className="text-xs text-gray-400 px-4 leading-relaxed">
                Creates a shareable card of your today's symptoms and cycle status.
              </p>
            </div>
          </motion.main>
        ) : (
          <motion.main
            key="trends"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex flex-col gap-6 px-6"
          >
            {/* Trends Sub-navigation */}
            <div className="flex bg-gray-100/50 dark:bg-white/5 p-1 rounded-2xl self-center mb-2 relative">
              <button
                onClick={() => setTrendsSubTab('sleep')}
                className={`relative z-10 flex h-9 items-center justify-center px-6 rounded-xl text-xs font-bold transition-all ${
                  trendsSubTab === 'sleep' ? 'text-[#121014] dark:text-white' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
                }`}
              >
                {trendsSubTab === 'sleep' && (
                  <motion.div
                    layoutId="activeSubTab"
                    className="absolute inset-0 bg-white dark:bg-white/10 rounded-xl shadow-sm"
                    transition={{ type: 'spring', bounce: 0.1, duration: 0.5 }}
                  />
                )}
                <span className="relative z-20">Sleep</span>
              </button>
              <button
                onClick={() => setTrendsSubTab('energy')}
                className={`relative z-10 flex h-9 items-center justify-center px-6 rounded-xl text-xs font-bold transition-all ${
                  trendsSubTab === 'energy' ? 'text-[#121014] dark:text-white' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
                }`}
              >
                {trendsSubTab === 'energy' && (
                  <motion.div
                    layoutId="activeSubTab"
                    className="absolute inset-0 bg-white dark:bg-white/10 rounded-xl shadow-sm"
                    transition={{ type: 'spring', bounce: 0.1, duration: 0.5 }}
                  />
                )}
                <span className="relative z-20">Energy</span>
              </button>
            </div>

            <AnimatePresence mode="wait">
              {trendsSubTab === 'sleep' ? (
                <motion.div
                  key="sleep-trends"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex flex-col gap-6"
                >
                  {/* Sleep Summary Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-indigo-500/10 dark:bg-indigo-500/20 p-5 rounded-[2rem] border border-indigo-500/20 dark:border-indigo-500/30 transition-colors backdrop-blur-sm">
                      <p className="text-[10px] uppercase font-bold text-indigo-500 mb-1 tracking-wider">Avg Quality</p>
                      <h4 className="text-xl font-bold text-[#121014] dark:text-white">{sleepStats?.avgLabel || '--'}</h4>
                    </div>
                    <div className="bg-rose-500/10 dark:bg-rose-500/20 p-5 rounded-[2rem] border border-rose-500/20 dark:border-rose-500/30 transition-colors backdrop-blur-sm">
                      <p className="text-[10px] uppercase font-bold text-rose-500 mb-1 tracking-wider">Consistency</p>
                      <h4 className="text-xl font-bold text-[#121014] dark:text-white">{sleepStats ? Math.round((sleepStats.distribution[0]?.value / sleepStats.count) * 100) : 0}%</h4>
                    </div>
                  </div>

                  {/* Sleep Chart Card */}
                  <section className="rounded-[2.5rem] bg-white dark:bg-surface-dark p-8 shadow-soft border border-gray-100 dark:border-white/5 transition-colors">
                    <div className="flex items-center justify-between mb-8">
                      <div>
                        <h3 className="text-xl font-bold text-[#121014] dark:text-white">Sleep Timeline</h3>
                        <p className="text-sm text-gray-400">Quality over the last 30 days</p>
                      </div>
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500">
                        <span className="material-symbols-outlined text-2xl">bedtime</span>
                      </div>
                    </div>

                    <div className="h-56 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trendsData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorSleep" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} /><stop offset="95%" stopColor="#6366f1" stopOpacity={0} /></linearGradient>
                          </defs>
                          <YAxis hide domain={[0, 4]} />
                           <Tooltip
                            contentStyle={tooltipStyles.contentStyle}
                            itemStyle={tooltipStyles.itemStyle}
                            labelStyle={tooltipStyles.labelStyle}
                            formatter={(value: any) => [value === 3 ? 'Good' : value === 2 ? 'Fair' : 'Poor', 'Quality']}
                          />
                          <Area
                            type="monotone"
                            dataKey="sleep"
                            stroke="#6366f1"
                            strokeWidth={5}
                            fillOpacity={1}
                            fill="url(#colorSleep)"
                            animationDuration={1500}
                            dot={{ r: 4, fill: "#6366f1", strokeWidth: 2, stroke: theme === 'dark' ? '#121014' : '#fff' }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </section>

                  {/* Sleep Distribution Card */}
                  <section className="rounded-[2.5rem] bg-white dark:bg-surface-dark p-8 shadow-soft border border-gray-100 dark:border-white/5 transition-colors">
                    <h3 className="text-xl font-bold text-[#121014] dark:text-white mb-2">Quality Split</h3>
                    <p className="text-sm text-gray-400 mb-6">Distribution of reported nights</p>

                    <div className="flex items-center justify-center h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={sleepStats?.distribution || []}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            animationDuration={1500}
                          >
                            {(sleepStats?.distribution || []).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: theme === 'dark' ? '#1A161E' : '#FFFFFF',
                              border: '1px solid ' + (theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'),
                              borderRadius: '16px',
                              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)',
                            }}
                            itemStyle={{ color: theme === 'dark' ? '#fff' : '#121014' }}
                          />
                          <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </section>
                </motion.div>
              ) : (
                <motion.div
                  key="energy-trends"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex flex-col gap-6"
                >
                  {/* Energy Summary Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-amber-500/10 dark:bg-amber-500/20 p-5 rounded-[2rem] border border-amber-500/20 dark:border-amber-500/30 transition-colors backdrop-blur-sm">
                      <p className="text-[10px] uppercase font-bold text-amber-500 mb-1 tracking-wider">Avg Level</p>
                      <h4 className="text-xl font-bold text-[#121014] dark:text-white">{energyStats?.avgLabel || '--'}</h4>
                    </div>
                    <div className="bg-teal-500/10 dark:bg-teal-500/20 p-5 rounded-[2rem] border border-teal-500/20 dark:border-teal-500/30 transition-colors backdrop-blur-sm">
                      <p className="text-[10px] uppercase font-bold text-teal-500 mb-1 tracking-wider">Record Streak</p>
                      <h4 className="text-xl font-bold text-[#121014] dark:text-white">{energyStats?.count || 0}d</h4>
                    </div>
                  </div>

                  {/* Energy Chart Card */}
                  <section className="rounded-[2.5rem] bg-white dark:bg-surface-dark p-8 shadow-soft border border-gray-100 dark:border-white/5 transition-colors">
                    <div className="flex items-center justify-between mb-8">
                      <div>
                        <h3 className="text-xl font-bold text-[#121014] dark:text-white">Energy Flow</h3>
                        <p className="text-sm text-gray-400">Vitality patterns recently</p>
                      </div>
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
                        <span className="material-symbols-outlined text-2xl">bolt</span>
                      </div>
                    </div>

                    <div className="h-56 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trendsData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorEnergy" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} /><stop offset="95%" stopColor="#f59e0b" stopOpacity={0} /></linearGradient>
                          </defs>
                          <YAxis hide domain={[0, 4]} />
                          <Tooltip
                            contentStyle={tooltipStyles.contentStyle}
                            itemStyle={tooltipStyles.itemStyle}
                            labelStyle={tooltipStyles.labelStyle}
                            formatter={(value: any) => [value === 3 ? 'High' : value === 2 ? 'Medium' : 'Low', 'Level']}
                          />
                          <Area
                            type="monotone"
                            dataKey="energy"
                            stroke="#f59e0b"
                            strokeWidth={5}
                            fillOpacity={1}
                            fill="url(#colorEnergy)"
                            animationDuration={1500}
                            dot={{ r: 4, fill: "#f59e0b", strokeWidth: 2, stroke: theme === 'dark' ? '#121014' : '#fff' }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </section>

                  {/* Energy Distribution Card */}
                  <section className="rounded-[2.5rem] bg-white dark:bg-surface-dark p-8 shadow-soft border border-gray-100 dark:border-white/5 transition-colors">
                    <h3 className="text-xl font-bold text-[#121014] dark:text-white mb-2">Energy Split</h3>
                    <p className="text-sm text-gray-400 mb-6">Proportion of energy levels reported</p>

                    <div className="flex items-center justify-center h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={energyStats?.distribution || []}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            animationDuration={1500}
                          >
                            {(energyStats?.distribution || []).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: theme === 'dark' ? '#1A161E' : '#FFFFFF',
                              border: '1px solid ' + (theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'),
                              borderRadius: '16px',
                              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)',
                            }}
                            itemStyle={{ color: theme === 'dark' ? '#fff' : '#121014' }}
                          />
                          <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </section>
                </motion.div>
              )}
            </AnimatePresence>

            {correlations?.insights && (
              <section className="rounded-[2rem] bg-primary/5 dark:bg-primary/10 p-6 border border-primary/10 mb-20 shadow-sm">
                <h3 className="text-lg font-bold text-primary mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined">analytics</span>
                  Wellness Insights
                </h3>
                <div className="flex flex-col gap-3">
                  {correlations.insights.map((insight: string, idx: number) => (
                    <div key={idx} className="flex gap-3 items-start">
                      <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed font-medium">
                        {insight}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <div className="px-4 text-center">
              <p className="text-xs text-gray-400">
                Graphs show data based on your last 30 daily logs.
              </p>
            </div>
          </motion.main>
        )}
      </AnimatePresence>

      <TodayReportModal
        isOpen={showTodayReport}
        onClose={() => setShowTodayReport(false)}
        todayLog={todayLog}
        cycleSettings={cycleSettings}
        profile={profile}
      />

      <AnimatePresence>
        {showShareModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6" onClick={() => setShowShareModal(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white dark:bg-surface-dark rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-gray-100 dark:border-white/10" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center"><span className="material-symbols-outlined text-primary">share</span></div>
                  <h3 className="text-lg font-bold text-[#121014] dark:text-white">Share Your Card</h3>
                </div>
                <button onClick={() => setShowShareModal(false)} className="w-8 h-8 rounded-full hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center"><span className="material-symbols-outlined text-gray-400">close</span></button>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Anyone with this link can view your card for 24 hours. Creating a new link replaces the previous one.</p>
              <div className="flex items-center gap-2 bg-gray-100 dark:bg-white/5 rounded-xl p-3 border border-gray-200 dark:border-white/10">
                <input type="text" value={shareUrl} readOnly className="flex-1 bg-transparent text-sm text-[#121014] dark:text-white truncate outline-none" />
                <button onClick={handleCopyLink} className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all ${copied ? 'bg-green-500 text-white' : 'bg-primary hover:bg-primary/90 text-white'}`}><span className="material-symbols-outlined text-lg">{copied ? 'check' : 'content_copy'}</span></button>
              </div>
              {copied && <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-center text-sm text-green-500 font-medium mt-3">✓ Link copied to clipboard!</motion.p>}
              <div className="mt-6 pt-4 border-t border-gray-100 dark:border-white/5"><button onClick={() => setShowShareModal(false)} className="w-full py-3 rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold transition-colors">Done</button></div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Insights;
