import React,{useEffect,useMemo} from 'react';
import {useAuth} from '../../contexts/AuthContext';
import {useGeneratedText} from '../../hooks/useGeneratedText';
import {generateEmpathyAlerts,generateWellnessTips} from '../../lib/wellnessAI';
import {buildWellnessContext} from '../../lib/wellnessContext';
import {parseWellnessGuide} from '../../lib/wellnessGuide';
import {AppIcon} from '../ui/Icons';
import {waitingQuotes} from './GuidancePending';

export function DailyGuidance({phase,cycleDay,logs,today,partner=false}: {phase:string;cycleDay:number;logs:any[];today:string;partner?:boolean}) {
  const {user}=useAuth();
  const context=useMemo(()=>buildWellnessContext({phase,cycleDay,logs,today}),[phase,cycleDay,logs,today]);
  const guidance=useGeneratedText({daily:(refresh)=>partner?generateEmpathyAlerts(context,refresh):generateWellnessTips(context,refresh)},`${user?.id}:${partner}:${JSON.stringify(context)}`);
  useEffect(()=>{if(user?.id)void guidance.request('daily');},[guidance.request,user?.id]);
  const entry=guidance.entries.daily;
  const card=useMemo(()=>parseWellnessGuide(entry?.text||'')[0],[entry?.text]);
  return <section className="bloom-card bloom-insight daily-ai-guidance" aria-busy={entry?.status==='loading'}><span className="bloom-icon sunshine"><AppIcon name={partner?'favorite':'tips_and_updates'} size={27}/></span><div className="daily-ai-copy"><p className="bloom-eyebrow">{card ? card.title : 'A little care for today'}</p><p>{card?.body || waitingQuotes[0]}</p>{card ? <small>AI suggestion · based on available non-demo check-ins</small> : entry?.status==='error' ? <button className="text-primary text-xs mt-2" onClick={()=>void guidance.request('daily',true)}>Retry your AI tip</button> : <small>Prepared quote while your AI tip loads</small>}</div></section>;
}
