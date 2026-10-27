import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {exercises,exerciseSuggestions,exerciseVideoSearch} from '../lib/exercises';
it('ships 44 distinct original two-position exercise sets with local illustrations and guidance links',()=>{
 expect(exercises).toHaveLength(44);expect(new Set(exercises.map(ex=>ex.id)).size).toBe(44);
 const hashes=exercises.map(ex=>{const svg=readFileSync(`public${ex.art}`,'utf8');expect(svg).not.toMatch(/<script|<image|https?:\/\/(?!www.w3.org)/);expect(svg).toContain('Easy range');expect(readFileSync(`public${ex.art.replace('.svg','.dark.svg')}`,'utf8')).not.toEqual(svg);expect(new URL(ex.source).hostname).toBe('www.nhs.uk');expect(exerciseVideoSearch(ex)).toContain('https://www.youtube.com/results?search_query=');return createHash('sha256').update(svg.replace(/<title>.*?<\/title>/,'')).digest('hex');});
 expect(new Set(hashes).size).toBe(44);
});
it('excludes fictional, future and old logs from personalization',()=>{
 const result=exerciseSuggestions([{date:'2026-10-27',notes:'[Sample history: twilight-demo-v1]',energyLevel:'low'},{date:'2026-10-28',symptoms:['dizziness']},{date:'2026-09-01',energyLevel:'low'}],'2026-10-27');
 expect(result.observedDays).toBe(0);expect(result.reason).toContain('not personalized');
});
it('prefers easy seated movements for low energy and a pause for logged dizziness',()=>{
 const low=exerciseSuggestions([{date:'2026-10-27',energyLevel:'low'}],'2026-10-27');expect(low.selected.every(ex=>ex.effort==='easy'&&['Seated','Breathing'].includes(ex.category))).toBe(true);
 const dizzy=exerciseSuggestions([{date:'2026-10-27',symptoms:['dizziness']}],'2026-10-27');expect(dizzy.selected.map(ex=>ex.id)).toEqual(['seated-breathe']);
});
