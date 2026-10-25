/** Calendar dates are local values, not UTC timestamps. */
export function localDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function parseDateKey(value: string): Date {
  const key = value.split('T')[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return new Date(NaN);
  const [year, month, day] = key.split('-').map(Number);
  const result = new Date(year, month - 1, day);
  return localDateKey(result) === key ? result : new Date(NaN);
}

export function calendarDayDifference(later: string, earlier: string): number {
  const a = parseDateKey(later), b = parseDateKey(earlier);
  return Math.round((Date.UTC(a.getFullYear(), a.getMonth(), a.getDate()) - Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())) / 86400000);
}
