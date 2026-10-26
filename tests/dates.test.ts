import { describe, expect, it } from 'vitest';
import { calendarDayDifference, localDateKey, parseDateKey } from '../lib/dates';
import { calculateCyclePhase } from '../lib/cycleUtils';

const settings = { avgCycleLength:28,avgPeriodLength:5,lastPeriodStart:'2026-10-01',onboardingCompleted:true,irregularCycle:false };
describe('calendar dates and cycle estimates', () => {
  it('uses the local calendar day before UTC midnight', () => {
    const previous = process.env.TZ;
    try { process.env.TZ='Asia/Kolkata'; expect(localDateKey(new Date('2026-10-24T20:00:00Z'))).toBe('2026-10-25'); }
    finally { process.env.TZ=previous; }
  });
  it('counts calendar days across daylight-saving transitions', () => {
    const previous=process.env.TZ;
    try { process.env.TZ='America/New_York'; expect(calendarDayDifference('2026-03-09','2026-03-07')).toBe(2); }
    finally { process.env.TZ=previous; }
  });
  it('rejects nonexistent calendar dates', () => { expect(Number.isNaN(parseDateKey('2026-02-30').getTime())).toBe(true); });
  it('does not invent a new recorded cycle when a prediction passes', () => {
    const result=calculateCyclePhase('2026-11-10',settings);
    expect(result.currentDay).toBe(41); expect(result.nextPeriodIn).toBe(-12); expect(result.overdueDays).toBe(12);
    expect(result.isFertile).toBe(false);
  });
  it('starts a recorded cycle at day one', () => { const result=calculateCyclePhase('2026-10-01',settings); expect(result.currentDay).toBe(1); expect(result.phase).toBe('Menstrual'); });
  it('does not predict fertility or a next period for irregular cycles',()=>{const result=calculateCyclePhase('2026-10-14',{...settings,irregularCycle:true});expect(result.hasEstimate).toBe(false);expect(result.isFertile).toBe(false);expect(result.phase).toBe('Unknown');});
  it('does not fabricate history before a recorded start or from invalid dates',()=>{for(const date of ['2026-09-30','2026-02-30','invalid']){const result=calculateCyclePhase(date,settings);expect(result.currentDay).toBe(0);expect(result.hasEstimate).toBe(false);}});
  it('uses the latest explicit period start applicable to a historical calendar day',()=>{const logs=[{date:'2026-09-03',periodStarted:true},{date:'2026-09-05',flow:'medium'}];const result=calculateCyclePhase('2026-09-06',settings,logs);expect(result.currentDay).toBe(4);expect(result.phase).toBe('Menstrual');expect(calculateCyclePhase('2026-10-01',settings,logs).currentDay).toBe(1);});
});
