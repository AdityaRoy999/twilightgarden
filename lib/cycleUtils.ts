import { CycleSettings, CyclePhase } from "../types";
import { calendarDayDifference } from "./dates";
import {predictCycle} from './cyclePrediction';

export function calculateCyclePhase(
  date: string,
  settings: CycleSettings,
  logs: readonly {
    date: string;
    periodStarted?: boolean;
    is_period_start?: boolean;
  }[] = [],
): CyclePhase {
  const unknown: CyclePhase = {
    currentDay: 0,
    phase: "Unknown",
    nextPeriodIn: 0,
    isFertile: false,
    isOvulation: false,
    hasEstimate: false,
    overdueDays: 0,
  };
  if(settings.estimatesPaused)return unknown;
  const start = [
    settings.lastPeriodStart,
    ...logs
      .filter((log) => log.periodStarted || log.is_period_start)
      .map((log) => log.date),
  ]
    .filter(
      (value) =>
        value &&
        value <= date &&
        Number.isFinite(calendarDayDifference(date, value)),
    )
    .sort()
    .at(-1);
  if (!start) return unknown;
  const elapsed = calendarDayDifference(date, start);
  if (!Number.isFinite(elapsed) || elapsed < 0) return unknown;
  const day = elapsed + 1;
  const prediction = predictCycle(settings, logs, date);
  const length = Number.isFinite(prediction.length)
    ? Math.max(20, Math.min(90, prediction.length))
    : 28;
  const period = Number.isFinite(prediction.periodLength)
    ? Math.max(1, Math.min(20, prediction.periodLength))
    : 5;
  if (settings.irregularCycle)
    return {
      ...unknown,
      currentDay: day,
      phase: day <= period ? "Menstrual" : "Unknown",
    };
  const next = length - elapsed,
    ovulation = Math.max(7, length - 14);
  let phase: CyclePhase["phase"] =
    day <= period
      ? "Menstrual"
      : day > length
        ? "Unknown"
        : day === ovulation
          ? "Ovulation"
          : day > ovulation
            ? "Luteal"
            : "Follicular";
  return {
    currentDay: day,
    phase,
    nextPeriodIn: next,
    overdueDays: Math.max(0, -next),
    hasEstimate: true,
    isFertile: day > period && day >= ovulation - 4 && day <= ovulation + 1,
    isOvulation: phase === "Ovulation",
  };
}
