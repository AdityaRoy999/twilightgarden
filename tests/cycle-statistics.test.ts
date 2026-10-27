import {expect,it} from 'vitest';
import {cycleStatistics} from '../lib/cycleStatistics';
it('uses explicit start markers even when flow was not logged on the first day',()=>{
 const stats=cycleStatistics([{date:'2026-03-01',is_period_start:true},{date:'2026-03-02',flow:'light'},{date:'2026-03-29',periodStarted:true},{date:'2026-03-30',flow:'medium'}]);
 expect(stats.stats.avgCycle).toBe(28);expect(stats.historyData[0].value).toBe(28);
});
it('does not turn missing logging days into recorded flow days',()=>{
 expect(cycleStatistics([{date:'2026-03-01',flow:'light'},{date:'2026-03-05',flow:'light'}]).stats.avgPeriod).toBe(2);
});
it('uses configured values when there are no observations',()=>{
 expect(cycleStatistics([],{avgCycleLength:35,avgPeriodLength:6}).stats).toEqual({avgCycle:35,avgPeriod:6});
});
