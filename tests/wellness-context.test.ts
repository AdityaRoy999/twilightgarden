import {expect,it} from 'vitest';
import {buildWellnessContext} from '../lib/wellnessContext';
import {wellnessGuidePrompt} from '../lib/wellnessGuide';
it('uses actual historical check-ins and excludes demo and future records',()=>{
 const ctx=buildWellnessContext({phase:'Luteal',cycleDay:20,today:'2026-10-27',logs:[
  {date:'2026-10-27',moods:['calm'],symptoms:['cramps'],energy_level:'low'},
  {date:'2026-10-26',moods:['happy'],sleep_quality:'good'},
  {date:'2026-10-25',notes:'[Sample history: twilight-demo-v1]',symptoms:['fake']},
  {date:'2026-10-28',moods:['future']},
 ]});
 expect(ctx.observedDays).toBe(2);expect(ctx.moods).toEqual(['calm']);expect(ctx.energyLevel).toBe('low');
 expect(ctx.logHistory).toContain('2026-10-26');expect(ctx.logHistory).not.toContain('fake');expect(ctx.logHistory).not.toContain('future');
});
it('bounds complete historical lines inside the live API prompt limit',()=>{
 const ctx=buildWellnessContext({phase:'Menstrual',cycleDay:2,today:'2026-10-27',logs:Array.from({length:50},(_,i)=>({date:new Date(Date.UTC(2026,9,26-i)).toISOString().slice(0,10),symptoms:Array.from({length:20},()=> 'a long logged symptom'),moods:['calm']}))});
 expect(ctx.logHistory!.length).toBeLessThanOrEqual(3500);expect(wellnessGuidePrompt(ctx,true).length).toBeLessThan(12000);
});
