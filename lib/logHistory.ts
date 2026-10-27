import { parseDateKey } from "./dates";
import type { DailyLog } from "../types";

export type HistoryLog = Partial<DailyLog> & {
  date: string;
  note?: string;
  energy_level?: string;
  sleep_quality?: string;
  sleep_hours?: number;
  is_period_start?: boolean;
};
export function historyEntries(logs: readonly HistoryLog[]) {
  return logs
    .filter((log) => !Number.isNaN(parseDateKey(log.date).getTime()))
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));
}
export const historyKey = (log: HistoryLog) => log.id || log.date;
export function historyMood(log: HistoryLog) {
  const mood = log.moods?.[0]?.toLowerCase();
  const tone =
    ["calm", "relaxed", "energetic", "grateful"].includes(mood || "")
      ? "mint"
      : mood === "happy"
        ? "amber"
        : mood === "anxious" || mood === "sad"
          ? "lavender"
          : mood === "swings"
            ? "peach"
            : "rose";
  return {
    name: mood || "Not logged",
    tone,
    additional: Math.max(0, (log.moods?.length || 0) - 1),
  };
}
export function historyDetails(log: HistoryLog) {
  return {
    moods: [...new Set(log.moods || [])],
    symptoms: [...new Set(log.symptoms || [])],
    notes: log.notes ?? log.note ?? "",
    energy: log.energyLevel || log.energy_level,
    sleep: log.sleepQuality || log.sleep_quality,
    hours: log.sleepHours ?? log.sleep_hours,
    periodStarted: log.periodStarted || log.is_period_start || false,
  };
}
