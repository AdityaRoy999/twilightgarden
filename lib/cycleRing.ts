/** Civil clock progress: local noon is halfway between two calendar day marks.
 * Never wrap an overdue cycle to day one or present it as a new observed period. */
export function cycleRingModel(day:number,length:number,period:number,now:Date){
 const total=Number.isFinite(length)?Math.max(1,Math.round(length)):28;
 const periodDays=Math.max(1,Math.min(total,Number.isFinite(period)?Math.round(period):5));
 const localFraction=(now.getHours()*3600+now.getMinutes()*60+now.getSeconds()+now.getMilliseconds()/1000)/86400;
 const progress=Math.max(0,Math.min(1,(Math.max(1,day)-1+localFraction)/total));
 const ovulationDay=Math.max(7,total-14),validOvulation=ovulationDay>periodDays&&ovulationDay<=total;
 return {length:total,periodDays,progress,angle:progress*360,periodPercent:100*periodDays/total,ovulationStartPercent:validOvulation?(ovulationDay-1)/total*100:0,ovulationPercent:validOvulation?100/total:0,lutealStartPercent:Math.max(periodDays,ovulationDay)/total*100,dayMarks:Array.from({length:periodDays},(_,i)=>i/total*360),overdue:day>total};
}
