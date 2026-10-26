import { expect, it } from 'vitest';
import { buildDemoHistory, DEMO_HISTORY_TAG } from '../lib/demoHistory';
it('generates varied, identifiable historical fixtures before the existing anchor', () => {
  const rows = buildDemoHistory('fixture-user', '2026-10-26', 240);
  expect(rows).toHaveLength(240);
  expect(new Set(rows.map(row => row.date)).size).toBe(240);
  expect(rows.every(row => row.date < '2026-10-26' && row.notes.startsWith(DEMO_HISTORY_TAG))).toBe(true);
  expect(new Set(rows.map(row => row.sleep_quality)).size).toBe(3);
  expect(rows.filter(row => row.is_period_start).length).toBeGreaterThan(7);
  expect(rows.filter(row => row.is_period_start).every(row => row.flow === 'medium')).toBe(true);
  expect(rows.some(row => row.flow === null)).toBe(true);
});
it('rejects rollover dates and produces valid leap-day history', () => {
  expect(() => buildDemoHistory('fixture', '2026-02-30')).toThrow();
  expect(() => buildDemoHistory('fixture', '2026-10-26', 10000)).toThrow();
  expect(buildDemoHistory('fixture', '2024-03-01', 2).map(row => row.date)).toEqual(['2024-02-28', '2024-02-29']);
});
