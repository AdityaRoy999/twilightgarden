import { localDateKey } from '../lib/dates';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { ModernSlider } from '../components/ui/ModernSlider';
import {useToday} from '../hooks/useToday';

const Onboarding: React.FC = () => {
  const navigate = useNavigate();
  const { updateSettings } = useData();
  const { user } = useAuth();
  const today=useToday();

  // Safety net: partners should never see onboarding (they don't track periods)
  React.useEffect(() => {
    if (user?.role === 'partner') {
      navigate('/partner/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const [step, setStep] = useState(0);

  // Data State
  const [lastPeriodDate, setLastPeriodDate] = useState<Date | null>(null);
  const [cycleLength, setCycleLength] = useState(28);
  const [periodLength, setPeriodLength] = useState(5);
  const [loading, setLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Calendar State
  const [viewDate, setViewDate] = useState(new Date());

  const handleNext = () => {
    setStep(prev => prev + 1);
  };

  const handleBack = () => {
    setStep(prev => prev - 1);
  };

  const handleFinish = async () => {
    if (!lastPeriodDate) return;
    if(localDateKey(lastPeriodDate)>today){setStep(1);setSaveError('Choose a period start date that is today or earlier.');return;}
    setLoading(true);
    setSaveError(null);
    try {
        const dateStr = localDateKey(lastPeriodDate);

        await updateSettings({
            avgCycleLength: cycleLength,
            avgPeriodLength: periodLength,
            lastPeriodStart: dateStr,
            onboardingCompleted: true
        });
        navigate('/');
    } catch (error) {
        setSaveError(error instanceof Error ? error.message : 'Could not save your settings. Please retry.');
    } finally {
        setLoading(false);
    }
  };

  // Calendar Helper
  const currentMonth = viewDate.toLocaleString('default', { month: 'long' });
  const currentYear = viewDate.getFullYear();
  const daysInMonth = new Date(currentYear, viewDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, viewDate.getMonth(), 1).getDay(); // 0 = Sunday
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const handleDayClick = (day: number) => {
    const newDate = new Date(currentYear, viewDate.getMonth(), day);
    setLastPeriodDate(newDate);
  };

  const isSelected = (day: number) => {
      if (!lastPeriodDate) return false;
      return lastPeriodDate.getDate() === day &&
             lastPeriodDate.getMonth() === viewDate.getMonth() &&
             viewDate.getFullYear() === lastPeriodDate.getFullYear();
  };

  return (
    <div className="font-display flex flex-col min-h-screen bg-background-dark text-white relative overflow-hidden">
      {/* Background Ambience */}
      <div className="fixed top-[-20%] right-[-20%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="fixed bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[100px] pointer-events-none"></div>

      {/* Header / Progress */}
      <header className="px-6 pt-8 pb-4 z-20 flex justify-between items-center">
          <div className="flex gap-2">
              {[0, 1, 2, 3].map((s) => (
                  <div key={s} className={`h-1.5 rounded-full transition-all duration-500 ${s <= step ? 'w-8 bg-primary' : 'w-2 bg-white/10'}`}></div>
              ))}
          </div>
          {step > 0 && <button onClick={handleBack} className="text-sm text-gray-400 hover:text-white">Back</button>}
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 z-10 w-full max-w-lg mx-auto">
        {saveError && <p role="alert" className="mb-4 rounded-xl bg-red-950 p-3 text-white">{saveError}</p>}
        <AnimatePresence mode="wait">

          {/* STEP 0: WELCOME */}
          {step === 0 && (
            <motion.div
               key="step0"
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, x: -20 }}
               className="text-center"
            >
                <div className="w-24 h-24 rounded-full bg-surface-dark border border-white/10 flex items-center justify-center shadow-2xl mx-auto mb-8 relative">
                   <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full"></div>
                   <span className="material-symbols-filled text-primary text-5xl relative z-10">waving_hand</span>
                </div>
                <h1 className="text-4xl font-bold mb-4">Welcome</h1>
                <p className="text-gray-400 text-lg leading-relaxed mb-12">
                    To give you accurate predictions, we need to know a little bit about your cycle history.
                </p>
                <button
                  onClick={handleNext}
                  className="w-full bg-white text-black font-bold py-4 rounded-2xl shadow-lg hover:bg-gray-100 transition-all active:scale-[0.98]"
                >
                    Let's Start
                </button>
            </motion.div>
          )}



          {/* REGULAR STEP 1: LAST PERIOD */}
          {step === 1 && (
            <motion.div
               key="step1"
               initial={{ opacity: 0, x: 20 }}
               animate={{ opacity: 1, x: 0 }}
               exit={{ opacity: 0, x: -20 }}
               className="w-full"
            >
                <h2 className="text-2xl font-bold mb-2 text-center">When did your last period start?</h2>
                <p className="text-gray-400 text-sm text-center mb-8">Select the first day of bleeding</p>

                <div className="bg-surface-dark rounded-3xl p-6 border border-white/5 shadow-soft">
                    {/* Calendar Header */}
                    <div className="flex justify-between items-center mb-6">
                        <button aria-label="Previous month" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth()-1, 1))} className="p-2 hover:bg-white/5 rounded-full"><span className="material-symbols-outlined">chevron_left</span></button>
                        <span className="font-bold text-lg">{currentMonth} {currentYear}</span>
                        <button aria-label="Next month" disabled={localDateKey(new Date(currentYear,viewDate.getMonth()+1,1))>today} onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth()+1, 1))} className="p-2 hover:bg-white/5 rounded-full disabled:cursor-not-allowed disabled:opacity-30"><span className="material-symbols-outlined">chevron_right</span></button>
                    </div>

                    {/* Grid */}
                    <div className="grid grid-cols-7 gap-y-2 mb-2">
                        {weekDays.map((d, i) => <div key={`day-${i}`} className="text-center text-xs text-gray-500 font-bold">{d}</div>)}
                    </div>
                    <div className="grid grid-cols-7 gap-y-2">
                        {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`empty-${i}`} />)}
                        {days.map(day => {
                            const selected = isSelected(day);
                            const date=localDateKey(new Date(currentYear,viewDate.getMonth(),day));
                            const future=date>today;
                            return (
                                <button
                                    key={day}
                                    aria-label={date}
                                    aria-pressed={selected}
                                    disabled={future}
                                    title={future?'Choose today or an earlier date':undefined}
                                    onClick={() => {setSaveError(null);handleDayClick(day);}}
                                    className={`h-10 w-10 mx-auto rounded-full flex items-center justify-center text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-25 ${selected ? 'bg-primary text-white shadow-lg shadow-primary/40 scale-110' : 'text-gray-300 hover:bg-white/5'}`}
                                >
                                    {day}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="mt-8">
                     <button
                        onClick={handleNext}
                        disabled={!lastPeriodDate}
                        className={`w-full py-4 rounded-2xl font-bold transition-all ${lastPeriodDate ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white/5 text-gray-500 cursor-not-allowed'}`}
                      >
                          Continue
                      </button>
                </div>
            </motion.div>
          )}

          {/* STEP 2: CYCLE LENGTH */}
          {step === 2 && (
            <motion.div
               key="step2"
               initial={{ opacity: 0, x: 20 }}
               animate={{ opacity: 1, x: 0 }}
               exit={{ opacity: 0, x: -20 }}
               className="w-full"
            >
                <div className="text-center mb-10">
                    <div className="w-16 h-16 rounded-2xl bg-teal-500/20 text-teal-400 flex items-center justify-center mx-auto mb-6">
                        <span className="material-symbols-outlined text-3xl">refresh</span>
                    </div>
                    <h2 className="text-2xl font-bold mb-2">How long is your cycle?</h2>
                    <p className="text-gray-400 text-sm">Usually between 21 and 35 days</p>
                </div>

                <div className="bg-surface-dark rounded-3xl p-8 border border-white/5 mb-8">
                     <ModernSlider
                        value={cycleLength}
                        min={20}
                        max={45}
                        onChange={setCycleLength}
                        unit="Days"
                     />
                </div>

                <button
                    onClick={handleNext}
                    className="w-full bg-primary text-white font-bold py-4 rounded-2xl shadow-lg shadow-primary/20 transition-all hover:bg-primary/90"
                >
                    Continue
                </button>
            </motion.div>
          )}

          {/* STEP 3: PERIOD LENGTH */}
          {step === 3 && (
            <motion.div
               key="step3"
               initial={{ opacity: 0, x: 20 }}
               animate={{ opacity: 1, x: 0 }}
               exit={{ opacity: 0, x: -20 }}
               className="w-full"
            >
                <div className="text-center mb-10">
                    <div className="w-16 h-16 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center mx-auto mb-6">
                        <span className="material-symbols-outlined text-3xl">water_drop</span>
                    </div>
                    <h2 className="text-2xl font-bold mb-2">How long does it last?</h2>
                    <p className="text-gray-400 text-sm">Usually between 3 and 7 days</p>
                </div>

                <div className="bg-surface-dark rounded-3xl p-8 border border-white/5 mb-8">
                     <ModernSlider
                        value={periodLength}
                        min={2}
                        max={10}
                        onChange={setPeriodLength}
                        unit="Days"
                     />
                </div>

                <button
                    onClick={handleFinish}
                    disabled={loading}
                    className="w-full bg-white text-black font-bold py-4 rounded-2xl shadow-lg hover:bg-gray-100 transition-all flex items-center justify-center gap-2"
                >
                    {loading ? <span className="material-symbols-outlined animate-spin">progress_activity</span> : "Finish Setup"}
                </button>
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  );
};

export default Onboarding;
