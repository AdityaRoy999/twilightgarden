import {MetricTooltip, DistributionTooltip} from '../components/charts/MetricTooltip';
import {symptomSymbol} from '../lib/symptomSymbols';
import {LogHistoryView} from '../components/history/LogHistoryView';
import {SegmentedControl} from '../components/ui/SegmentedControl';
import {ExerciseLibrary} from '../components/exercise/ExerciseLibrary';
import { DailyGuidance } from '../components/wellness/DailyGuidance';
import { useToday } from '../hooks/useToday';
import { cycleStatistics } from '../lib/cycleStatistics';
import { springs, motionTransition } from '../lib/motion';
import { useAppMotion } from '../hooks/useAppMotion';
import { MotionPortal } from '../components/ui/MotionPortal';
import { AppIcon } from '../components/ui/Icons';
import { ReferenceArt, ReferenceHeading } from '../components/ui/ReferenceArt';
import { ArrowRight, CalendarDays, Sparkles, Lightbulb, Ellipsis } from '../components/ui/Icons';
import ChartEmptyState from '../components/ui/ChartEmptyState';
import { localDateKey } from '../lib/dates';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
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
  const { reduced } = useAppMotion();
  useEffect(() => {
    // Suppress intrusive focus outlines on charts
    const id = 'recharts-suppress-focus';
    if (!document.getElementById(id)) {
      const style = document.createElement('style');
      style.id = id;
      style.innerHTML = RECHARTS_SUPPRESS_STYLES;
      document.head.appendChild(style);
    }
    // Intentionally not removing â€” shared across mounts, harmless singleton
  }, []);

  const { theme, animationsEnabled } = useTheme();
  const reducedMotion = useReducedMotion();
  const animateCharts = animationsEnabled !== false && !reducedMotion;
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
  const [activeTab, setActiveTab] = useState<'overview' | 'cycle' | 'history' | 'trends' | 'exercise'>('overview');
  const [trendsSubTab, setTrendsSubTab] = useState<'sleep' | 'energy'>('sleep');
  const shareIconRef = useRef<ShareIconHandle>(null);

  const [profile, setProfile] = useState<any>(() => {
    try {
      const cached = localStorage.getItem('twilight_profile');
      return cached ? JSON.parse(cached) : {};
    } catch { return {}; }
  });

  // Get today's log for the report card
  const todayStr = useToday();
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

  const {historyData,stats}=useMemo(()=>cycleStatistics(logs||[],cycleSettings),[logs,cycleSettings]);

  // 2. Calculate Top Symptoms
  const topSymptoms = React.useMemo(() => {
    const counts: Record<string, number> = {};
    logs.forEach(log => {
      [...new Set(log.symptoms||[])].forEach(sym => {
        counts[sym] = (counts[sym] || 0) + 1;
      });
    });

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3);
    if (sorted.length === 0) return [
      { name: 'No Data', level: '-', width: '0%', color: 'bg-gray-200' }
    ];


    return sorted.map(([name, count], i) => {
      const baseline = Math.max(logs.length, 1);
      const pct = (count / baseline) * 100;
      const color = i === 0 ? 'bg-primary' : i === 1 ? 'bg-[#E7D6A7]' : 'bg-[#2DD4BF]';
      const level = `${count} of ${logs.length} check-ins`;
      return { name, level, width: `${pct}%`, color };
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
        date: log.date,
        sleepHours: log.sleepHours,
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

    return { distribution, avgLabel, count: sleepLogs.length, startDate:sleepLogs.map(l=>l.date).sort()[0],endDate:sleepLogs.map(l=>l.date).sort().at(-1) };
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

    return { distribution, avgLabel, count: energyLogs.length, startDate:energyLogs.map(l=>l.date).sort()[0],endDate:energyLogs.map(l=>l.date).sort().at(-1) };
  }, [logs]);

  return (
    <div className="reference-page reference-insights font-display">
      <ReferenceHeading title="Insights" description="Learn more about your cycle and how to feel your best." action={<details className="relative"><summary className="reference-round-action cursor-pointer list-none" aria-label="Insight options"><Ellipsis size={24}/></summary><div className="absolute right-0 top-14 z-50 flex items-center gap-2 rounded-2xl bg-surface-dark p-3 shadow-medium"><NotificationBell/><button onClick={handleShare} disabled={isSharing} aria-label="Share today’s insights" className="min-h-11 px-3 text-sm text-primary">{isSharing ? 'Creating link…' : 'Share summary'}</button></div></details>}/>

      <SegmentedControl<'overview'|'cycle'|'history'|'trends'|'exercise'> label="Insight sections" value={activeTab} onChange={setActiveTab} options={[
        {value:'overview',label:'Overview',icon:'auto_awesome'},{value:'cycle',label:'Cycle',icon:'calendar_today'},{value:'history',label:'History',icon:'history'},{value:'trends',label:'Trends',icon:'insights'},{value:'exercise',label:'Exercise',icon:'accessibility_new'}
      ]}/>

      <React.Fragment>
        {activeTab === 'history' ? <LogHistoryView logs={logs} readOnly={false} onEdit={date=>navigate(`/log/details?date=${date}`)}/> : activeTab === 'exercise' ? <ExerciseLibrary logs={logs}/> : activeTab === 'overview' ? (
          <motion.main
            key="history"
            initial={reduced ? false : { x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={motionTransition(springs.section, reduced)}
            className="reference-stack"
          >
            <section className="reference-card"><div className="reference-title"><span className="reference-icon"><Sparkles size={22}/></span><h2>Common Symptoms</h2></div>
              {topSymptoms[0]?.name === 'No Data' ? <div className="reference-common-empty"><ReferenceArt kind="clipboard"/><h3>No Data Yet</h3><p>Log your symptoms to see your most common symptoms over time.</p></div> : (              <div className="flex flex-col gap-5">
                {topSymptoms.map((s) => (
                  <div key={s.name} className="flex flex-col gap-2">
                    <div className="flex justify-between text-sm font-semibold">
                      <span className="capitalize text-gray-700 dark:text-gray-300"><span className="symptom-emoji" aria-hidden="true">{symptomSymbol(s.name)}</span> {s.name}</span>
                      <span className="text-gray-400">{s.level}</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-gray-100 dark:bg-white/5">
                      <div className={`h-full rounded-full ${s.color}`} style={{ width: s.width }}></div>
                    </div>
                  </div>
                ))}
              </div>
)}
            </section>

            <DailyGuidance phase={cycleData.phase} cycleDay={cycleData.currentDay} logs={logs} today={todayStr}/>
            <section className="reference-card reference-report"><button onClick={() => setShowTodayReport(true)} className="reference-button"><CalendarDays size={20}/>Generate Today’s Report Card <ArrowRight size={18}/></button><p>Creates a shareable card of today’s symptoms and cycle status.</p></section>

          </motion.main>
        ) : activeTab === 'cycle' ? (
          <motion.main key="cycle" initial={reduced ? false : { x: 12 }} animate={{ x: 0 }} transition={motionTransition(springs.section,reduced)} className="reference-stack">            <section className="relative overflow-hidden rounded-[2rem] bg-white dark:bg-surface-dark p-6 shadow-soft border border-gray-100 dark:border-white/5 transition-colors">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Prediction</p>
                  <h2 className="text-2xl font-bold text-[var(--text-primary)] dark:text-white mb-1">{cycleData.hasEstimate===false?'Prediction unavailable':cycleData.nextPeriodIn < 0 ? `Period estimate passed by ${Math.abs(cycleData.nextPeriodIn)} days` : `Period in ${cycleData.nextPeriodIn} days`}</h2>
                  <p className="text-sm text-gray-400">based on {cycleSettings.avgCycleLength}d cycle</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-pink-100 dark:bg-pink-500/20 text-primary">
                  <span className="app-icon-glyph text-2xl"><AppIcon name={"water_drop"}/></span>
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
                  <span className="app-icon-glyph text-2xl"><AppIcon name={"refresh"}/></span>
                </div>
                <h3 className="text-3xl font-bold text-[var(--text-primary)] dark:text-white">{stats.avgCycle}</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest max-w-[80px]">Typical Cycle Length</p>
              </div>
              <div className="flex flex-col items-center justify-center gap-3 rounded-[2rem] bg-white dark:bg-surface-dark p-6 shadow-soft border border-gray-100 dark:border-white/5 text-center h-48 transition-colors">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400">
                  <span className="app-icon-glyph text-2xl"><AppIcon name={"bar_chart"}/></span>
                </div>
                <h3 className="text-3xl font-bold text-[var(--text-primary)] dark:text-white">{stats.avgPeriod}</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest max-w-[80px]">Avg Logged Flow Days</p>
              </div>
            </section>

            <section className="rounded-[2rem] bg-white dark:bg-surface-dark p-6 shadow-soft border border-gray-100 dark:border-white/5 transition-colors">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-lg font-bold text-[var(--text-primary)] dark:text-white">Cycle History</h3>
                  <p className="text-sm text-gray-400">Length variation over time</p>
                </div>
                <div className="flex items-center bg-white/5 rounded-xl p-1 gap-1 relative">
                  <div className="absolute inset-0 p-1 pointer-events-none">
                    <div className={`h-full w-1/2 rounded-lg bg-primary shadow-sm transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] ${chartType === 'line' ? 'translate-x-full' : 'translate-x-0'}`}></div>
                  </div>
                  <button aria-label="Show bar chart" onClick={() => setChartType('bar')} className={`relative z-10 flex-1 p-2 rounded-lg transition-colors duration-300 ${chartType === 'bar' ? 'on-brand text-white' : 'text-gray-400 hover:text-white'}`}>
                    <span className="app-icon-glyph text-lg block text-center"><AppIcon name={"bar_chart"}/></span>
                  </button>
                  <button aria-label="Show line chart" onClick={() => setChartType('line')} className={`relative z-10 flex-1 p-2 rounded-lg transition-colors duration-300 ${chartType === 'line' ? 'on-brand text-white' : 'text-gray-400 hover:text-white'}`}>
                    <span className="app-icon-glyph text-lg block text-center"><AppIcon name={"show_chart"}/></span>
                  </button>
                </div>
              </div>

              <div className={historyData.length > 0 ? "relative h-48 mt-4 w-full" : "relative  mt-4 w-full"}>
                {historyData.length > 0 ? (<ResponsiveContainer width="100%" height="100%">
                  {chartType === 'bar' ? (
                    <BarChart data={historyData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }} barCategoryGap="20%">
                      <XAxis dataKey="date" hide/><YAxis hide domain={['dataMin - 5', 'dataMax + 5']} />
                      <ReferenceLine y={stats.avgCycle} stroke={theme === 'dark' ? 'rgba(255,255,255,0.2)' : '#E5E7EB'} strokeDasharray="3 3" />
                      <Tooltip cursor={false} content={<MetricTooltip metric="cycle"/>}/>
                      <Bar isAnimationActive={animateCharts} dataKey="value" radius={[8, 8, 0, 0]} animationDuration={350} animationEasing="ease-out" maxBarSize={40}>
                        {historyData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index >= historyData.length - 1 ? 'var(--color-primary)' : (theme === 'dark' ? '#ffffff1a' : '#E5E7EB')} />
                        ))}
                      </Bar>
                    </BarChart>
                  ) : (
                    <AreaChart data={historyData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorHistory" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#984369" stopOpacity={0.6} /><stop offset="95%" stopColor="#984369" stopOpacity={0} /></linearGradient>
                      </defs>
                      <XAxis dataKey="date" hide/><YAxis hide domain={['dataMin - 5', 'dataMax + 5']} />
                      <Tooltip cursor={false} content={<MetricTooltip metric="cycle"/>}/>
                      <Area isAnimationActive={animateCharts} type="monotone" dataKey="value" stroke="var(--color-primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorHistory)" dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
                    </AreaChart>
                  )}
                </ResponsiveContainer>) : <ChartEmptyState onLog={() => navigate('/log/details')} />}
              </div>
            </section>

</motion.main>
        ) : (
          <motion.main
            key="trends"
            initial={reduced ? false : { x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={motionTransition(springs.section, reduced)}
            className="reference-stack"
          >
            <SegmentedControl<'sleep'|'energy'> label="Trend view" value={trendsSubTab} onChange={setTrendsSubTab} options={[{value:'sleep',label:'Sleep',icon:'bedtime'},{value:'energy',label:'Energy',icon:'bolt'}]}/>

            <React.Fragment>
              {trendsSubTab === 'sleep' ? (
                <motion.div
                  key="sleep-trends"
                  initial={reduced ? false : { y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={motionTransition(springs.section, reduced)}
                  className="flex flex-col gap-6"
                >
                  {/* Sleep Summary Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-indigo-500/10 dark:bg-indigo-500/20 p-5 rounded-[2rem] border border-indigo-500/20 dark:border-indigo-500/30 transition-colors backdrop-blur-sm">
                      <p className="text-[10px] uppercase font-bold text-indigo-500 mb-1 tracking-wider">Avg Quality</p>
                      <h4 className="text-xl font-bold text-[var(--text-primary)] dark:text-white">{sleepStats?.avgLabel || '--'}</h4>
                    </div>
                    <div className="bg-rose-500/10 dark:bg-rose-500/20 p-5 rounded-[2rem] border border-rose-500/20 dark:border-rose-500/30 transition-colors backdrop-blur-sm">
                      <p className="text-[10px] uppercase font-bold text-rose-500 mb-1 tracking-wider">Good nights</p>
                      <h4 className="text-xl font-bold text-[var(--text-primary)] dark:text-white">{sleepStats ? Math.round(((sleepStats.distribution.find(d => d.name === 'Good')?.value || 0) / sleepStats.count) * 100) : 0}%</h4>
                    </div>
                  </div>

                  {/* Sleep Chart Card */}
                  <section className="rounded-[2.5rem] bg-white dark:bg-surface-dark p-8 shadow-soft border border-gray-100 dark:border-white/5 transition-colors">
                    <div className="flex items-center justify-between mb-8">
                      <div>
                        <h3 className="text-xl font-bold text-[var(--text-primary)] dark:text-white">Sleep Timeline</h3>
                        <p className="text-sm text-gray-400">Quality over the last 30 days</p>
                      </div>
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500">
                        <span className="app-icon-glyph text-2xl"><AppIcon name={"bedtime"}/></span>
                      </div>
                    </div>

                    <div className={trendsData.some(d => d.sleep !== null) ? "h-56 w-full" : "w-full"}>
                      {trendsData.some(d => d.sleep !== null) ? (<ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trendsData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorSleep" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} /><stop offset="95%" stopColor="#6366f1" stopOpacity={0} /></linearGradient>
                          </defs>
                          <XAxis dataKey="date" hide/><YAxis hide domain={[0, 4]} />
                           <Tooltip cursor={false} content={<MetricTooltip metric="sleep"/>}/>
                          <Area isAnimationActive={animateCharts}
                            type="monotone"
                            dataKey="sleep"
                            stroke="#6366f1"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorSleep)"
                            animationDuration={350}
                            dot={false} activeDot={{ r: 5, strokeWidth: 0 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>) : <ChartEmptyState onLog={() => navigate('/log/details')} />}
                    </div>
                  </section>

                  {/* Sleep Distribution Card */}
                  <section className="rounded-[2.5rem] bg-white dark:bg-surface-dark p-8 shadow-soft border border-gray-100 dark:border-white/5 transition-colors">
                    <h3 className="text-xl font-bold text-[var(--text-primary)] dark:text-white mb-2">Quality Split</h3>
                    <p className="text-sm text-gray-400 mb-6">Distribution of reported nights</p>

                    <div className={!!sleepStats ? "flex items-center justify-center h-48" : "flex items-center justify-center"}>
                      {!!sleepStats ? (<ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie isAnimationActive={animateCharts}
                            data={sleepStats?.distribution || []}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={3}
                            cornerRadius={8}
                            stroke="none"
                            dataKey="value"
                            animationDuration={350}
                          >
                            {(sleepStats?.distribution || []).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip content={<DistributionTooltip startDate={sleepStats?.startDate} endDate={sleepStats?.endDate} total={sleepStats?.count || 0} unit="nights"/>}/>
                          <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" />
                        </PieChart>
                      </ResponsiveContainer>) : <ChartEmptyState onLog={() => navigate('/log/details')} />}
                    </div>
                  </section>
                </motion.div>
              ) : (
                <motion.div
                  key="energy-trends"
                  initial={reduced ? false : { y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={motionTransition(springs.section, reduced)}
                  className="flex flex-col gap-6"
                >
                  {/* Energy Summary Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-amber-500/10 dark:bg-amber-500/20 p-5 rounded-[2rem] border border-amber-500/20 dark:border-amber-500/30 transition-colors backdrop-blur-sm">
                      <p className="text-[10px] uppercase font-bold text-amber-500 mb-1 tracking-wider">Avg Level</p>
                      <h4 className="text-xl font-bold text-[var(--text-primary)] dark:text-white">{energyStats?.avgLabel || '--'}</h4>
                    </div>
                    <div className="bg-teal-500/10 dark:bg-teal-500/20 p-5 rounded-[2rem] border border-teal-500/20 dark:border-teal-500/30 transition-colors backdrop-blur-sm">
                      <p className="text-[10px] uppercase font-bold text-teal-500 mb-1 tracking-wider">Days logged</p>
                      <h4 className="text-xl font-bold text-[var(--text-primary)] dark:text-white">{energyStats?.count || 0}d</h4>
                    </div>
                  </div>

                  {/* Energy Chart Card */}
                  <section className="rounded-[2.5rem] bg-white dark:bg-surface-dark p-8 shadow-soft border border-gray-100 dark:border-white/5 transition-colors">
                    <div className="flex items-center justify-between mb-8">
                      <div>
                        <h3 className="text-xl font-bold text-[var(--text-primary)] dark:text-white">Energy Flow</h3>
                        <p className="text-sm text-gray-400">Vitality patterns recently</p>
                      </div>
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
                        <span className="app-icon-glyph text-2xl"><AppIcon name={"bolt"}/></span>
                      </div>
                    </div>

                    <div className={trendsData.some(d => d.energy !== null) ? "h-56 w-full" : "w-full"}>
                      {trendsData.some(d => d.energy !== null) ? (<ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trendsData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorEnergy" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} /><stop offset="95%" stopColor="#f59e0b" stopOpacity={0} /></linearGradient>
                          </defs>
                          <XAxis dataKey="date" hide/><YAxis hide domain={[0, 4]} />
                          <Tooltip cursor={false} content={<MetricTooltip metric="energy"/>}/>
                          <Area isAnimationActive={animateCharts}
                            type="monotone"
                            dataKey="energy"
                            stroke="#f59e0b"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorEnergy)"
                            animationDuration={350}
                            dot={false} activeDot={{ r: 5, strokeWidth: 0 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>) : <ChartEmptyState onLog={() => navigate('/log/details')} />}
                    </div>
                  </section>

                  {/* Energy Distribution Card */}
                  <section className="rounded-[2.5rem] bg-white dark:bg-surface-dark p-8 shadow-soft border border-gray-100 dark:border-white/5 transition-colors">
                    <h3 className="text-xl font-bold text-[var(--text-primary)] dark:text-white mb-2">Energy Split</h3>
                    <p className="text-sm text-gray-400 mb-6">Proportion of energy levels reported</p>

                    <div className={!!energyStats ? "flex items-center justify-center h-48" : "flex items-center justify-center"}>
                      {!!energyStats ? (<ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie isAnimationActive={animateCharts}
                            data={energyStats?.distribution || []}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={3}
                            cornerRadius={8}
                            stroke="none"
                            dataKey="value"
                            animationDuration={350}
                          >
                            {(energyStats?.distribution || []).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip content={<DistributionTooltip startDate={energyStats?.startDate} endDate={energyStats?.endDate} total={energyStats?.count || 0} unit="days"/>}/>
                          <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" />
                        </PieChart>
                      </ResponsiveContainer>) : <ChartEmptyState onLog={() => navigate('/log/details')} />}
                    </div>
                  </section>
                </motion.div>
              )}
            </React.Fragment>

            {correlations?.insights && (
              <section className="rounded-[2rem] bg-primary/5 dark:bg-primary/10 p-6 border border-primary/10 mb-20 shadow-sm">
                <h3 className="text-lg font-bold text-primary mb-4 flex items-center gap-2">
                  <span className="app-icon-glyph"><AppIcon name={"analytics"}/></span>
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
      </React.Fragment>

      <TodayReportModal
        isOpen={showTodayReport}
        onClose={() => setShowTodayReport(false)}
        todayLog={todayLog}
        cycleSettings={cycleSettings}
        profile={profile}
      />

      <AnimatePresence>
        {showShareModal && (
          <MotionPortal><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6" onClick={() => setShowShareModal(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white dark:bg-surface-dark rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-gray-100 dark:border-white/10" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center"><span className="app-icon-glyph text-primary"><AppIcon name={"share"}/></span></div>
                  <h3 className="text-lg font-bold text-[var(--text-primary)] dark:text-white">Share Your Card</h3>
                </div>
                <button onClick={() => setShowShareModal(false)} className="w-8 h-8 rounded-full hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center"><span className="app-icon-glyph text-gray-400"><AppIcon name={"close"}/></span></button>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Anyone with this link can view your card for 24 hours. Creating a new link replaces the previous one.</p>
              <div className="flex items-center gap-2 bg-gray-100 dark:bg-white/5 rounded-xl p-3 border border-gray-200 dark:border-white/10">
                <input type="text" value={shareUrl} readOnly className="flex-1 bg-transparent text-sm text-[var(--text-primary)] dark:text-white truncate outline-none" />
                <button onClick={handleCopyLink} className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all ${copied ? 'on-brand bg-green-500 text-white' : 'bg-primary hover:bg-primary/90 text-white'}`}><span className="app-icon-glyph text-lg"><AppIcon name={copied ? 'check' : 'content_copy'}/></span></button>
              </div>
              {copied && <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-center text-sm text-green-500 font-medium mt-3">Link copied to clipboard!</motion.p>}
              <div className="mt-6 pt-4 border-t border-gray-100 dark:border-white/5"><button onClick={() => setShowShareModal(false)} className="on-brand w-full py-3 rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold transition-colors">Done</button></div>
            </motion.div>
          </motion.div></MotionPortal>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Insights;
