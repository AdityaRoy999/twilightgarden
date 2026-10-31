import { DailyGuidance } from '../components/wellness/DailyGuidance';
import { CycleHero } from '../components/ui/CycleHero';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Droplet, Heart, Leaf, Lightbulb, Moon, Plus, Smile, Sparkles, Zap } from '../components/ui/Icons';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { localDateKey } from '../lib/dates';
import { useToday } from '../hooks/useToday';
import NotificationBell from '../components/NotificationBell';
import { BotanicalSprig, CycleBloom } from '../components/ui/CycleBloom';

const quickLogs = [{ label: 'Cramps', Icon: Zap, tone: 'rose' }, { label: 'Mood', Icon: Heart, tone: 'rose' }, { label: 'Sleep', Icon: Moon, tone: 'lavender' }, { label: 'Flow', Icon: Droplet, tone: 'rose' }, { label: 'Symptoms', Icon: Sparkles, tone: 'rose' }];

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getCyclePhase, cycleSettings, getLog, logs } = useData();
  const today = useToday();
  const cycle = getCyclePhase(today);
  const estimated = cycle.hasEstimate !== false && cycle.currentDay > 0;
  const name = (user?.name || user?.email?.split('@')[0] || 'there').split(' ')[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const nextPeriod = new Date();
  nextPeriod.setDate(nextPeriod.getDate() + cycle.nextPeriodIn);
  const format = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const fertileStart = new Date(nextPeriod), fertileEnd = new Date(nextPeriod);
  fertileStart.setDate(nextPeriod.getDate() - 19);
  fertileEnd.setDate(nextPeriod.getDate() - 14);
  const logged = getLog(localDateKey());

  const countdown = cycle.nextPeriodIn < 0 ? `${Math.abs(cycle.nextPeriodIn)} days past estimate` : cycle.nextPeriodIn === 0 ? 'Period estimated today' : `${cycle.nextPeriodIn} days to next period`;

  return <div className="bloom-page bloom-home">
    <header className="bloom-home-header">
      <div className="bloom-profile">
        <button onClick={() => navigate('/settings/profile')} aria-label="Edit your profile" className="rounded-full"><span className="bloom-avatar">{user?.avatar_url ? <img src={user.avatar_url} alt="" width="52" height="52"/> : <span>{name.charAt(0).toUpperCase()}</span>}</span></button>
        <div className="text-left"><span className="bloom-greeting">{greeting},</span><h1>{name}</h1></div>
      </div>
      <NotificationBell />
    </header>
    <div className="bloom-home-content">
      <CycleHero>
        <BotanicalSprig className="bloom-hero-leaves"/>
        <div className="bloom-cycle-copy"><p>Your cycle</p><h2>{estimated ? `Day ${cycle.currentDay}` : 'Your own rhythm'}</h2><h3>{estimated ? cycle.phase === 'Unknown' ? 'Your cycle, your pace' : `${cycle.phase} phase` : 'Let’s get to know you'}</h3><p className="bloom-muted">{estimated ? 'A little more in tune with you' : 'Log a period start to see your estimates'}</p><button className="bloom-countdown" onClick={() => navigate(estimated ? '/calendar' : '/log/details')}>{estimated ? countdown : 'Log your period'}<ChevronRight size={19}/></button></div>
        <CycleBloom avatarUrl={user?.avatar_url} avatarName={user?.name||name} periodLength={cycleSettings.avgPeriodLength} introKey={user?.id} day={cycle.currentDay} length={cycleSettings.avgCycleLength} hasEstimate={estimated}/>
      </CycleHero>
      <div className="bloom-stat-grid">
        <button className="bloom-card bloom-stat" onClick={() => navigate('/calendar')}><span className="bloom-icon rose"><Droplet fill="currentColor"/></span><span><span className="bloom-muted">Next period</span><strong>{estimated ? format(nextPeriod) : 'No estimate yet'}</strong><small>{estimated ? countdown : 'Start with a period log'}</small></span><ChevronRight className="bloom-chevron" size={18}/></button>
        <button className="bloom-card bloom-stat" onClick={() => navigate('/calendar')}><span className="bloom-icon mint"><Leaf fill="currentColor"/></span><span><span className="bloom-muted">Estimated fertile window</span><strong>{estimated ? `${format(fertileStart)} – ${format(fertileEnd)}` : 'Not available'}</strong><small>{estimated ? cycle.isFertile ? 'Within estimated window' : 'Outside estimated window' : 'Based on cycle history'}</small></span><ChevronRight className="bloom-chevron" size={18}/></button>
      </div>
      <button className="bloom-checkin" onClick={() => navigate('/log/details')}><span className="bloom-checkin-smile"><Smile size={30}/></span><span><strong>{logged ? 'A little check-in?' : 'How are you feeling?'}</strong><span>{logged ? 'Add to today’s journal' : 'Log today’s symptoms'}</span></span><span className="bloom-checkin-plus"><Plus size={30}/></span></button>
      <DailyGuidance phase={cycle.phase} cycleDay={cycle.currentDay} logs={logs} today={today}/>
      <section className="bloom-quick"><div className="bloom-section-heading"><h2>Quick log</h2><button onClick={() => navigate('/log/details')}>See all <ChevronRight size={17}/></button></div><div className="bloom-quick-grid">{quickLogs.map(({ label, Icon, tone }) => <button key={label} className="bloom-card bloom-quick-item" onClick={() => navigate(`/log/details?section=${label.toLowerCase()}`)} aria-label={`Log ${label.toLowerCase()}`}><span className={`bloom-icon ${tone}`}><Icon size={27}/></span><span>{label}</span></button>)}</div></section>
      <p className="bloom-footnote">Estimates can change. Cycle tracking cannot confirm ovulation or prevent pregnancy.</p>
    </div>
  </div>;
}
