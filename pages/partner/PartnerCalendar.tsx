import React, { useState } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isToday } from 'date-fns';
import { useCouples } from '../../contexts/CouplesContext';
import LogDetailsModal from '../../components/LogDetailsModal';
import { calculateCyclePhase } from '../../lib/cycleUtils';

const PartnerCalendar: React.FC = () => {
    const { couple, partnerData } = useCouples();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedLogForModal, setSelectedLogForModal] = useState<{log: any | null, date: string} | null>(null);

    // If not connected, show a placeholder
    if (!couple) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-background-dark">
                <span className="material-symbols-outlined text-5xl text-gray-300 mb-4">event_busy</span>
                <h2 className="text-xl font-bold mb-2 text-white">No Partner Connected</h2>
                <p className="text-gray-500 text-sm">Connect with a partner to view their cycle calendar.</p>
            </div>
        );
    }

    // Default values if partner data is missing
    const logs = partnerData?.logs || [];
    const cycleSettings = partnerData?.settings || {
        avg_cycle_length: 28,
        avg_period_length: 5,
        last_period_start: '',
    };

    const mappedSettings = {
        // Defensive mapping: check both camelCase (from context mapping) and snake_case (direct fallback)
        avgCycleLength: cycleSettings.avgCycleLength || cycleSettings.avg_cycle_length || 28,
        avgPeriodLength: cycleSettings.avgPeriodLength || cycleSettings.avg_period_length || 5,
        lastPeriodStart: cycleSettings.lastPeriodStart || cycleSettings.last_period_start || '',
        onboardingCompleted: true,
        irregularCycle: cycleSettings.irregularCycle || cycleSettings.irregular_cycle || false
    };

    // SMART FALLBACK: If lastPeriodStart is missing, derive it from logs
    if (!mappedSettings.lastPeriodStart && logs.length > 0) {
        const latestFlowLog = [...logs].sort((a,b) => b.date.localeCompare(a.date)).find((l: any) => l.is_period_start||l.periodStarted);
        if (latestFlowLog) {
            mappedSettings.lastPeriodStart = latestFlowLog.date;
        }
    }

    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
    const handleToday = () => setCurrentDate(new Date());

    const days = eachDayOfInterval({
        start: startOfMonth(currentDate),
        end: endOfMonth(currentDate)
    });

    const startDay = startOfMonth(currentDate).getDay();
    const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    const yestDate = new Date(today);
    yestDate.setDate(today.getDate() - 1);
    const yestStr = format(yestDate, 'yyyy-MM-dd');

    const todayLog = logs.find((l: any) => l.date === todayStr);
    const yestLog = logs.find((l: any) => l.date === yestStr);

    const getDayStatus = (date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const log = logs.find((l: any) => l.date === dateStr);
        const phase = calculateCyclePhase(dateStr, mappedSettings,logs);
        return {
            isPeriod: !!(log?.flow && log.flow !== 'spotting'),
            isFertile: phase.isFertile,
            isOvulation: phase.isOvulation,
            isPredicted: phase.phase === 'Menstrual' && !log
        };
    };

    const todayPhase = calculateCyclePhase(todayStr, mappedSettings,logs);

    const phaseDescriptions: Record<string, string> = {
        Menstrual: "Low energy. Focus on rest and introspection.",
        Follicular: "Rising energy. Great time for creativity and new projects.",
        Ovulation: "Peak energy & confidence. Socialize and tackle hard tasks.",
        Luteal: "Winding down. Good for administrative tasks and decluttering."
    };

    const handleOpenModal = (log: any | null, date: string) => {
        setSelectedLogForModal({ log, date });
        setIsModalOpen(true);
    };

    return (
        <div className="animate-slideIn font-display">
            <LogDetailsModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                log={selectedLogForModal?.log || null} 
                date={selectedLogForModal?.date || ''} 
                readOnly={true}
            />
            <header className="sticky top-0 z-30 bg-background-dark/80 backdrop-blur-md px-6 py-4 flex items-center justify-between border-b border-white/5">
                <div>
                    <h2 className="text-xl font-bold leading-tight tracking-tight text-white">Calendar</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                        Viewing {partnerData?.profile?.full_name || 'Partner'}'s cycle
                    </p>
                </div>
                <button 
                    onClick={handleToday}
                    className="group flex items-center justify-center gap-1.5 pl-3 pr-4 py-1.5 rounded-full bg-surface-dark border border-white/10 hover:border-primary/50 shadow-sm transition-all active:scale-95"
                >
                    <span className="material-symbols-outlined text-primary text-lg">calendar_today</span>
                    <span className="text-white text-xs font-bold uppercase tracking-wide">Today</span>
                </button>
            </header>

            <main className="flex flex-col gap-6 px-4 pb-32 max-w-md mx-auto w-full pt-4">
                {/* Calendar Card */}
                <div className="bg-surface-dark rounded-3xl shadow-soft p-5 relative overflow-hidden border border-white/5">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-8 relative z-20">
                        <button 
                            onClick={prevMonth}
                            className="p-2 -ml-2 text-white hover:bg-white/5 rounded-full transition-colors"
                        >
                            <span className="material-symbols-outlined">chevron_left</span>
                        </button>
                        <div className="flex flex-col items-center">
                            <span className="text-lg font-bold text-white">{format(currentDate, 'MMMM')} {format(currentDate, 'yyyy')}</span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-ovulation"></div>
                                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                                    Cycle Day {todayPhase.currentDay}
                                </span>
                            </div>
                        </div>
                        <button 
                            onClick={nextMonth}
                            className="p-2 -mr-2 text-white hover:bg-white/5 rounded-full transition-colors"
                        >
                            <span className="material-symbols-outlined">chevron_right</span>
                        </button>
                    </div>

                    {/* Week Headers */}
                    <div className="grid grid-cols-7 mb-4 relative z-20">
                        {weekDays.map((d, i) => (
                            <div key={i} className="text-center text-[10px] font-bold text-gray-500 uppercase tracking-widest pb-2">
                                {d}
                            </div>
                        ))}
                    </div>

                    {/* Grid */}
                    <div className="grid grid-cols-7 gap-y-3 relative z-20">
                        {Array.from({ length: startDay }).map((_, i) => (
                            <div key={`pad-${i}`} className="h-10"></div>
                        ))}

                        {days.map((day) => {
                            const dateStr = format(day, 'yyyy-MM-dd');
                            const isFuture = dateStr > todayStr;
                            const status = getDayStatus(day);
                            const isPeriod = status.isPeriod;
                            const isFertile = status.isFertile;
                            const isOvulation = status.isOvulation;
                            const isPredicted = status.isPredicted;
                            const logForDay = logs.find((l: any) => l.date === dateStr);
                            const dayNum = parseInt(format(day, 'd'));

                            return (
                                <button
                                    key={dayNum}
                                    disabled={isFuture}
                                    onClick={() => {
                                        if (isFuture) return;
                                        handleOpenModal(logForDay || null, dateStr);
                                    }}
                                    className={`h-10 w-full flex flex-col items-center justify-center relative group rounded-xl transition-all active:scale-95 hover:bg-white/5 ${isFuture ? 'opacity-30 pointer-events-none' : ''}`}
                                >
                                    {isPeriod ? (
                                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/40 relative z-10">
                                            <span className="text-sm font-bold text-white">{dayNum}</span>
                                        </div>
                                    ) : isOvulation ? (
                                        <>
                                            <div className="absolute w-9 h-9 border-2 border-ovulation rounded-full shadow-[0_0_10px_rgba(255,230,109,0.3)]"></div>
                                            <span className="material-symbols-filled absolute text-ovulation text-[28px] opacity-20 top-0.5">
                                                brightness_high
                                            </span>
                                            <span className="text-sm font-bold text-white z-10">{dayNum}</span>
                                            <div className="absolute bottom-0.5 w-1 h-1 rounded-full bg-ovulation"></div>
                                        </>
                                    ) : isPredicted ? (
                                        <div className="w-8 h-8 rounded-full border-2 border-dashed border-primary/60 flex items-center justify-center">
                                            <span className="text-sm font-medium text-white">{dayNum}</span>
                                        </div>
                                    ) : (
                                        <>
                                            <span className={`text-sm font-medium ${isFertile ? 'text-white z-10' : 'text-gray-400'}`}>
                                                {dayNum}
                                            </span>
                                            {isFertile && (
                                                <div className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-fertile shadow-[0_0_8px_rgba(78,205,196,0.8)]"></div>
                                            )}
                                            {/* Log Presence Indicator: Tiny white dot if data exists but not in a primary phase */}
                                            {!isPeriod && !isOvulation && !isFertile && logForDay && (
                                                <div className="absolute bottom-1 w-1 h-1 rounded-full bg-white/40"></div>
                                            )}
                                        </>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Legend */}
                    <div className="mt-8 pt-5 border-t border-white/10 flex justify-center gap-6 relative z-20">
                        <div className="flex items-center gap-2 opacity-90">
                            <div className="w-2.5 h-2.5 rounded-full bg-primary shadow-[0_0_8px_rgba(209,77,114,0.6)]"></div>
                            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wide">Period</span>
                        </div>
                        <div className="flex items-center gap-2 opacity-90">
                            <div className="w-2.5 h-2.5 rounded-full bg-fertile shadow-[0_0_8px_rgba(78,205,196,0.6)]"></div>
                            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wide">Fertile</span>
                        </div>
                        <div className="flex items-center gap-2 opacity-90">
                            <div className="w-2.5 h-2.5 rounded-full bg-ovulation shadow-[0_0_8px_rgba(255,230,109,0.6)]"></div>
                            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wide">Ovulation</span>
                        </div>
                    </div>

                    {/* Bg Blobs */}
                    <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none z-0"></div>
                    <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-fertile/5 rounded-full blur-3xl pointer-events-none z-0"></div>
                </div>

                {/* Logged Today/Yesterday Sections (Read Only) */}
                {[
                    { label: 'Logged Today', log: todayLog, date: todayStr },
                    { label: 'Logged Yesterday', log: yestLog, date: yestStr }
                ].map((item, idx) => (
                    item.log && (item.log.flow || (item.log.moods && item.log.moods.length > 0) || (item.log.symptoms && item.log.symptoms.length > 0)) && (
                        <div key={idx} className="animate-slideIn" onClick={() => handleOpenModal(item.log || null, item.date)}>
                            <div className="flex items-center justify-between px-2 mb-3">
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{item.label}</span>
                            </div>
                            
                            <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none cursor-pointer">
                                {/* Flow Chip */}
                                {item.log.flow && (
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/5 rounded-full shrink-0">
                                        <div className="w-2 h-2 rounded-full bg-primary/80"></div>
                                        <span className="text-sm text-gray-200 capitalize">{item.log.flow}</span>
                                    </div>
                                )}

                                {/* Mood Chips */}
                                {item.log.moods?.map((mood: string) => (
                                    <div key={mood} className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/5 rounded-full shrink-0">
                                        <span className="text-sm">🙂</span>
                                        <span className="text-sm text-gray-200 capitalize">{mood}</span>
                                    </div>
                                ))}

                                {/* Symptom Chips */}
                                {item.log.symptoms?.map((sym: string) => (
                                    <div key={sym} className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/5 rounded-full shrink-0">
                                        <span className="material-symbols-outlined text-[16px] text-purple-300">monitor_heart</span>
                                        <span className="text-sm text-gray-200 capitalize">{sym}</span>
                                    </div>
                                ))}

                                {/* Energy Chip */}
                                {item.log.energyLevel && (
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/5 rounded-full shrink-0">
                                        <span className="material-symbols-outlined text-[16px] text-yellow-500">bolt</span>
                                        <span className="text-sm text-gray-200 capitalize">{item.log.energyLevel}</span>
                                    </div>
                                )}

                                {/* Sleep Chip */}
                                {item.log.sleepQuality && (
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/5 rounded-full shrink-0">
                                        <span className="material-symbols-outlined text-[16px] text-indigo-400">bedtime</span>
                                        <span className="text-sm text-gray-200 capitalize">{item.log.sleepQuality} {item.log.sleepHours ? `(${item.log.sleepHours}h)` : ''}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                ))}

                {/* Cycle Forecast Card */}
                <div className="bg-surface-dark rounded-3xl p-6 border border-white/5 relative overflow-hidden">
                    <div className="flex items-center gap-3 mb-4 relative z-10">
                        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-primary border border-white/10">
                            <span className="material-symbols-filled text-xl">temp_preferences_custom</span>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">Current Phase</h3>
                            <div className="flex items-center gap-2">
                                <span className="text-primary font-bold text-sm uppercase tracking-wider">{todayPhase.phase}</span>
                                <span className="text-gray-500 text-xs">• Day {todayPhase.currentDay}</span>
                            </div>
                        </div>
                    </div>
                    
                    <p className="text-gray-300 text-sm leading-relaxed relative z-10">
                        {phaseDescriptions[todayPhase.phase] || "Track your symptoms to get better insights."}
                    </p>

                    {todayPhase.nextPeriodIn > 0 && (
                        <div className="mt-4 pt-4 border-t border-white/5 relative z-10 flex items-center gap-2 text-xs font-medium text-gray-400">
                            <span className="material-symbols-outlined text-base">event</span>
                            Next period in <span className="text-white">{todayPhase.nextPeriodIn} days</span>
                        </div>
                    )}

                    {/* Blob */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-10 -mt-10"></div>
                </div>
            </main>
        </div>
    );
};

export default PartnerCalendar;
