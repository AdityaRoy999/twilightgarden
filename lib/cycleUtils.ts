import { CycleSettings, CyclePhase } from '../types';
import { calendarDayDifference } from './dates';

export const calculateCyclePhase = (dateStr: string, settings: CycleSettings): CyclePhase => {
    // Guard against missing/invalid lastPeriodStart
    if (!settings.lastPeriodStart) {
      return {
        currentDay: 1,
        phase: 'Follicular',
        nextPeriodIn: settings.avgCycleLength,
        isFertile: false,
        isOvulation: false
      };
    }

    // Safely extract just YYYY-MM-DD from both plain dates and timestamps
    const todayDateOnly = dateStr.split('T')[0];
    const startDateOnly = settings.lastPeriodStart.split('T')[0];

    // Parse as local midnight — both strings are now guaranteed YYYY-MM-DD
    const today = new Date(todayDateOnly + 'T00:00:00');
    const start = new Date(startDateOnly + 'T00:00:00');

    // Guard against invalid dates
    if (isNaN(today.getTime()) || isNaN(start.getTime())) {
      return {
        currentDay: 1,
        phase: 'Follicular',
        nextPeriodIn: settings.avgCycleLength,
        isFertile: false,
        isOvulation: false
      };
    }

    const msPerDay = 24 * 60 * 60 * 1000;
    const diffDays = calendarDayDifference(todayDateOnly, startDateOnly);

    // Cycle day should be 1-indexed (1 to avgCycleLength)
    const cycleLength = Math.max(20, Math.min(90, settings.avgCycleLength || 28));
    // A predicted period is not a recorded cycle start. Keep elapsed days intact.
    const dayOfCycle = Math.max(1, diffDays + 1);

    let phase: CyclePhase['phase'] = 'Follicular';
    let isFertile = false;
    let isOvulation = false;

    // Ovulation typically occurs ~14 days BEFORE next period
    const ovulationDay = Math.max(7, cycleLength - 14);
    const fertileStart = ovulationDay - 4;
    const fertileEnd = ovulationDay + 1;

    if (dayOfCycle <= settings.avgPeriodLength) {
      phase = 'Menstrual';
    } else if (dayOfCycle >= fertileStart && dayOfCycle <= fertileEnd) {
      phase = 'Follicular';
      isFertile = true;
      if (dayOfCycle === ovulationDay) {
        phase = 'Ovulation';
        isOvulation = true;
      }
    } else if (dayOfCycle > ovulationDay) {
      phase = 'Luteal';
    }

    const nextPeriodIn = cycleLength - dayOfCycle + 1;

    return {
      currentDay: dayOfCycle,
      phase,
      nextPeriodIn,
      overdueDays: Math.max(0, -nextPeriodIn),
      isFertile,
      isOvulation
    };
};
