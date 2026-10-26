import ChartEmptyState from './ui/ChartEmptyState';
import { useTheme } from '../contexts/ThemeContext';
import React, { useState, useMemo } from 'react';
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
  ReferenceLine,
  PieChart,
  Pie,
  Legend
} from 'recharts';

interface PartnerInsightsViewProps {
  logs: any[];
  cycleSettings: any;
  theme: string;
}

const getMoodEmoji = (mood: string) => {
  const m = mood.toLowerCase();
  if (m.includes('happy') || m.includes('great')) return '😊';
  if (m.includes('energetic') || m.includes('productive')) return '🤩';
  if (m.includes('sad') || m.includes('down')) return '😔';
  if (m.includes('anxious') || m.includes('stressed')) return '😰';
  if (m.includes('irritated') || m.includes('angry')) return '😠';
  if (m.includes('calm') || m.includes('relaxed')) return '😌';
  return '😐';
};

const PartnerInsightsView: React.FC<PartnerInsightsViewProps> = ({ logs, cycleSettings, theme }) => {
  const { animationsEnabled } = useTheme();
  const reducedMotion = useReducedMotion();
  const animateCharts = animationsEnabled !== false && !reducedMotion;
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');
  const [activeTab, setActiveTab] = useState<'history' | 'trends'>('history');
  const [historyTab, setHistoryTab] = useState<'general' | 'logs'>('general');
  const [logViewMode, setLogViewMode] = useState<'card' | 'list'>('card');
  const [trendsSubTab, setTrendsSubTab] = useState<'sleep' | 'energy'>('sleep');
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

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
      textTransform: 'uppercase',
      fontWeight: '700',
      letterSpacing: '0.05em'
    }
  }), [theme]);

  // 1. Calculate History & Real Averages
  const { historyData, stats } = useMemo(() => {
    if (!logs?.length) return {
      historyData: [],
      stats: { avgCycle: cycleSettings?.avgCycleLength || 28, avgPeriod: cycleSettings?.avgPeriodLength || 5 }
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
    const calculatedAvgPeriod = periods.length ? Math.round(totalPeriodLength / periods.length) : (cycleSettings?.avgPeriodLength || 5);
    const totalCycleLength = cycleLengths.reduce((sum, c) => sum + c.value, 0);
    const calculatedAvgCycle = cycleLengths.length ? Math.round(totalCycleLength / cycleLengths.length) : (cycleSettings?.avgCycleLength || 28);
    const finalHistory = cycleLengths.slice(-6);

    return {
      historyData: finalHistory,
      stats: { avgCycle: calculatedAvgCycle, avgPeriod: calculatedAvgPeriod }
    };
  }, [logs, cycleSettings]);

  // 2. Calculate Top Symptoms
  const topSymptoms = useMemo(() => {
    if (!logs?.length) return [{ name: 'No Data', level: '-', width: '0%', color: 'bg-gray-200' }];
    const counts: Record<string, number> = {};
    logs.forEach(log => {
      log.symptoms?.forEach((sym: string) => {
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
  const trendsData = useMemo(() => {
    if (!logs?.length) return [];
    const sortedLogs = [...logs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const last30Logs = sortedLogs.slice(-30);
    const sleepMap: Record<string, number> = { 'good': 3, 'fair': 2, 'poor': 1 };
    const energyMap: Record<string, number> = { 'high': 3, 'medium': 2, 'low': 1 };

    return last30Logs.map(log => {
      const sleepRaw = log.sleepQuality || log.sleep_quality;
      const energyRaw = log.energyLevel || log.energy_level;
      return {
        date: new Date(log.date).toLocaleDateString('default', { month: 'short', day: 'numeric' }),
        sleep: sleepMap[sleepRaw as string] || null,
        energy: energyMap[energyRaw as string] || null
      };
    }).filter(d => d.sleep !== null || d.energy !== null);
  }, [logs]);

  const sleepStats = useMemo(() => {
    if (!logs?.length) return null;
    const sleepLogs = logs.filter(l => l.sleepQuality || l.sleep_quality);
    if (!sleepLogs.length) return null;

    const distribution = [
      { name: 'Good', value: sleepLogs.filter(l => (l.sleepQuality || l.sleep_quality) === 'good').length, color: '#6366f1' },
      { name: 'Fair', value: sleepLogs.filter(l => (l.sleepQuality || l.sleep_quality) === 'fair').length, color: '#a5b4fc' },
      { name: 'Poor', value: sleepLogs.filter(l => (l.sleepQuality || l.sleep_quality) === 'poor').length, color: '#e0e7ff' }
    ].filter(d => d.value > 0);

    const scores = sleepLogs.map(l => {
      const q = l.sleepQuality || l.sleep_quality;
      return q === 'good' ? 3 : q === 'fair' ? 2 : 1;
    });
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const avgLabel = avgScore > 2.5 ? 'Good' : avgScore > 1.5 ? 'Fair' : 'Poor';

    return { distribution, avgLabel, count: sleepLogs.length };
  }, [logs]);

  const energyStats = useMemo(() => {
    if (!logs?.length) return null;
    const energyLogs = logs.filter(l => l.energyLevel || l.energy_level);
    if (!energyLogs.length) return null;

    const distribution = [
      { name: 'High', value: energyLogs.filter(l => (l.energyLevel || l.energy_level) === 'high').length, color: '#f59e0b' },
      { name: 'Medium', value: energyLogs.filter(l => (l.energyLevel || l.energy_level) === 'medium').length, color: '#fbbf24' },
      { name: 'Low', value: energyLogs.filter(l => (l.energyLevel || l.energy_level) === 'low').length, color: '#fef3c7' }
    ].filter(d => d.value > 0);

    const scores = energyLogs.map(l => {
      const e = l.energyLevel || l.energy_level;
      return e === 'high' ? 3 : e === 'medium' ? 2 : 1;
    });
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const avgLabel = avgScore > 2.5 ? 'High' : avgScore > 1.5 ? 'Medium' : 'Low';

    return { distribution, avgLabel, count: energyLogs.length };
  }, [logs]);

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Tab Switcher (Styled like Insights.tsx) */}
      <div className="flex bg-gray-100/50 dark:bg-white/5 p-1 rounded-2xl w-full mb-2 relative">
        <button
          onClick={() => setActiveTab('history')}
          className={`relative z-10 flex-1 flex h-10 items-center justify-center rounded-xl text-sm font-bold transition-all ${
            activeTab === 'history'
              ? 'on-brand text-white'
              : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
          }`}
        >
          {activeTab === 'history' && (
            <motion.div
              layoutId="activePartnerInsightsTab"
              className="absolute inset-0 bg-primary rounded-xl shadow-md"
              transition={{ type: 'spring', bounce: 0.2, duration: 0.28 }}
            />
          )}
          <span className="relative z-20">History</span>
        </button>
        <button
          onClick={() => setActiveTab('trends')}
          className={`relative z-10 flex-1 flex h-10 items-center justify-center rounded-xl text-sm font-bold transition-all ${
            activeTab === 'trends'
              ? 'on-brand text-white'
              : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
          }`}
        >
          {activeTab === 'trends' && (
            <motion.div
              layoutId="activePartnerInsightsTab"
              className="absolute inset-0 bg-primary rounded-xl shadow-md"
              transition={{ type: 'spring', bounce: 0.2, duration: 0.28 }}
            />
          )}
          <span className="relative z-20">Trends</span>
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'history' ? (
          <motion.div
            key="history"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col gap-6"
          >
             {/* History Sub-tabs */}
             <div className="flex justify-center mb-2">
                <div className="flex bg-gray-100/50 dark:bg-white/5 p-1 rounded-xl relative">
                  <button
                   onClick={() => setHistoryTab('general')}
                   className={`relative z-10 px-6 py-1.5 rounded-lg text-xs font-bold transition-all ${
                     historyTab === 'general' ? 'text-primary' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
                   }`}
                  >
                    {historyTab === 'general' && (
                      <motion.div
                        layoutId="activePartnerHistoryTab"
                        className="absolute inset-0 bg-white dark:bg-white/10 rounded-lg shadow-sm"
                        transition={{ type: 'spring', bounce: 0.2, duration: 0.28 }}
                      />
                    )}
                    <span className="relative z-20">General Info</span>
                  </button>
                  <button
                   onClick={() => setHistoryTab('logs')}
                   className={`relative z-10 px-6 py-1.5 rounded-lg text-xs font-bold transition-all ${
                     historyTab === 'logs' ? 'text-primary' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
                   }`}
                  >
                    {historyTab === 'logs' && (
                      <motion.div
                        layoutId="activePartnerHistoryTab"
                        className="absolute inset-0 bg-white dark:bg-white/10 rounded-lg shadow-sm"
                        transition={{ type: 'spring', bounce: 0.2, duration: 0.28 }}
                      />
                    )}
                    <span className="relative z-20">Log History</span>
                  </button>
                </div>
             </div>

            <AnimatePresence mode="wait">
              {historyTab === 'general' ? (
                <motion.div
                  key="general-info"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="flex flex-col gap-6"
                >
                  {/* Stats Cards */}
                  <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex flex-col items-center justify-center gap-3 rounded-[2rem] bg-white dark:bg-surface-dark p-6 shadow-soft border border-gray-100 dark:border-white/5 text-center h-44 transition-colors md:col-span-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400">
                        <span className="material-symbols-outlined text-xl">refresh</span>
                      </div>
                      <h3 className="text-2xl font-bold text-[var(--text-primary)] dark:text-white">{stats.avgCycle}</h3>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Avg Cycle</p>
                    </div>
                    <div className="flex flex-col items-center justify-center gap-3 rounded-[2rem] bg-white dark:bg-surface-dark p-6 shadow-soft border border-gray-100 dark:border-white/5 text-center h-44 transition-colors md:col-span-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400">
                        <span className="material-symbols-outlined text-xl">bar_chart</span>
                      </div>
                      <h3 className="text-2xl font-bold text-[var(--text-primary)] dark:text-white">{stats.avgPeriod}</h3>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Avg Period</p>
                    </div>
                  </section>

                  <div className="md:grid md:grid-cols-2 md:gap-6 flex flex-col gap-6">
                      {/* Cycle History Chart */}
                      <section className="rounded-[2rem] bg-white dark:bg-surface-dark p-6 shadow-soft border border-gray-100 dark:border-white/5 transition-colors h-full flex flex-col">
                        <div className="flex items-center justify-between mb-8">
                          <div>
                            <h3 className="text-lg font-bold text-[var(--text-primary)] dark:text-white">Cycle History</h3>
                            <p className="text-sm text-gray-400">Variation over time</p>
                          </div>
                          <div className="flex items-center bg-gray-100 dark:bg-white/5 rounded-xl p-1 gap-1 relative">
                            <button aria-label="Show bar chart" onClick={() => setChartType('bar')} className={`relative z-10 p-2 rounded-lg transition-colors ${chartType === 'bar' ? 'on-brand bg-primary text-white' : 'text-gray-400'}`}>
                              <span className="material-symbols-outlined text-lg block">bar_chart</span>
                            </button>
                            <button aria-label="Show line chart" onClick={() => setChartType('line')} className={`relative z-10 p-2 rounded-lg transition-colors ${chartType === 'line' ? 'on-brand bg-primary text-white' : 'text-gray-400'}`}>
                              <span className="material-symbols-outlined text-lg block">show_chart</span>
                            </button>
                          </div>
                        </div>

                        <div className={historyData.length > 0 ? "relative h-48 md:h-64 w-full mt-2" : "relative  md:h-64 w-full mt-2"}>
                          {historyData.length > 0 ? (<ResponsiveContainer width="100%" height="100%">
                            {chartType === 'bar' ? (
                              <BarChart data={historyData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                                <YAxis hide domain={['dataMin - 5', 'dataMax + 5']} />
                                <ReferenceLine y={stats.avgCycle} stroke={theme === 'dark' ? 'rgba(255,255,255,0.2)' : '#E5E7EB'} strokeDasharray="3 3" />
                                <Tooltip
                                  cursor={{ fill: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
                                  contentStyle={tooltipStyles.contentStyle}
                                  itemStyle={tooltipStyles.itemStyle}
                                  labelStyle={tooltipStyles.labelStyle}
                                />
                                <Bar isAnimationActive={animateCharts} dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={40}>
                                  {historyData.map((_entry, index) => (
                                    <Cell key={`cell-${index}`} fill={index >= historyData.length - 1 ? '#984369' : (theme === 'dark' ? '#ffffff1a' : '#E5E7EB')} />
                                  ))}
                                </Bar>
                              </BarChart>
                            ) : (
                              <AreaChart data={historyData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                                <defs>
                                  <linearGradient id="colorHistoryP" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#984369" stopOpacity={0.6} /><stop offset="95%" stopColor="#984369" stopOpacity={0} /></linearGradient>
                                </defs>
                                <YAxis hide domain={['dataMin - 5', 'dataMax + 5']} />
                                <Tooltip
                                  contentStyle={tooltipStyles.contentStyle}
                                  itemStyle={tooltipStyles.itemStyle}
                                  labelStyle={tooltipStyles.labelStyle}
                                />
                                <Area isAnimationActive={animateCharts} type="monotone" dataKey="value" stroke="#984369" strokeWidth={3} fillOpacity={1} fill="url(#colorHistoryP)" dot={{ r: 4, fill: "#984369" }} activeDot={{ r: 6 }} />
                              </AreaChart>
                            )}
                          </ResponsiveContainer>) : <ChartEmptyState message="Your partner’s shared check-ins will appear here as they log them." />}
                        </div>
                      </section>

                      {/* Symptoms Card */}
                      <section className="rounded-[2rem] bg-white dark:bg-surface-dark p-6 shadow-soft border border-gray-100 dark:border-white/5 transition-colors h-full flex flex-col justify-center">
                        <h3 className="text-lg font-bold text-[var(--text-primary)] dark:text-white mb-6 flex items-center gap-2">
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
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="log-history"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="flex flex-col gap-4"
                >
                  <div className="flex items-center justify-between px-2">
                    <h3 className="text-lg font-bold text-[var(--text-primary)] dark:text-white">Log History</h3>
                    <div className="flex items-center bg-gray-100 dark:bg-white/5 rounded-xl p-1 gap-1 relative">
                      <button
                        onClick={() => setLogViewMode('card')}
                        className={`relative z-10 p-1.5 rounded-lg transition-all ${logViewMode === 'card' ? 'text-primary' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}
                      >
                        {logViewMode === 'card' && (
                          <motion.div
                            layoutId="logViewToggle"
                            className="absolute inset-0 bg-white dark:bg-white/10 rounded-lg shadow-sm"
                            transition={{ type: 'spring', bounce: 0.2, duration: 0.28 }}
                          />
                        )}
                        <span className="material-symbols-outlined text-sm block relative z-20">grid_view</span>
                      </button>
                      <button
                        onClick={() => setLogViewMode('list')}
                        className={`relative z-10 p-1.5 rounded-lg transition-all ${logViewMode === 'list' ? 'text-primary' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}
                      >
                        {logViewMode === 'list' && (
                          <motion.div
                            layoutId="logViewToggle"
                            className="absolute inset-0 bg-white dark:bg-white/10 rounded-lg shadow-sm"
                            transition={{ type: 'spring', bounce: 0.2, duration: 0.28 }}
                          />
                        )}
                        <span className="material-symbols-outlined text-sm block relative z-20">view_list</span>
                      </button>
                    </div>
                  </div>

                  {logs && logs.length > 0 ? (
                    <div className={logViewMode === 'card' ? "grid grid-cols-2 sm:grid-cols-3 gap-3" : "flex flex-col gap-3"}>
                      {[...logs].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((log) => (
                        logViewMode === 'card' ? (
                          <div
                            key={log.id}
                            onClick={() => setSelectedLog(log)}
                            className="bg-white dark:bg-surface-dark p-4 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-soft flex flex-col gap-4 transition-colors relative cursor-pointer hover:border-primary/30 dark:hover:border-primary/50"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex flex-col items-center justify-center bg-gray-100 dark:bg-white/5 w-12 h-14 rounded-2xl">
                                <span className="text-[10px] uppercase font-bold text-gray-400">
                                  {new Date(log.date).toLocaleDateString('default', { month: 'short' })}
                                </span>
                                <span className="text-lg font-bold text-[var(--text-primary)] dark:text-white">
                                  {new Date(log.date).getDate()}
                                </span>
                              </div>
                              <span className="material-symbols-outlined text-gray-300 text-lg">north_east</span>
                            </div>

                            <div className="flex flex-col gap-1.5">
                              {log.flow && (
                                <span className="px-2 py-0.5 bg-pink-500/10 text-pink-500 text-[10px] font-bold rounded-lg uppercase self-start">
                                  {log.flow} Flow
                                </span>
                              )}
                              <div className="flex items-center gap-1">
                                <span className="text-xs">{getMoodEmoji(log.moods?.[0] || '')}</span>
                                <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 capitalize">
                                  {log.moods?.[0] || 'No Mood'}
                                </span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div
                            key={log.id}
                            onClick={() => setSelectedLog(log)}
                            className="bg-white dark:bg-surface-dark p-4 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-soft flex items-center justify-between transition-colors cursor-pointer hover:border-primary/30 dark:hover:border-primary/50"
                          >
                            <div className="flex items-center gap-4">
                              <div className="flex flex-col items-center justify-center bg-gray-100 dark:bg-white/5 w-12 h-14 rounded-2xl">
                                <span className="text-[10px] uppercase font-bold text-gray-400">
                                  {new Date(log.date).toLocaleDateString('default', { month: 'short' })}
                                </span>
                                <span className="text-lg font-bold text-[var(--text-primary)] dark:text-white">
                                  {new Date(log.date).getDate()}
                                </span>
                              </div>

                              <div className="flex flex-col gap-1.5">
                                {log.flow && (
                                  <span className="px-2 py-0.5 bg-pink-500/10 text-pink-500 text-[10px] font-bold rounded-lg uppercase self-start">
                                    {log.flow} Flow
                                  </span>
                                )}
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs">{getMoodEmoji(log.moods?.[0] || '')}</span>
                                    <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 capitalize">
                                      {log.moods?.[0] || 'No Mood'}
                                    </span>
                                  </div>
                                  <span className="text-gray-300 dark:text-gray-600">•</span>
                                  <span className="text-[11px] text-gray-400">
                                    {log.symptoms?.length || 0} symptoms
                                  </span>
                                </div>
                              </div>
                            </div>

                            <span className="material-symbols-outlined text-gray-300">chevron_right</span>
                          </div>
                        )
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-10 bg-white/5 rounded-[2rem] border border-dashed border-white/5">
                      <p className="text-gray-500 text-sm">No log history yet.</p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ) : (
          <motion.div
            key="trends"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex flex-col gap-6"
          >
             {/* Trends Sub-tabs */}
             <div className="flex justify-center mb-2">
                <div className="flex bg-gray-100/50 dark:bg-white/5 p-1 rounded-xl relative">
                  <button
                   onClick={() => setTrendsSubTab('sleep')}
                   className={`relative z-10 px-6 py-1.5 rounded-lg text-xs font-bold transition-all ${
                     trendsSubTab === 'sleep' ? 'text-primary' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
                   }`}
                  >
                    {trendsSubTab === 'sleep' && (
                      <motion.div
                        layoutId="activePartnerTrendsTab"
                        className="absolute inset-0 bg-white dark:bg-white/10 rounded-lg shadow-sm"
                        transition={{ type: 'spring', bounce: 0.2, duration: 0.28 }}
                      />
                    )}
                    <span className="relative z-20">Sleep</span>
                  </button>
                  <button
                   onClick={() => setTrendsSubTab('energy')}
                   className={`relative z-10 px-6 py-1.5 rounded-lg text-xs font-bold transition-all ${
                     trendsSubTab === 'energy' ? 'text-primary' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
                   }`}
                  >
                    {trendsSubTab === 'energy' && (
                      <motion.div
                        layoutId="activePartnerTrendsTab"
                        className="absolute inset-0 bg-white dark:bg-white/10 rounded-lg shadow-sm"
                        transition={{ type: 'spring', bounce: 0.2, duration: 0.28 }}
                      />
                    )}
                    <span className="relative z-20">Energy</span>
                  </button>
                </div>
             </div>

            <AnimatePresence mode="wait">
              {trendsSubTab === 'sleep' ? (
                 <motion.div
                  key="sleep-trends"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="flex flex-col gap-6"
                >
                   <div className="md:grid md:grid-cols-[1fr_2.5fr] md:gap-6 flex flex-col gap-6">
                       {/* Summary Cards */}
                       <div className="grid grid-cols-2 md:grid-cols-1 md:grid-rows-2 gap-4 h-full">
                        <div className="bg-indigo-500/10 dark:bg-indigo-500/20 p-5 rounded-[2rem] border border-indigo-500/20 shadow-sm flex flex-col justify-center h-full">
                          <p className="text-[10px] uppercase font-bold text-indigo-500 mb-1 tracking-wider">Avg Quality</p>
                          <h4 className="text-xl font-bold text-[var(--text-primary)] dark:text-white">{sleepStats?.avgLabel || '--'}</h4>
                        </div>
                        <div className="bg-rose-500/10 dark:bg-rose-500/20 p-5 rounded-[2rem] border border-rose-500/20 shadow-sm flex flex-col justify-center h-full">
                          <p className="text-[10px] uppercase font-bold text-rose-500 mb-1 tracking-wider">Consistency</p>
                          <h4 className="text-xl font-bold text-[var(--text-primary)] dark:text-white">{sleepStats ? Math.round((sleepStats.distribution[0]?.value / sleepStats.count) * 100) : 0}%</h4>
                        </div>
                      </div>

                      <section className="rounded-[2.5rem] bg-white dark:bg-surface-dark p-6 shadow-soft border border-gray-100 dark:border-white/5 transition-colors h-full flex flex-col min-w-0">
                        <div className="flex items-center justify-between mb-8">
                           <h3 className="text-lg font-bold text-[var(--text-primary)] dark:text-white">Sleep Timeline</h3>
                           <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
                            <span className="material-symbols-outlined">bedtime</span>
                          </div>
                        </div>
                        <div className={trendsData.some(d => d.sleep !== null) ? "relative h-48 md:h-64 w-full mt-2" : "relative  md:h-64 w-full mt-2"}>
                          {trendsData.some(d => d.sleep !== null) ? (<ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trendsData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                              <defs>
                                <linearGradient id="colorSleepP" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} /><stop offset="95%" stopColor="#6366f1" stopOpacity={0} /></linearGradient>
                              </defs>
                              <YAxis hide domain={[0, 4]} />
                               <Tooltip
                                contentStyle={tooltipStyles.contentStyle}
                                itemStyle={tooltipStyles.itemStyle}
                                labelStyle={tooltipStyles.labelStyle}
                                formatter={(value: any) => [value === 3 ? 'Good' : value === 2 ? 'Fair' : 'Poor', 'Quality']}
                              />
                              <Area isAnimationActive={animateCharts}
                                type="monotone"
                                dataKey="sleep"
                                stroke="#6366f1"
                                strokeWidth={4}
                                fillOpacity={1}
                                fill="url(#colorSleepP)"
                                dot={{ r: 3, fill: "#6366f1", strokeWidth: 2, stroke: theme === 'dark' ? '#121014' : '#fff' }}
                              />
                            </AreaChart>
                          </ResponsiveContainer>) : <ChartEmptyState message="Your partner’s shared check-ins will appear here as they log them." />}
                        </div>
                      </section>
                   </div>
                </motion.div>
              ) : (
                <motion.div
                  key="energy-trends"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="flex flex-col gap-6"
                >
                   <div className="md:grid md:grid-cols-[1fr_2.5fr] md:gap-6 flex flex-col gap-6">
                       {/* Summary Cards */}
                       <div className="grid grid-cols-2 md:grid-cols-1 md:grid-rows-2 gap-4 h-full">
                        <div className="bg-amber-500/10 dark:bg-amber-500/20 p-5 rounded-[2rem] border border-amber-500/20 shadow-sm flex flex-col justify-center h-full">
                          <p className="text-[10px] uppercase font-bold text-amber-500 mb-1 tracking-wider">Avg Level</p>
                          <h4 className="text-xl font-bold text-[var(--text-primary)] dark:text-white">{energyStats?.avgLabel || '--'}</h4>
                        </div>
                        <div className="bg-teal-500/10 dark:bg-teal-500/20 p-5 rounded-[2rem] border border-teal-500/20 shadow-sm flex flex-col justify-center h-full">
                          <p className="text-[10px] uppercase font-bold text-teal-500 mb-1 tracking-wider">Record Streak</p>
                          <h4 className="text-xl font-bold text-[var(--text-primary)] dark:text-white">{energyStats?.count || 0}d</h4>
                        </div>
                      </div>

                      <section className="rounded-[2.5rem] bg-white dark:bg-surface-dark p-6 shadow-soft border border-gray-100 dark:border-white/5 transition-colors h-full flex flex-col min-w-0">
                        <div className="flex items-center justify-between mb-8">
                           <h3 className="text-lg font-bold text-[var(--text-primary)] dark:text-white">Energy Flow</h3>
                           <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                            <span className="material-symbols-outlined">bolt</span>
                          </div>
                        </div>
                        <div className={trendsData.some(d => d.energy !== null) ? "relative h-48 md:h-64 w-full mt-2" : "relative  md:h-64 w-full mt-2"}>
                          {trendsData.some(d => d.energy !== null) ? (<ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trendsData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                              <defs>
                                <linearGradient id="colorEnergyP" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} /><stop offset="95%" stopColor="#f59e0b" stopOpacity={0} /></linearGradient>
                              </defs>
                              <YAxis hide domain={[0, 4]} />
                              <Tooltip
                                contentStyle={tooltipStyles.contentStyle}
                                itemStyle={tooltipStyles.itemStyle}
                                labelStyle={tooltipStyles.labelStyle}
                                formatter={(value: any) => [value === 3 ? 'High' : value === 2 ? 'Medium' : 'Low', 'Level']}
                              />
                              <Area isAnimationActive={animateCharts}
                                type="monotone"
                                dataKey="energy"
                                stroke="#f59e0b"
                                strokeWidth={4}
                                fillOpacity={1}
                                fill="url(#colorEnergyP)"
                                dot={{ r: 3, fill: "#f59e0b", strokeWidth: 2, stroke: theme === 'dark' ? '#121014' : '#fff' }}
                              />
                            </AreaChart>
                          </ResponsiveContainer>) : <ChartEmptyState message="Your partner’s shared check-ins will appear here as they log them." />}
                        </div>
                      </section>
                   </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Log Details Modal */}
      <AnimatePresence>
        {selectedLog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={() => setSelectedLog(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-background-dark dark:bg-surface-dark w-full max-w-sm rounded-[2.5rem] p-6 shadow-2xl relative border border-gray-100 dark:border-white/5 max-h-[90vh] overflow-y-auto no-scrollbar"
            >
              <button
                onClick={() => setSelectedLog(null)}
                className="absolute top-4 right-4 p-2 bg-gray-100 dark:bg-white/5 rounded-full text-gray-500 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
              >
                <span className="material-symbols-outlined text-sm block">close</span>
              </button>
              <div className="flex flex-col items-center mb-6">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-3">
                  <span className="text-3xl">{getMoodEmoji(selectedLog.moods?.[0] || '')}</span>
                </div>
                <h3 className="text-xl font-bold text-[var(--text-primary)] dark:text-white capitalize">
                  {new Date(selectedLog.date).toLocaleDateString('default', { month: 'long', day: 'numeric', year: 'numeric' })}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 capitalize">{selectedLog.moods?.[0] || 'No mood logged'}</p>
              </div>

              <div className="space-y-4">
                {selectedLog.flow && (
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-pink-50 dark:bg-pink-500/10">
                    <span className="text-sm font-semibold text-pink-600 dark:text-pink-400">Flow</span>
                    <span className="text-sm font-bold text-pink-700 dark:text-pink-300 capitalize">{selectedLog.flow}</span>
                  </div>
                )}

                {selectedLog.symptoms && selectedLog.symptoms.length > 0 && (
                  <div className="p-4 rounded-2xl bg-gray-50 dark:bg-white/5">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Symptoms</span>
                    <div className="flex flex-wrap gap-2">
                      {selectedLog.symptoms.map((s: string) => (
                        <span key={s} className="px-3 py-1 bg-white dark:bg-white/10 text-gray-700 dark:text-gray-300 text-xs font-medium rounded-xl border border-gray-100 dark:border-white/5 capitalize">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedLog.note && (
                  <div className="p-4 rounded-2xl bg-gray-50 dark:bg-white/5">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Note</span>
                    <p className="text-sm text-gray-700 dark:text-gray-300 italic">"{selectedLog.note}"</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PartnerInsightsView;
