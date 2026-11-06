import {calendarDayDifference,parseDateKey,localDateKey} from './dates';
import {predictCycle} from './cyclePrediction';

/** Shared by both Insights views so the same log history yields the same result.
 * Explicit period starts take precedence over the legacy flow-gap inference. */
export function cycleStatistics(logs:any[],settings?:{avgCycleLength?:number;avgPeriodLength?:number}) {
 const sorted=[...logs].filter(log=>Number.isFinite(parseDateKey(log.date).getTime())).sort((a,b)=>a.date.localeCompare(b.date));
 const explicit=[...new Set(sorted.filter(log=>log.periodStarted||log.is_period_start).map(log=>log.date))];
 const episodes:{start:string;end:string;flowDates:Set<string>}[]=[];
 for(const log of sorted){if(!log.flow&&!log.periodStarted&&!log.is_period_start)continue;
  let current=episodes.at(-1);
  if(!current||log.periodStarted||log.is_period_start||calendarDayDifference(log.date,current.end)>7){current={start:log.date,end:log.date,flowDates:new Set()};episodes.push(current);}
  if(log.flow)current.flowDates.add(log.date);current.end=log.date;
 }
 const starts=explicit.length?explicit:episodes.map(episode=>episode.start);
 const intervals=starts.slice(1).map((next,index)=>({value:calendarDayDifference(next,starts[index]),label:parseDateKey(starts[index]).toLocaleString('default',{month:'short'}),date:starts[index],endDate:next})).filter(row=>row.value>0);
 const prediction=predictCycle({avgCycleLength:settings?.avgCycleLength||28,avgPeriodLength:settings?.avgPeriodLength||5,lastPeriodStart:'',onboardingCompleted:true,irregularCycle:false},logs,localDateKey());
 return {historyData:intervals.filter(row=>row.value>=20&&row.value<=90).slice(-6),recordedFlowDays:episodes.map(episode=>episode.flowDates.size),closedPeriods:prediction.closedPeriods,stats:{avgCycle:prediction.length,avgPeriod:prediction.periodLength}};
}
