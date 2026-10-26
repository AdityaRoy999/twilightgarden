export const DEMO_HISTORY_TAG = '[Sample history: twilight-demo-v1]';

/** Fictional historical fixtures. Never generates today's or future activity. */
export function buildDemoHistory(userId: string, anchor: string, days = 240) {
  const end = new Date(anchor + 'T00:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(anchor) || !Number.isFinite(end.getTime()) || end.toISOString().slice(0, 10) !== anchor || !Number.isInteger(days) || days < 1 || days > 730) throw new Error('Invalid demo history range');
  const dayMs = 86400000, oldest = end.getTime() - days * dayMs;
  const lengths = [28, 29, 27, 30, 28, 26, 29, 28];
  const starts = [end.getTime()];
  for (let i = 0; starts.at(-1)! > oldest; i++) starts.push(starts.at(-1)! - lengths[i % lengths.length] * dayMs);
  starts.reverse();
  return Array.from({ length: days }, (_, index) => {
    const timestamp = oldest + index * dayMs;
    const start = starts.filter(value => value <= timestamp).at(-1)!;
    const cycleDay = Math.round((timestamp - start) / dayMs) + 1;
    const sleep = 4.5 + (index * 7 % 10) / 2;
    const quality = sleep >= 7 ? 'good' : sleep >= 5 ? 'fair' : 'poor';
    const date = new Date(timestamp).toISOString().slice(0, 10);
    return {
      user_id: userId, date,
      flow: cycleDay <= 5 ? (['medium', 'heavy', 'medium', 'light', 'spotting'][cycleDay - 1]) : null,
      moods: [(['calm', 'happy', 'energetic', 'swings', 'sad', 'anxious'][index % 6])],
      symptoms: cycleDay <= 3 ? ['cramps', 'fatigue'] : cycleDay > 23 ? ['bloating', 'cravings'] : index % 7 === 0 ? ['headache'] : [],
      notes: `${DEMO_HISTORY_TAG} Fictional check-in for UI testing. ${['A quiet evening and some journaling.', 'Made time for a short walk.', 'A restful afternoon at home.', 'A busy day with time to unwind.'][index % 4]}`,
      sleep_hours: sleep, sleep_quality: quality,
      energy_level: index % 5 === 0 ? 'low' : quality === 'good' ? 'high' : 'medium',
      is_period_start: timestamp === start,
      created_at: `${date}T12:00:00+05:30`, encrypted_payload: null,
    };
  });
}
