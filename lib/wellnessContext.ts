import type { WellnessContext } from './wellnessAI';

export function buildWellnessContext({phase,cycleDay,logs,today,partnerName}: {phase:string;cycleDay:number;logs:any[];today:string;partnerName?:string}): WellnessContext {
  // Demo records are useful for exploring charts, but must never be presented
  // to the model as the person's actual health observations.
  const actual = logs.filter(log=>typeof log.date==='string' && log.date<=today && !log.notes?.startsWith('[Sample history:')).sort((a,b)=>b.date.localeCompare(a.date));
  const current=actual.find(log=>log.date===today);
  const history=actual.filter(log=>log.date!==today).slice(0,30);
  const lines:string[]=[];
  for(const log of history){const line=`${log.date}: moods=${(log.moods||[]).join('/')||'unknown'}; symptoms=${(log.symptoms||[]).join('/')||'unknown'}; sleep=${log.sleepQuality||log.sleep_quality||'unknown'}; energy=${log.energyLevel||log.energy_level||'unknown'}`;if(lines.join('\n').length+line.length>3500)break;lines.push(line);}
  return {phase,cycleDay,partnerName,moods:current?.moods||[],symptoms:current?.symptoms||[],sleepQuality:current?.sleepQuality||current?.sleep_quality,energyLevel:current?.energyLevel||current?.energy_level,logHistory:lines.length?lines.join('\n'):'No prior non-demo observations available.',observedDays:actual.length};
}
