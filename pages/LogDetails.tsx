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
  const today = localDateKey();
  const dateParam = searchParams.get('date');
  const targetDate = dateParam || today;

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
    navigate(`/log/details?date=${newDateStr}`, { replace: true });
  };

  const toggleSelection = (
    current: string[],
    setFn: React.Dispatch<React.SetStateAction<string[]>>,
    item: string
  ) => {
    if (current.includes(item)) {
      setFn(current.filter((i) => i !== item));
    } else {
      setFn([...current, item]);
    }
  };

  const flowOptions = [
    { id: 'spotting', label: 'Spotting', icon: <span className="material-symbols-outlined">grain</span> },
    { id: 'light', label: 'Light', icon: <span className="material-symbols-outlined">water_drop</span> },
    { id: 'medium', label: 'Medium', icon: <span className="material-symbols-filled">water_drop</span> },
    { id: 'heavy', label: 'Heavy', icon: <span className="material-symbols-outlined">water_lux</span> },
  ];

  const moodOptions = [
    { id: 'calm', label: 'Calm', icon: <span className="material-symbols-outlined">spa</span> },
    { id: 'happy', label: 'Happy', icon: <span className="material-symbols-outlined">sentiment_satisfied</span> },
    { id: 'energetic', label: 'Energetic', icon: <span className="material-symbols-outlined">bolt</span> },
    { id: 'frisky', label: 'Frisky', icon: <span className="material-symbols-outlined">favorite</span> },
    { id: 'swings', label: 'Swings', icon: <span className="material-symbols-outlined">waves</span> },
    { id: 'anxious', label: 'Anxious', icon: <span className="material-symbols-outlined">sentiment_worried</span> },
    { id: 'sad', label: 'Sad', icon: <span className="material-symbols-outlined">sentiment_dissatisfied</span> },
    { id: 'irritated', label: 'Irritated', icon: <span className="material-symbols-outlined">sentiment_very_dissatisfied</span> },
  ];

  const energyOptions = [
    { id: 'low', label: 'Low', icon: <span className="material-symbols-outlined">battery_low</span> },
    { id: 'medium', label: 'Medium', icon: <span className="material-symbols-outlined">battery_3_bar</span> },
    { id: 'high', label: 'High', icon: <span className="material-symbols-outlined">bolt</span> },
  ];

  const sleepOptions = [
    { id: 'poor', label: 'Poor', icon: <span className="material-symbols-outlined">sentiment_very_dissatisfied</span> },
    { id: 'fair', label: 'Fair', icon: <span className="material-symbols-outlined">sentiment_neutral</span> },
    { id: 'good', label: 'Good', icon: <span className="material-symbols-outlined">bedtime</span> },
  ];

  return (
    <div className="animate-slideIn font-display flex flex-col min-h-screen bg-background-dark pb-6">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-5 py-4 bg-background-dark/95 backdrop-blur-md">
        <button
          onClick={() => navigate(-1)}
          className="flex size-10 items-center justify-center rounded-full text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
        >
          <span className="material-symbols-outlined text-2xl">arrow_back</span>
        </button>
        <h2 className="text-[17px] font-bold text-white tracking-tight">Log Details</h2>
        <button onClick={() => { setFlow(undefined); setPeriodStarted(false); setMoods([]); setPhysical([]); setDigestion([]); setNotes(''); setEnergyLevel(undefined); setSleepQuality(undefined); setSleepHours(undefined); }} disabled={saving} className="text-[13px] font-medium text-gray-400 hover:text-white transition-colors px-2">
          Reset
        </button>
      </header>

      {/* Date Navigation */}
      <div className="flex items-center justify-center gap-8 py-2 mb-4 shrink-0">
        <button
          onClick={() => handleDateChange(-1)}
          className="text-gray-500 hover:text-white transition-colors"
        >
          <span className="material-symbols-outlined text-[14px]">arrow_back_ios_new</span>
        </button>
        <div className="flex flex-col items-center gap-1">
          <h2 className="text-[22px] font-bold text-[#D14D72] leading-none">{headerDateString}</h2>
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Cycle Day {currentDay}</span>
        </div>
        <button
          onClick={() => handleDateChange(1)}
          className="text-gray-500 hover:text-white transition-colors"
        >
          <span className="material-symbols-outlined text-[14px]">arrow_forward_ios</span>
        </button>
      </div>

      <main onChangeCapture={() => { dirty.current = true; }} onClickCapture={() => { dirty.current = true; }} className="flex-1 px-5 flex flex-col gap-5 pb-32">
        <label className="mb-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4"><input type="checkbox" checked={periodStarted} onChange={event=>setPeriodStarted(event.target.checked)} className="mt-1 h-5 w-5 rounded text-primary focus:ring-primary"/><span><span className="block text-sm font-semibold text-gray-900 dark:text-white">A new period started on this date</span><span className="mt-1 block text-xs leading-relaxed text-gray-500">Mark the first day only. Your cycle dates and your partner's calendar will update together.</span></span></label>
        {/* Flow Intensity */}
        <div className="bg-surface-dark rounded-[24px] p-5 shadow-sm border border-white/5">
          <div className="flex items-center gap-2.5 mb-5">
            <span className="material-symbols-filled text-[#D14D72] text-[20px]">water_drop</span>
            <h3 className="text-[15px] font-bold text-white">Flow Intensity</h3>
          </div>
          <SymptomSelector
            options={flowOptions}
            selected={flow ? [flow] : []}
            onChange={(s) => setFlow(s[0] as any)}
            multiSelect={false}
          />
        </div>

        {/* Mood */}
        <div className="bg-surface-dark rounded-[24px] p-5 shadow-sm border border-white/5">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[#4ECDC4] text-[20px]">face</span>
              <h3 className="text-[15px] font-bold text-white">Mood</h3>
            </div>
            <span className="text-[10px] font-semibold text-gray-500 bg-white/5 px-2.5 py-1 rounded-[8px]">
              Select multiple
            </span>
          </div>
          <div className="mt-2">
            <SymptomSelector
              options={moodOptions}
              selected={moods}
              onChange={setMoods}
            />
          </div>
        </div>

        {/* Energy & Sleep Container */}
        <div className="flex flex-col gap-5">
          <div className="bg-surface-dark rounded-[24px] p-5 shadow-sm border border-white/5">
            <div className="flex items-center gap-2.5 mb-5">
              <span className="material-symbols-outlined text-yellow-400 text-[20px]">bolt</span>
              <h3 className="text-[15px] font-bold text-white">Energy Level</h3>
            </div>
            <SymptomSelector
              options={energyOptions}
              selected={energyLevel ? [energyLevel] : []}
              onChange={(s) => setEnergyLevel(s[0] as any)}
              multiSelect={false}
            />
          </div>

          <div className="bg-surface-dark rounded-[24px] p-5 shadow-sm border border-white/5">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-indigo-400 text-[20px]">bedtime</span>
                <h3 className="text-[15px] font-bold text-white">Sleep Duration</h3>
              </div>
              <div className="flex items-center gap-1.5 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
                <span className="text-[15px] font-bold text-indigo-400">{sleepHours || 0}</span>
                <span className="text-[11px] font-bold text-indigo-500/60 uppercase">Hours</span>
              </div>
            </div>

            <div className="px-2">
              <input
                type="range"
                min="0"
                max="24"
                step="0.5"
                value={sleepHours || 0}
                onChange={(e) => setSleepHours(parseFloat(e.target.value))}
                style={{
                  background: `linear-gradient(to right, ${(sleepHours || 0) < 5 ? '#f87171' :
                      (sleepHours || 0) < 7 ? '#fbbf24' : '#10b981'
                    } 0%, ${(sleepHours || 0) < 5 ? '#f87171' :
                      (sleepHours || 0) < 7 ? '#fbbf24' : '#10b981'
                    } ${(sleepHours || 0) / 24 * 100}%, rgba(255,255,255,0.05) ${(sleepHours || 0) / 24 * 100}%, rgba(255,255,255,0.05) 100%)`
                }}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-white shadow-inner"
              />
              <div className="flex justify-between mt-3 px-1">
                <span className="text-[10px] font-bold text-gray-600">0h</span>
                <span className="text-[10px] font-bold text-gray-500">12h</span>
                <span className="text-[10px] font-bold text-gray-600">24h</span>
              </div>

              <div className="mt-4 flex justify-center">
                <span className={`text-[11px] font-black uppercase tracking-widest ${(sleepHours || 0) < 5 ? 'text-red-400' :
                    (sleepHours || 0) < 7 ? 'text-amber-400' : 'text-emerald-400'
                  }`}>
                  {(sleepHours || 0) < 5 ? 'Poor Rest' :
                    (sleepHours || 0) < 7 ? 'Fair Rest' : 'Good Rest'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Physical & Digestion Container */}
        <div className="bg-surface-dark rounded-[24px] p-6 shadow-sm border border-white/5 flex flex-col gap-8">
          {/* Physical Section */}
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <span className="material-symbols-outlined text-[#D14D72] text-[20px]">accessibility_new</span>
              <h3 className="text-[13px] font-bold text-white uppercase tracking-wider">Physical</h3>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {physicalOptions.map((item) => {
                const isSelected = physical.includes(item.toLowerCase());
                return (
                  <button
                    key={item}
                    onClick={() => toggleSelection(physical, setPhysical, item.toLowerCase())}
                    className={`px-4 py-2.5 rounded-[14px] text-[13px] font-medium transition-all duration-200 ${isSelected
                      ? 'bg-[#D14D72] text-white shadow-lg shadow-[#D14D72]/20'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                      }`}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Digestion Section */}
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <span className="material-symbols-outlined text-[#E7D6A7] text-[20px]">restaurant</span>
              <h3 className="text-[13px] font-bold text-white uppercase tracking-wider">Digestion</h3>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {digestionOptions.map((item) => {
                const isSelected = digestion.includes(item.toLowerCase());
                return (
                  <button
                    key={item}
                    onClick={() => toggleSelection(digestion, setDigestion, item.toLowerCase())}
                    className={`px-4 py-2.5 rounded-[14px] text-[13px] font-medium transition-all duration-200 ${isSelected
                      ? 'bg-[#E7D6A7] text-[#3f3a22] shadow-lg shadow-[#E7D6A7]/20 font-bold'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                      }`}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Daily Notes */}
        <div className="bg-surface-dark rounded-[24px] p-5 shadow-sm border border-white/5">
          <div className="flex items-center gap-2.5 mb-4">
            <span className="material-symbols-outlined text-gray-400 text-[20px]">edit_note</span>
            <h3 className="text-[15px] font-bold text-white">Daily Notes</h3>
          </div>
          <div className="relative bg-[#27272a]/50 rounded-[18px] border border-white/5 focus-within:border-white/10 transition-colors">
            <textarea
              aria-label="Daily notes"
              maxLength={500}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-transparent border-none rounded-[18px] p-4 text-[14px] text-white placeholder-gray-500/80 focus:ring-0 min-h-[120px] resize-none leading-relaxed"
              placeholder="Add a personal note about how you're feeling today..."
            />
            <div className="absolute bottom-4 right-4 text-[11px] font-medium text-gray-600">
              {notes.length}/500
            </div>
          </div>
        </div>
      </main>

      {/* Save Button */}
      <div className="fixed bottom-0 left-0 right-0 z-40 p-6 bg-gradient-to-t from-background-dark via-background-dark to-transparent max-w-md mx-auto pointer-events-none">
        {saveError && <p role="alert" className="pointer-events-auto mb-3 rounded-xl bg-red-950 p-3 text-sm text-white">{saveError}</p>}
        <button
          onClick={handleSave}
          disabled={saving}
          className="pointer-events-auto w-full bg-[#B04E75] hover:bg-[#9c4266] text-white font-bold text-[16px] py-4 rounded-[20px] shadow-xl shadow-[#B04E75]/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          <div className="w-5 h-5 rounded-full bg-white text-[#B04E75] flex items-center justify-center">
            <span className="material-symbols-outlined text-[16px] font-bold">check</span>
          </div>
          {saving ? 'Saving…' : 'Save Log'}
        </button>
      </div>
    </div>
  );
};

export default LogDetails;
