import {LogSymbol} from '../components/ui/LogSymbol';
import { ReferenceArt } from '../components/ui/ReferenceArt';
import { AppIcon } from '../components/ui/Icons';
import { useTheme } from '../contexts/ThemeContext';
import { localDateKey, parseDateKey } from '../lib/dates';
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { FlowIntensity } from '../types';
import { SymptomSelector } from '../components/ui/SymptomSelector';

const LogDetails: React.FC = () => {
  const navigate = useNavigate();

  const physicalOptions = [
    'Cramps', 'Tender Breasts', 'Headache', 'Acne', 'Backache', 'Fatigue',
    'Bloating', 'Insomnia', 'Nausea', 'Dizziness', 'Hot Flashes', 'Chills',
    'Pelvic Pain', 'Joint Pain', 'Sensory Sensitivity'
  ];
  const digestionOptions = [
    'Bloating', 'Cravings', 'Nausea', 'Gas', 'Diarrhea', 'Constipation',
    'Heartburn', 'Indigestion', 'Loss of Appetite'
  ];



  const [searchParams] = useSearchParams();
  const { animationsEnabled } = useTheme();
  const section = searchParams.get('section');
  useEffect(() => {
    if (!section || !['cramps', 'mood', 'sleep', 'flow', 'symptoms'].includes(section)) return;
    const target = document.getElementById(`log-${section === 'cramps' ? 'symptoms' : section}`);
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    target?.scrollIntoView({ behavior: animationsEnabled && !reduced ? 'smooth' : 'instant', block: 'start' });
  }, [section, animationsEnabled]);
  const today = localDateKey();
  const dateParam = searchParams.get('date');
  const targetDate = dateParam && Number.isFinite(parseDateKey(dateParam).getTime()) ? dateParam : today;

  // State management
  const { addLog, getLog, getCyclePhase } = useData();
  const existingLog = getLog(targetDate);

  // Calculate dynamic cycle stats for the specific date
  const { currentDay } = getCyclePhase(targetDate);

  // Format Date for Header
  const dateObj = parseDateKey(targetDate);
  const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const isToday = targetDate === today;
  const headerDateString = isToday ? `Today, ${formattedDate}` : dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  const [periodStarted,setPeriodStarted]=useState(existingLog?.periodStarted||false);
  const [flow, setFlow] = useState<FlowIntensity | undefined>(existingLog?.flow);
  const [moods, setMoods] = useState<string[]>(existingLog?.moods || []);
  const [physical, setPhysical] = useState<string[]>(
    existingLog?.symptoms?.filter(s => physicalOptions.map(o => o.toLowerCase()).includes(s)) || []
  );
  const [digestion, setDigestion] = useState<string[]>(
    existingLog?.symptoms?.filter(s => digestionOptions.map(o => o.toLowerCase()).includes(s)) || []
  );
  const [notes, setNotes] = useState(existingLog?.notes || '');
  const [energyLevel, setEnergyLevel] = useState<"high" | "medium" | "low" | undefined>(existingLog?.energyLevel);
  const [sleepQuality, setSleepQuality] = useState<"good" | "fair" | "poor" | undefined>(existingLog?.sleepQuality);
  const [sleepHours, setSleepHours] = useState<number | undefined>(existingLog?.sleepHours);

  const dirty = useRef(false);
  const formDate = useRef(targetDate);
  // Reset form state when navigating to a different date
  useEffect(() => {
    if (formDate.current !== targetDate) { dirty.current = false; formDate.current = targetDate; }
    if (dirty.current) return;
    setFlow(existingLog?.flow);setPeriodStarted(existingLog?.periodStarted||false);
    setMoods(existingLog?.moods || []);
    setPhysical(existingLog?.symptoms?.filter(s => physicalOptions.map(o => o.toLowerCase()).includes(s)) || []);
    setDigestion(existingLog?.symptoms?.filter(s => digestionOptions.map(o => o.toLowerCase()).includes(s)) || []);
    setNotes(existingLog?.notes || '');
    setEnergyLevel(existingLog?.energyLevel);
    setSleepQuality(existingLog?.sleepQuality);
    setSleepHours(existingLog?.sleepHours);
  }, [targetDate, existingLog]);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    try {
    // Derive sleep quality from hours if not manually set
    let derivedQuality: "good" | "fair" | "poor" | undefined = sleepQuality;
    if (sleepHours !== undefined) {
      if (sleepHours >= 7) derivedQuality = "good";
      else if (sleepHours >= 5) derivedQuality = "fair";
      else derivedQuality = "poor";
    }

    await addLog({
      date: targetDate,
      periodStarted,
      flow,
      moods: moods as any,
      symptoms: [...new Set([...physical, ...digestion])],
      notes,
      energyLevel,
      sleepQuality: derivedQuality,
      sleepHours
    });
    navigate(-1);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Your log could not be saved. Please retry.');
    } finally {
      setSaving(false);
    }
  };

  const handleDateChange = (daysToAdd: number) => {
    const d = parseDateKey(targetDate);
    d.setDate(d.getDate() + daysToAdd);
    const newDateStr = localDateKey(d);
    if (newDateStr <= today) navigate(`/log/details?date=${newDateStr}`, { replace: true });
  };

  const flowOptions = [
    { id: 'spotting', label: 'Spotting', icon: <LogSymbol kind="spotting"/> },
    { id: 'light', label: 'Light', icon: <LogSymbol kind="light"/> },
    { id: 'medium', label: 'Medium', icon: <LogSymbol kind="flow-medium"/> },
    { id: 'heavy', label: 'Heavy', icon: <LogSymbol kind="heavy"/> },
  ];

  const moodOptions = [
    { id: 'calm', label: 'Calm', icon: <LogSymbol kind="calm"/> },
    { id: 'happy', label: 'Happy', icon: <LogSymbol kind="happy"/> },
    { id: 'energetic', label: 'Energetic', icon: <LogSymbol kind="energetic"/> },
    { id: 'frisky', label: 'Frisky', icon: <LogSymbol kind="frisky"/> },
    { id: 'swings', label: 'Swings', icon: <LogSymbol kind="swings"/> },
    { id: 'anxious', label: 'Anxious', icon: <LogSymbol kind="anxious"/> },
    { id: 'sad', label: 'Sad', icon: <LogSymbol kind="sad"/> },
    { id: 'irritated', label: 'Irritated', icon: <LogSymbol kind="irritated"/> },
  ];

  const energyOptions = [
    { id: 'low', label: 'Low', icon: <LogSymbol kind="low"/> },
    { id: 'medium', label: 'Medium', icon: <LogSymbol kind="medium"/> },
    { id: 'high', label: 'High', icon: <LogSymbol kind="high"/> },
  ];

  const reset = () => {
    dirty.current = true;
    setFlow(undefined); setPeriodStarted(false); setMoods([]); setPhysical([]); setDigestion([]);
    setNotes(''); setEnergyLevel(undefined); setSleepQuality(undefined); setSleepHours(undefined);
  };
  const toggleSymptom = (item: string) => {
    const key = item.toLowerCase();
    const remove = physical.includes(key) || digestion.includes(key);
    const update = (previous: string[]) => remove ? previous.filter(value => value !== key) : [...previous, key];
    if (physicalOptions.includes(item)) setPhysical(update);
    if (digestionOptions.includes(item)) setDigestion(update);
  };
  return (
    <div className="bloom-journal journal-page font-display">
      <header className="journal-header"><button onClick={() => navigate(-1)} aria-label="Back"><AppIcon name="arrow_back" size={26}/></button><h1>Log Details</h1><button onClick={reset} disabled={saving}>Reset</button></header>
      <div className="journal-date"><ReferenceArt kind="leaves" className="reference-heading-art"/><button onClick={() => handleDateChange(-1)} aria-label="Previous day"><AppIcon name="chevron_left" size={24}/></button><div><h2>{headerDateString}</h2><span>{currentDay > 0 ? `Cycle day ${currentDay}` : 'Your daily check-in'}</span></div><button onClick={() => handleDateChange(1)} disabled={targetDate >= today} aria-label="Next day"><AppIcon name="chevron_right" size={24}/></button></div>
      <main onChangeCapture={() => { dirty.current = true; }} onClickCapture={() => { dirty.current = true; }} className="journal-content">
        <label className="journal-period"><ReferenceArt kind="leaves" className="reference-card-art"/><input type="checkbox" checked={periodStarted} onChange={event => setPeriodStarted(event.target.checked)}/><span><strong>A new period started on this date</strong><small>Mark the first day only. Your cycle dates and your partner's calendar will update together.</small></span></label>
        <section id="log-flow" className="reference-card journal-card"><div className="journal-section-title"><AppIcon name="water_drop" size={26}/><h2>Flow Intensity</h2></div><SymptomSelector options={flowOptions} selected={flow ? [flow] : []} onChange={values => setFlow(values[0] as FlowIntensity)} multiSelect={false}/></section>
        <section id="log-mood" className="reference-card journal-card"><div className="journal-section-title mint"><AppIcon name="face" size={26}/><h2>Mood</h2><small>Select multiple</small></div><SymptomSelector options={moodOptions} selected={moods} onChange={setMoods}/></section>
        <section className="reference-card journal-card"><div className="journal-section-title amber"><AppIcon name="bolt" size={26}/><h2>Energy Level</h2></div><SymptomSelector options={energyOptions} selected={energyLevel ? [energyLevel] : []} onChange={values => setEnergyLevel(values[0] as 'high' | 'medium' | 'low')} multiSelect={false}/></section>
        <section id="log-sleep" className="reference-card journal-card"><div className="journal-sleep-heading"><span className="reference-icon"><AppIcon name="bedtime" size={29}/></span><div><h2>Sleep &amp; Rest</h2><p>Track your sleep and energy levels to understand how you're feeling.</p></div><strong>{sleepHours === undefined ? 'Not logged' : `${sleepHours}h`}</strong></div><div className="journal-sleep-scale"><div className="journal-sleep-labels"><span>0h</span><span>12h</span><span>24h</span></div><div className="journal-sleep-control"><div className="journal-sleep-ticks" aria-hidden="true">{Array.from({length: 25}, (_, hour) => <i key={hour} data-filled={sleepHours !== undefined && hour <= sleepHours}/>)}</div><input aria-label="Sleep duration in hours" type="range" min="0" max="24" step="0.5" value={sleepHours ?? 0} onChange={event => setSleepHours(Number(event.target.value))}/></div><p>{sleepHours === undefined ? 'Move the slider to log your rest' : sleepHours < 5 ? 'Poor rest' : sleepHours < 7 ? 'Fair rest' : 'Good rest'}</p></div></section>
        {([{ title: 'Physical', icon: 'accessibility_new', options: physicalOptions, id: 'log-symptoms', tone: 'rose' }, { title: 'Digestion', icon: 'restaurant', options: digestionOptions, id: 'log-digestion', tone: 'amber' }]).map(group => <section key={group.id} id={group.id} className={`reference-card journal-card journal-symptoms ${group.tone}`}><ReferenceArt kind="leaves" className="reference-card-art"/><div className="journal-section-title"><span className="reference-icon"><AppIcon name={group.icon} size={25}/></span><div><h2>{group.title}</h2><p>Select all symptoms you're experiencing.</p></div></div><div className="journal-chips">{group.options.map(item => <button key={item} type="button" aria-pressed={physical.includes(item.toLowerCase()) || digestion.includes(item.toLowerCase())} onClick={() => toggleSymptom(item)}>{item}</button>)}</div></section>)}
        <section className="reference-card journal-card journal-notes"><div className="journal-section-title"><AppIcon name="edit_note" size={24}/><h2>Daily Notes</h2></div><textarea aria-label="Daily notes" maxLength={500} value={notes} onChange={event => setNotes(event.target.value)} placeholder="Add a personal note about how you're feeling today..."/><small>{notes.length}/500</small></section>
      </main>
      <footer className="journal-save">{saveError && <p role="alert">{saveError}</p>}<button className="reference-button" onClick={handleSave} disabled={saving || targetDate > today}><span><AppIcon name="check" size={18}/></span>{saving ? 'Saving…' : 'Save Log'}</button></footer>
    </div>
  );
};

export default LogDetails;
