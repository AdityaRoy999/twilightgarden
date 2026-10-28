import React,{useId,useState,useEffect} from 'react';
import {Droplet,AppIcon} from './Icons';
import {SpringModal} from './SpringModal';
import {useAppMotion} from '../../hooks/useAppMotion';
import {useLocalClock} from '../../hooks/useLocalClock';
import {cycleRingModel} from '../../lib/cycleRing';
import {BotanicalBranch} from './BotanicalBranch';
const enteredRings=new Set<string>();

export function CycleBloom({day,length,periodLength=5,hasEstimate=true,introKey='cycle'}:{day:number;length:number;periodLength?:number;hasEstimate?:boolean;introKey?:string}){
 const id=useId().replace(/:/g,'');const now=useLocalClock();const {reduced}=useAppMotion();
 const [intro]=useState(()=>!enteredRings.has(introKey));const [info,setInfo]=useState(false);const [part,setPart]=useState(0);
 const [revealed,setRevealed]=useState(reduced||!intro);
 useEffect(()=>{enteredRings.add(introKey);if(reduced){setRevealed(true);return;}const timer=setTimeout(()=>setRevealed(true),1250);return()=>clearTimeout(timer);},[introKey,reduced]);
 const model=cycleRingModel(day,length,periodLength,now);
 const guides=[{title:'Your recorded period',text:`The pink arc spans the first ${model.periodDays} days in your saved typical period length. Each small dot marks the start of a cycle day. This is an estimate, not a record of flow on each day.`},{title:'The moving marker',text:'The white marker follows your current cycle day plus the time in your device’s time zone. At noon on day 2 it sits halfway between the day 2 and day 3 marks. It pauses at the end if your period is later than estimated.'},{title:'The rest of the cycle',text:'The lavender section marks the calendar-estimated ovulation day. Coral shows the estimated later (luteal) days; the pale track between your period and ovulation is the follicular interval. None confirms ovulation or pregnancy risk. A newly recorded period start resets day one; a prediction alone never does.'}];
 return <><div className={`cycle-bloom ${intro&&!reduced?'ring-first-entry':''}`}><div role="img" aria-label={hasEstimate?`Cycle day ${day} of an estimated ${length} days`:'No cycle estimate yet'}>
 <svg viewBox="0 0 280 280" aria-hidden="true">
 <defs><linearGradient id={`${id}-rose`}><stop stopColor="#f790b1"/><stop offset="1" stopColor="#df5d91"/></linearGradient><linearGradient id={`${id}-coral`}><stop stopColor="#ffb0a4"/><stop offset="1" stopColor="#ed8ea7"/></linearGradient><linearGradient id={`${id}-center`}><stop stopColor="var(--cycle-center-start,#fff2f6)"/><stop offset="1" stopColor="var(--cycle-center-end,#ffdce8)"/></linearGradient><clipPath id={`${id}-clip`}><circle cx="140" cy="140" r="95"/></clipPath><mask id={`${id}-reveal`}><circle className="ring-reveal" cx="140" cy="140" r="119" fill="none" stroke="white" strokeWidth="28" pathLength="100" strokeDasharray="101 101" strokeLinecap="round" transform="rotate(-90 140 140)"/></mask></defs>
 <g mask={revealed?undefined:`url(#${id}-reveal)`}><circle cx="140" cy="140" r="119" fill="none" stroke="var(--cycle-track)" strokeWidth="19"/>
 <g opacity={hasEstimate?1:0} transform="rotate(-90 140 140)" fill="none" strokeWidth="19" strokeLinecap="round">
 <circle cx="140" cy="140" r="119" stroke={`url(#${id}-rose)`} pathLength="100" strokeDasharray={`${model.periodPercent} ${100-model.periodPercent}`}/>
 <circle cx="140" cy="140" r="119" stroke="var(--cycle-lavender)" pathLength="100" strokeDasharray={`${model.ovulationPercent} 100`} strokeDashoffset={-model.ovulationStartPercent} opacity={model.ovulationPercent?1:0}/>
 <circle cx="140" cy="140" r="119" stroke={`url(#${id}-coral)`} pathLength="100" strokeDasharray={`${Math.max(0,100-model.lutealStartPercent)} 100`} strokeDashoffset={-model.lutealStartPercent}/></g>
 {hasEstimate&&model.dayMarks.map((angle,i)=><circle key={i} data-period-day={i+1} cx={140+Math.cos((angle-90)*Math.PI/180)*119} cy={140+Math.sin((angle-90)*Math.PI/180)*119} r="3" fill="white" opacity=".7"/>)}</g>
 <circle cx="140" cy="140" r="95" fill={`url(#${id}-center)`}/><path d="M36 165 Q85 125 140 165 T250 165 V250 H30Z" fill="var(--cycle-wave,#fbc5d8)" opacity=".38" clipPath={`url(#${id}-clip)`}/>
 {hasEstimate?<g className="cycle-live-marker" data-progress={model.progress} style={{transform:`rotate(${model.angle}deg)`,transformOrigin:'140px 140px'}}><circle cx="140" cy="21" r="15" fill="white" stroke="#df79a1" strokeWidth="2.5"/></g>:null}
 </svg><div className="cycle-bloom-label"><Droplet size={20}/><span>{hasEstimate?'Day':'Your cycle'}</span><strong>{hasEstimate?day:'—'}</strong><span>{hasEstimate?`of ${length}`:'One day at a time'}</span></div></div>
 <button className="cycle-info-button" aria-label="Explain the cycle ring" onClick={()=>setInfo(true)}><AppIcon name="info" size={20}/></button></div>
 <SpringModal open={info} onClose={()=>setInfo(false)} label="Understanding your cycle ring" className="cycle-guide-modal"><header><h2>Understanding your ring</h2><button aria-label="Close ring guide" onClick={()=>setInfo(false)}><AppIcon name="close" size={23}/></button></header><svg className="cycle-guide-diagram" viewBox="0 0 260 210" aria-hidden="true"><circle cx="130" cy="105" r="77" fill="none" stroke="var(--cycle-track)" strokeWidth="15"/><circle className={part===0?'guide-highlight':''} cx="130" cy="105" r="77" fill="none" stroke="#e57b9f" strokeWidth="16" pathLength="100" strokeDasharray="23 77" transform="rotate(-90 130 105)"/><circle className={part===2?'guide-highlight':''} cx="130" cy="105" r="77" fill="none" stroke="#c2abd8" strokeWidth="16" pathLength="100" strokeDasharray="36 64" transform="rotate(15 130 105)"/><g className={part===1?'guide-marker-demo':''} style={{transformOrigin:'130px 105px'}}><circle cx="130" cy="28" r="12" fill="white" stroke="#c86a91" strokeWidth="3"/></g><text x="130" y="110" textAnchor="middle" fill="var(--text-primary)" fontSize="18">{part===1?'Your local time':'Your cycle'}</text></svg><div className="cycle-guide-steps">{guides.map((guide,i)=><button key={guide.title} aria-pressed={part===i} onClick={()=>setPart(i)}>{i+1}</button>)}</div><h3>{guides[part].title}</h3><p>{guides[part].text}</p><small>Current device time zone: {Intl.DateTimeFormat().resolvedOptions().timeZone}</small></SpringModal></>;
}

export function BotanicalSprig({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 150 190" fill="none" aria-hidden="true"><BotanicalBranch/></svg>;
}
