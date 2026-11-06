import type { CycleSettings } from "../types";
import { calendarDayDifference } from "./dates";
type Observation = {
  date: string;
  periodStarted?: boolean;
  is_period_start?: boolean;
  periodEnded?: boolean;
};
export function predictCycle(
  settings: CycleSettings,
  logs: readonly Observation[],
  asOf: string,
) {
  const starts = [
    ...new Set(
      [
        settings.lastPeriodStart,
        ...logs
          .filter((l) => l.periodStarted || l.is_period_start)
          .map((l) => l.date),
      ].filter(
        (d) =>
          d && d <= asOf && Number.isFinite(calendarDayDifference(asOf, d)),
      ),
    ),
  ].sort();
  const intervals = starts
    .slice(1)
    .map((d, i) => calendarDayDifference(d, starts[i]))
    .filter((n) => n >= 20 && n <= 90)
    .slice(-6)
    .sort((a, b) => a - b);
  const middle = Math.floor(intervals.length / 2),
    length = intervals.length
      ? Math.round(
          intervals.length % 2
            ? intervals[middle]
            : (intervals[middle - 1] + intervals[middle]) / 2,
        )
      : settings.avgCycleLength;
  const variability =
    intervals.length > 1 ? intervals.at(-1)! - intervals[0] : 0;
  const durations = starts
    .map((start, i) => {
      const end = logs
        .filter(
          (l) =>
            l.periodEnded &&
            l.date >= start &&
            l.date <= asOf &&
            (!starts[i + 1] || l.date < starts[i + 1]),
        )
        .map((l) => l.date)
        .sort()[0];
      return end ? calendarDayDifference(end, start) + 1 : 0;
    })
    .filter((n) => n >= 1 && n <= 20)
    .slice(-6)
    .sort((a, b) => a - b);
  const mid = Math.floor(durations.length / 2),
    periodLength = durations.length
      ? Math.round(
          durations.length % 2
            ? durations[mid]
            : (durations[mid - 1] + durations[mid]) / 2,
        )
      : settings.avgPeriodLength;
  return {
    length,
    periodLength,
    closedPeriods: durations.length,
    cycles: intervals.length,
    min: intervals.length > 1 ? intervals[0] : Math.max(20, length - 3),
    max: intervals.length > 1 ? intervals.at(-1)! : length + 3,
    variability,
    source: intervals.length ? ("observed" as const) : ("configured" as const),
  };
}
