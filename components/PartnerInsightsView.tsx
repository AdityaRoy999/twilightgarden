import {MetricTooltip, DistributionTooltip} from './charts/MetricTooltip';
import {springs,motionTransition} from '../lib/motion';
import {SegmentedControl} from './ui/SegmentedControl';
import { cycleStatistics } from '../lib/cycleStatistics';
import {LogHistoryView} from './history/LogHistoryView';
import { AppIcon } from './ui/Icons';
import ChartEmptyState from './ui/ChartEmptyState';
import { useTheme } from '../contexts/ThemeContext';
import React, { useState, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
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

const PartnerInsightsView: React.FC<PartnerInsightsViewProps> = ({ logs, cycleSettings, theme }) => {
  const { animationsEnabled } = useTheme();
  const reducedMotion = useReducedMotion();
  const animateCharts = animationsEnabled !== false && !reducedMotion;
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');
  const [activeTab, setActiveTab] = useState<'history' | 'trends'>('history');
  const [historyTab, setHistoryTab] = useState<'general' | 'logs'>('general');
  const [trendsSubTab, setTrendsSubTab] = useState<'sleep' | 'energy'>('sleep');

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

  const {historyData,stats}=useMemo(()=>cycleStatistics(logs||[],cycleSettings),[logs,cycleSettings]);

  // 2. Calculate Top Symptoms
  const topSymptoms = useMemo(() => {
    if (!logs?.length) return [{ name: 'No Data', level: '-', width: '0%', color: 'bg-gray-200' }];
    const counts: Record<string, number> = {};
    logs.forEach(log => {
      [...new Set((log.symptoms || []) as string[])].forEach((sym: string) => {
        counts[sym] = (counts[sym] || 0) + 1;
      });
    });

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3);
    if (sorted.length === 0) return [
      { name: 'No Data', level: '-', width: '0%', color: 'bg-gray-200' }
    ];


    return sorted.map(([name, count], i) => {
      const baseline = logs.length;
      const pct = (count / baseline) * 100;
      const color = i === 0 ? 'bg-primary' : i === 1 ? 'bg-[#E7D6A7]' : 'bg-[#2DD4BF]';
      const level = `${count} of ${logs.length} check-ins`;
      return { name, level, width: `${pct}%`, color };
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
        date: log.date,
        sleepHours: log.sleepHours ?? log.sleep_hours,
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
      <SegmentedControl label="Shared insight sections" value={activeTab==='history'?historyTab:trendsSubTab} options={[{value:'general',label:'Cycle',icon:'calendar_today'},{value:'logs',label:'History',icon:'history'},{value:'sleep',label:'Sleep',icon:'bedtime'},{value:'energy',label:'Energy',icon:'bolt'}]} onChange={value=>{if(value==='general'||value==='logs'){setActiveTab('history');setHistoryTab(value);}else{setActiveTab('trends');setTrendsSubTab(value as 'sleep'|'energy');}}}/>


      <React.Fragment>
        {activeTab === 'history' ? (
          <motion.div
            key="history"
            initial={animateCharts?{y:8}:false}
            animate={{y:0}} transition={motionTransition(springs.section,!animateCharts)}
            className="flex flex-col gap-6"
          >

            <React.Fragment>
              {historyTab === 'general' ? (
                <motion.div
                  key="general-info"
                  initial={animateCharts?{y:8}:false}
                  animate={{y:0}} transition={motionTransition(springs.section,!animateCharts)}
                  className="flex flex-col gap-6"
                >
                  {/* Stats Cards */}
                  <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex flex-col items-center justify-center gap-3 rounded-[2rem] bg-white dark:bg-surface-dark p-6 shadow-soft border border-gray-100 dark:border-white/5 text-center h-44 transition-colors md:col-span-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400">
                        <span className="app-icon-glyph text-xl"><AppIcon name={"refresh"}/></span>
                      </div>
                      <h3 className="text-2xl font-bold text-[var(--text-primary)] dark:text-white">{stats.avgCycle}</h3>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Avg Cycle</p>
                    </div>
                    <div className="flex flex-col items-center justify-center gap-3 rounded-[2rem] bg-white dark:bg-surface-dark p-6 shadow-soft border border-gray-100 dark:border-white/5 text-center h-44 transition-colors md:col-span-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400">
                        <span className="app-icon-glyph text-xl"><AppIcon name={"bar_chart"}/></span>
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
                              <span className="app-icon-glyph text-lg block"><AppIcon name={"bar_chart"}/></span>
                            </button>
                            <button aria-label="Show line chart" onClick={() => setChartType('line')} className={`relative z-10 p-2 rounded-lg transition-colors ${chartType === 'line' ? 'on-brand bg-primary text-white' : 'text-gray-400'}`}>
                              <span className="app-icon-glyph text-lg block"><AppIcon name={"show_chart"}/></span>
                            </button>
                          </div>
                        </div>

                        <div className={historyData.length > 0 ? "relative h-48 md:h-64 w-full mt-2" : "relative  md:h-64 w-full mt-2"}>
                          {historyData.length > 0 ? (<ResponsiveContainer width="100%" height="100%">
                            {chartType === 'bar' ? (
                              <BarChart data={historyData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                                <XAxis dataKey="date" hide/><YAxis hide domain={['dataMin - 5', 'dataMax + 5']} />
                                <ReferenceLine y={stats.avgCycle} stroke={theme === 'dark' ? 'rgba(255,255,255,0.2)' : '#E5E7EB'} strokeDasharray="3 3" />
                                <Tooltip cursor={false} content={<MetricTooltip metric="cycle"/>}/>
                                <Bar isAnimationActive={animateCharts} dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={40}>
                                  {historyData.map((_entry, index) => (
                                    <Cell key={`cell-${index}`} fill={index >= historyData.length - 1 ? 'var(--color-primary)' : (theme === 'dark' ? '#ffffff1a' : '#E5E7EB')} />
                                  ))}
                                </Bar>
                              </BarChart>
                            ) : (
                              <AreaChart data={historyData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                                <defs>
                                  <linearGradient id="colorHistoryP" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#984369" stopOpacity={0.6} /><stop offset="95%" stopColor="#984369" stopOpacity={0} /></linearGradient>
                                </defs>
                                <XAxis dataKey="date" hide/><YAxis hide domain={['dataMin - 5', 'dataMax + 5']} />
                                <Tooltip cursor={false} content={<MetricTooltip metric="cycle"/>}/>
                                <Area isAnimationActive={animateCharts} type="monotone" dataKey="value" stroke="var(--color-primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorHistoryP)" dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
                              </AreaChart>
                            )}
                          </ResponsiveContainer>) : <ChartEmptyState message="Your partner’s shared check-ins will appear here as they log them." />}
                        </div>
                      </section>

                      {/* Symptoms Card */}
                      <section className="rounded-[2rem] bg-white dark:bg-surface-dark p-6 shadow-soft border border-gray-100 dark:border-white/5 transition-colors h-full flex flex-col justify-center">
                        <h3 className="text-lg font-bold text-[var(--text-primary)] dark:text-white mb-6 flex items-center gap-2">
                          <span className="app-icon-glyph text-primary text-xl"><AppIcon name={"Auto_Awesome"}/></span>
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
                <LogHistoryView logs={logs} readOnly/>
              )}
            </React.Fragment>
          </motion.div>
        ) : (
          <motion.div
            key="trends"
            initial={animateCharts?{y:8}:false}
            animate={{y:0}} transition={motionTransition(springs.section,!animateCharts)}
            className="flex flex-col gap-6"
          >
             {/* Trends Sub-tabs */}
             <div className="flex justify-center mb-2">

             </div>

            <React.Fragment>
              {trendsSubTab === 'sleep' ? (
                 <motion.div
                  key="sleep-trends"
                  initial={animateCharts?{y:8}:false}
                  animate={{y:0}} transition={motionTransition(springs.section,!animateCharts)}
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
                            <span className="app-icon-glyph"><AppIcon name={"bedtime"}/></span>
                          </div>
                        </div>
                        <div className={trendsData.some(d => d.sleep !== null) ? "relative h-48 md:h-64 w-full mt-2" : "relative  md:h-64 w-full mt-2"}>
                          {trendsData.some(d => d.sleep !== null) ? (<ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trendsData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                              <defs>
                                <linearGradient id="colorSleepP" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} /><stop offset="95%" stopColor="#6366f1" stopOpacity={0} /></linearGradient>
                              </defs>
                              <XAxis dataKey="date" hide/><YAxis hide domain={[0, 4]} />
                               <Tooltip cursor={false} content={<MetricTooltip metric="sleep"/>}/>
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
                  initial={animateCharts?{y:8}:false}
                  animate={{y:0}} transition={motionTransition(springs.section,!animateCharts)}
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
                            <span className="app-icon-glyph"><AppIcon name={"bolt"}/></span>
                          </div>
                        </div>
                        <div className={trendsData.some(d => d.energy !== null) ? "relative h-48 md:h-64 w-full mt-2" : "relative  md:h-64 w-full mt-2"}>
                          {trendsData.some(d => d.energy !== null) ? (<ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trendsData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                              <defs>
                                <linearGradient id="colorEnergyP" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} /><stop offset="95%" stopColor="#f59e0b" stopOpacity={0} /></linearGradient>
                              </defs>
                              <XAxis dataKey="date" hide/><YAxis hide domain={[0, 4]} />
                              <Tooltip cursor={false} content={<MetricTooltip metric="energy"/>}/>
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
            </React.Fragment>
          </motion.div>
        )}
      </React.Fragment>


    </div>
  );
};

export default PartnerInsightsView;
