import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight, Droplet, Heart } from '../components/ui/Icons';
import { calendarDayDifference, localDateKey } from '../lib/dates';
import { useToday } from '../hooks/useToday';
import { useData } from '../contexts/DataContext';
import { DailyLog, CyclePhase, CycleSettings } from '../types';
import LogDetailsModal from '../components/LogDetailsModal';
import { ReferenceArt, ReferenceHeading } from '../components/ui/ReferenceArt';

const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export function CalendarScreen({ logs, cycleSettings, getCyclePhase, readOnly = false, description }: { logs: DailyLog[]; cycleSettings: CycleSettings; getCyclePhase: (date?: string) => CyclePhase; readOnly?: boolean; description?: string }) {
  const navigate = useNavigate();
  const today = useToday();
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selected, setSelected] = useState<{ log: DailyLog | null; date: string } | null>(null);
  const year = viewDate.getFullYear(), month = viewDate.getMonth();
  const offset = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells = Math.ceil((offset + days) / 7) * 7;
  const phase = getCyclePhase(today);
  const phaseDescriptions: Record<string, string> = { Menstrual: 'Make room for rest and self-care. It’s okay to take things slowly and listen to what you need.', Follicular: 'A new chapter in your cycle. Check in with your energy and move at your own pace.', Ovulation: 'Notice how you feel today. Your experience is personal, and estimates can change.', Luteal: 'A little extra kindness goes a long way. Make time for meals, rest, and the things that feel good.' };
  const openDate = (date: string) => {
    if (date > today) return;
    const log = logs.find(item => item.date === date);
    if (log) setSelected({ log, date }); else if (!readOnly) navigate(`/log/details?date=${date}`);
  };
  return <div className="reference-page reference-calendar">
    <LogDetailsModal isOpen={!!selected} onClose={() => setSelected(null)} log={selected?.log || null} date={selected?.date || ''} readOnly={readOnly}/>
    <ReferenceHeading title="Calendar" description={description} action={<button onClick={() => setViewDate(new Date())}><CalendarDays size={18}/>Today</button>}/>
    <main className="reference-stack reference-calendar-layout">
      <section className="reference-card reference-calendar-card" aria-label="Cycle calendar">
        <div className="reference-month"><button aria-label="Previous month" onClick={() => setViewDate(new Date(year, month - 1, 1))}><ChevronLeft size={22}/></button><strong aria-live="polite">{viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</strong><button aria-label="Next month" onClick={() => setViewDate(new Date(year, month + 1, 1))}><ChevronRight size={22}/></button></div>
        <div className="reference-week">{weekdays.map(day => <abbr key={day} title={day}>{day[0]}</abbr>)}</div>
        <div className="reference-days">{Array.from({ length: cells }, (_, index) => {
          const number = index - offset + 1;
          const date = localDateKey(new Date(year, month, number));
          const outside = number < 1 || number > days;
          const log = logs.find(item => item.date === date);
          const state = getCyclePhase(date);
          const period = !!log?.flow || !!log?.periodStarted || date === cycleSettings.lastPeriodStart;
          const ahead = calendarDayDifference(date, today);
          const futurePeriod = ahead > 0 && phase.hasEstimate !== false && phase.nextPeriodIn >= 0 && ahead >= phase.nextPeriodIn && (ahead - phase.nextPeriodIn) % cycleSettings.avgCycleLength < cycleSettings.avgPeriodLength;
          const predicted = !period && ((state.hasEstimate !== false && state.phase === 'Menstrual') || futurePeriod);
          const label = [date, period ? 'Period logged' : predicted ? 'Predicted period' : state.isOvulation ? 'Estimated ovulation' : state.isFertile ? 'Estimated fertile window' : '', log ? 'Has a journal entry' : '', date > today ? 'Future date' : ''].filter(Boolean).join(', ');
          return <button key={date} type="button" aria-label={label} aria-current={date === today ? 'date' : undefined} disabled={date > today || outside || (readOnly && !log)} onClick={() => openDate(date)} className={`reference-day ${outside ? 'outside' : ''}`} data-period={period} data-predicted={predicted} data-ovulation={state.isOvulation} data-today={date === today}>
            <span className="reference-day-number">{period && !outside && <svg className="reference-day-drop" viewBox="0 0 40 48" aria-hidden="true"><path d="M20 1C16 10 2 20 2 30A18 18 0 0 0 38 30C38 20 24 10 20 1Z" fill="currentColor"/></svg>}<span>{new Date(year, month, number).getDate()}</span></span>
            {!outside && (period ? <span className="reference-day-marker"/> : state.isOvulation ? <span className="reference-day-marker ovulation"/> : state.isFertile ? <Heart className="reference-day-heart" size={10} fill="currentColor"/> : log ? <span className="reference-day-marker"/> : null)}
          </button>;
        })}</div>
        <div className="reference-legend"><span><Droplet size={15} fill="currentColor"/>Period</span><span><Heart size={13} fill="#f58fb1" stroke="#f58fb1"/>Fertile estimate</span><span><i className="ovulation"/>Ovulation estimate</span><span><i className="predicted"/>Predicted</span></div>
      </section>
      <section className="reference-card"><ReferenceArt kind="leaves" className="reference-card-art"/><div className="reference-phase-heading"><span className="reference-icon"><Droplet size={27} fill="currentColor"/></span><div><h2>Current phase</h2><strong>{phase.phase === 'Unknown' ? 'Your own rhythm' : phase.phase}</strong>{phase.currentDay > 0 && <small>· Day {phase.currentDay}</small>}</div></div><p className="reference-description">{phaseDescriptions[phase.phase] || 'Log a period start and your daily symptoms to get to know your own patterns.'}</p><div className="reference-phase-footer"><CalendarDays size={17}/>{phase.hasEstimate === false ? 'No period estimate available' : phase.nextPeriodIn < 0 ? <>Period estimate passed <strong>{Math.abs(phase.nextPeriodIn)} days ago</strong></> : <>Next period in <strong>{phase.nextPeriodIn} days</strong></>}</div></section>
      <section className="reference-card"><div className="reference-glance-heading"><h2>Cycle at a glance</h2><button onClick={() => navigate(readOnly ? '/partner/insights' : '/insights')}>View details <ChevronRight size={14} className="inline"/></button></div><div className="reference-glance-stats"><div><strong>{cycleSettings.avgCycleLength}</strong><span>Typical cycle length</span></div><div><strong>{cycleSettings.avgPeriodLength}</strong><span>Typical period duration</span></div></div></section>
      {logs.some(log => log.date === today) && <button className="reference-card text-left" onClick={() => openDate(today)}><strong>Today’s check-in</strong><p className="reference-description mt-2">Review your symptoms and how you’re feeling.</p></button>}
    </main>
  </div>;
}

export default function CalendarView() {
  const data = useData();
  return <CalendarScreen logs={data.logs} cycleSettings={data.cycleSettings} getCyclePhase={data.getCyclePhase}/>;
}
