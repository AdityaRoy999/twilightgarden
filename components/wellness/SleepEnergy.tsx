import React from 'react';
import { motion } from 'framer-motion';
import { AppIcon } from '../ui/Icons';
import { WellnessIllustration } from './WellnessIllustration';
import { useAppMotion } from '../../hooks/useAppMotion';
import { motionTransition, springs } from '../../lib/motion';
import type { analyzeSleepEnergyCorrelations } from '../../lib/wellnessAI';

type SleepData = ReturnType<typeof analyzeSleepEnergyCorrelations>;
export function SleepEnergy({ data }: { data: SleepData }) {
  const { reduced } = useAppMotion();
  const { sleepCounts, energyCounts, totalLogs, totalWithBoth = 0, sleepEnergyMap = {}, insights } = data;
  const sleepTotal = Object.values(sleepCounts).reduce((a,b) => a+b, 0), energyTotal = Object.values(energyCounts).reduce((a,b) => a+b, 0);
  const groups = [
    { title: 'Sleep Quality', icon: 'bedtime', art: 'peaceful-sleep', total: sleepTotal, rows: [['Good',sleepCounts.good],['Fair',sleepCounts.fair],['Poor',sleepCounts.poor]] as const },
    { title: 'Energy Levels', icon: 'bolt', art: 'morning-energy', total: energyTotal, rows: [['High',energyCounts.high],['Medium',energyCounts.medium],['Low',energyCounts.low]] as const },
  ];
  const chart = ['poor','fair','good'].map(sleep => {
    const row = sleepEnergyMap[sleep] || {low:0,medium:0,high:0};
    const n = row.low + row.medium + row.high;
    return { sleep, n, mean: n ? (row.low + row.medium*2 + row.high*3)/n : 0 };
  });
  return <div className="sleep-energy-cards">{groups.map(group => <section className="wellness-stat-card" key={group.title}>
    <header><span className={`tip-symbol ${group.icon === 'bolt' ? 'tone-amber' : 'tone-violet'}`}><AppIcon name={group.icon} size={30}/></span><div><h2>{group.title}</h2><p>{group.total ? `Your ${group.title === 'Sleep Quality' ? 'sleep' : 'energy'} across ${group.total} logged days` : 'Your story starts with a daily check-in'}</p></div><WellnessIllustration id={group.art} decorative/></header>
    <div className="wellness-bars">{group.rows.map(([label,count],index) => {
      const percent = group.total ? Math.round(count/group.total*100) : 0;
      return <div key={label} className="wellness-bar-row"><div><strong>{label}</strong><span>{count} {count === 1 ? 'day' : 'days'} ({percent}%)</span></div><div role="meter" aria-label={label} aria-valuenow={count} aria-valuemin={0} aria-valuemax={group.total || 1} aria-valuetext={`${count} of ${group.total} logged days`} className="wellness-bar-track"><motion.div className={`wellness-bar-fill level-${index}`} initial={false} animate={{ scaleX: percent/100 }} transition={motionTransition(springs.section,reduced)}/></div></div>;
    })}{group.total === 0 ? <p className="wellness-no-data">No {group.title === 'Sleep Quality' ? 'sleep' : 'energy'} data yet. Log how you feel to see your own patterns.</p> : null}</div>
  </section>)}
  <section className="wellness-stat-card correlation-card"><div className="correlation-copy"><div className="tip-title"><span className="tip-symbol"><AppIcon name="insights" size={29}/></span><div><h2>Correlations</h2><p>Sleep & energy, side by side</p></div></div>{totalWithBoth >= 3 ? insights.map((insight,index) => <p className="correlation-insight" key={index}>{insight.replace(/[\p{Extended_Pictographic}\uFE0F]/gu,'')}</p>) : <p className="correlation-insight">Log both sleep and energy on at least 3 days to explore how they relate for you.</p>}<small>Based on {totalWithBoth} days with both logged · {totalLogs} total wellness logs.<br/>Patterns show association, not cause.</small></div>
    {totalWithBoth >= 3 ? <div className="correlation-chart" role="img" aria-label={`Average energy by sleep quality: ${chart.map(row => `${row.sleep}: ${row.n ? row.mean.toFixed(1) + ' out of 3 from ' + row.n + ' days' : 'no paired logs'}`).join('; ')}`}><span className="chart-axis-title">Average energy</span><div className="correlation-plot"><div className="chart-ticks"><span>High</span><span>Medium</span><span>Low</span></div><div className="chart-columns">{chart.map((row,index) => <div className="chart-column" key={row.sleep}><div className="chart-column-track">{row.n ? <motion.div className={`chart-column-fill level-${2-index}`} initial={false} animate={{ height: `${row.mean/3*100}%` }} transition={motionTransition(springs.section,reduced)}><span>{row.mean.toFixed(1)}</span></motion.div> : <span className="chart-missing">—</span>}</div><strong>{row.sleep}</strong><small>n = {row.n}</small></div>)}</div></div><p>Sleep quality</p></div> : <WellnessIllustration id="correlation"/>}
  </section></div>;
}
