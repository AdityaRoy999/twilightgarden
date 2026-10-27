import {calendarDayDifference,parseDateKey} from './dates';

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
 const durations=episodes.filter(episode=>episode.flowDates.size>0).map(episode=>episode.flowDates.size);
 return {historyData:intervals.slice(-6),stats:{avgCycle:intervals.length?Math.round(intervals.reduce((total,row)=>total+row.value,0)/intervals.length):settings?.avgCycleLength||28,avgPeriod:durations.length?Math.round(durations.reduce((total,value)=>total+value,0)/durations.length):settings?.avgPeriodLength||5}};
}
