import { expect, it, vi } from 'vitest';
vi.mock('../lib/supabase', () => ({supabase:{}}));
import { analyzeSleepEnergyCorrelations } from '../lib/wellnessAI';

it('uses only paired valid observations as the correlation denominator', () => {
  const result = analyzeSleepEnergyCorrelations([
    {sleepQuality:'good',energyLevel:'high'},
    {sleep_quality:'good',energy_level:'high'},
    {sleepQuality:'poor',energyLevel:'low'},
    ...Array.from({length:10},()=>({sleepQuality:'good'})),
    {sleepQuality:'good',energyLevel:'unknown'},
  ]);
  expect(result.totalWithBoth).toBe(3);
  expect(result.sleepCounts.good).toBe(13);
  expect(result.insights.join(' ')).toContain('high energy 100%');
  expect(result.insights.join(' ')).toContain('low energy 100%');
  expect(result.sleepEnergyMap.good).toEqual({high:2,medium:0,low:0});
});
it('does not invent a relationship without enough paired observations', () => {
  const result = analyzeSleepEnergyCorrelations([{sleepQuality:'good'},{energyLevel:'high'}]);
  expect(result.totalWithBoth).toBe(0);
  expect(result.insights.join(' ')).not.toContain('%');
});
