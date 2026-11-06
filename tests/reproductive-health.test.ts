import { describe, it, expect } from "vitest";
import {
  pregnancyProgress,
  pregnancyStage,
  validateHealthEntry,
  validateHealthSettings,
  healthEntryAlerts,
  defaultHealthSettings,
  addCalendarDays,
  testReminderDate,
  type HealthEntry,
} from "../lib/reproductiveHealth";
import { predictCycle } from "../lib/cyclePrediction";
import { reproductiveReminderDates } from "../lib/reproductiveReminders";
import { calculateCyclePhase } from "../lib/cycleUtils";
const settings = {
  avgCycleLength: 28,
  avgPeriodLength: 5,
  lastPeriodStart: "2026-10-01",
  onboardingCompleted: true,
  irregularCycle: false,
};
const entry = (
  values: Record<string, string | number | boolean> = {},
  category: HealthEntry["category"] = "fertility",
): HealthEntry => ({
  id: "test",
  date: "2026-11-06",
  category,
  title: "",
  notes: "",
  values,
  shareWithPartner: false,
});
describe("gestational calendar and sensitive transitions", () => {
  it("starts before conception and uses 40 weeks rather than nine fixed months", () => {
    const p = { lmp: "2026-01-01", status: "active" as const };
    expect(pregnancyProgress(p, "2026-01-01")).toMatchObject({
      weeks: 0,
      day: 0,
      dueDate: "2026-10-08",
    });
    expect(pregnancyProgress(p, "2026-10-08")).toMatchObject({
      weeks: 40,
      day: 0,
      daysToDue: 0,
    });
  });
  it("uses clinician dating and advances exactly one local calendar day", () => {
    const p = {
      lmp: "2026-01-01",
      dueDate: "2026-10-10",
      status: "active" as const,
    };
    expect(pregnancyProgress(p, "2026-07-01")?.days).toBe(179);
    expect(pregnancyProgress(p, "2026-07-02")?.days).toBe(180);
  });
  it("does not show growth after loss, birth, pausing, invalid or future dating", () => {
    for (const status of ["loss", "ended", "birth", "paused"] as const)
      expect(
        pregnancyProgress({ lmp: "2026-01-01", status }, "2026-04-01"),
      ).toBeNull();
    expect(
      pregnancyProgress({ lmp: "2026-02-30", status: "active" }, "2026-04-01"),
    ).toBeNull();
    expect(
      pregnancyProgress({ lmp: "2027-01-01", status: "active" }, "2026-04-01"),
    ).toBeNull();
  });
  it("has distinct educational stages without inventing baby measurements", () => {
    expect(pregnancyStage(6).name).not.toBe(pregnancyStage(32).name);
    expect(pregnancyStage(0).detail).toContain("not happened");
  });
  it("rejects implausible due dates and future outcomes", () => {
    expect(() =>
      validateHealthSettings(
        {
          ...defaultHealthSettings,
          mode: "pregnancy",
          pregnancy: {
            lmp: "2026-10-01",
            dueDate: "2026-10-02",
            status: "active",
          },
        },
        "2026-11-06",
      ),
    ).toThrow();
    expect(() =>
      validateHealthSettings(
        {
          ...defaultHealthSettings,
          pregnancy: {
            lmp: "2026-01-01",
            status: "loss",
            outcomeDate: "2027-01-01",
          },
        },
        "2026-11-06",
      ),
    ).toThrow();
  });
  it("handles leap years and local date keys for testing windows", () => {
    expect(addCalendarDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(testReminderDate("2026-10-25")).toBe("2026-11-15");
  });
});
describe("observations and prediction consistency", () => {
  it("uses recorded history without reading future start markers", () => {
    const logs = [
      { date: "2026-08-01", periodStarted: true },
      { date: "2026-09-01", periodStarted: true },
      { date: "2026-10-01", periodStarted: true },
      { date: "2026-11-25", periodStarted: true },
    ];
    expect(predictCycle(settings, logs, "2026-10-02")).toMatchObject({
      length: 31,
      cycles: 2,
      min: 30,
      max: 31,
    });
    expect(calculateCyclePhase("2026-10-02", settings, logs).nextPeriodIn).toBe(
      30,
    );
  });
  it("does not infer the length of a period from missing log days", () => {
    const logs = [
      { date: "2026-10-01", periodStarted: true },
      { date: "2026-10-05", periodEnded: true },
    ];
    expect(predictCycle(settings, logs, "2026-10-06").periodLength).toBe(5);
    expect(predictCycle(settings, [logs[0]], "2026-10-06").closedPeriods).toBe(
      0,
    );
  });
  it("validates temperature, numeric fields and enum inputs", () => {
    expect(() =>
      validateHealthEntry(entry({ temperature: 37.14 }), "2026-11-06"),
    ).not.toThrow();
    for (const temperature of [NaN, 44, "37"])
      expect(() =>
        validateHealthEntry(entry({ temperature }), "2026-11-06"),
      ).toThrow();
    expect(() =>
      validateHealthEntry(entry({ lh: "Confirmed ovulation" }), "2026-11-06"),
    ).toThrow();
    expect(() =>
      validateHealthEntry(entry({ unknown: "field" }), "2026-11-06"),
    ).toThrow();
  });
  it("requires medication names and valid reminder dates/times", () => {
    expect(() =>
      validateHealthEntry(entry({}, "medication"), "2026-11-06"),
    ).toThrow();
    expect(() =>
      validateHealthEntry(
        entry({ date: "2026-02-30", time: "25:00" }, "reminder"),
        "2026-11-06",
      ),
    ).toThrow();
  });
  it("uses care escalation without diagnosing from symptoms", () => {
    expect(
      healthEntryAlerts(entry({ movement: "Less than usual" }, "pregnancy"))[0]
        .text,
    ).toContain("immediately");
    expect(healthEntryAlerts(entry({ test: "Positive" }))).toEqual([]);
  });
});
describe("private reminder scheduling", () => {
  it("deduplicates by date progression and rolls daily reminders forward", () => {
    const e = entry(
      { date: "2026-10-01", time: "10:30", repeat: "Daily" },
      "reminder",
    );
    const dates = reproductiveReminderDates(
      [e],
      defaultHealthSettings,
      new Date(2026, 10, 6, 11),
    );
    expect(dates).toHaveLength(6);
    expect(dates[0].at.getHours()).toBe(10);
    expect(dates[0].at.getDate()).toBe(7);
  });
  it("omits expired, deleted and paused pregnancy reminders", () => {
    const e = entry(
      {
        date: "2026-11-07",
        time: "10:30",
        repeat: "Once",
        purpose: "Pregnancy test",
      },
      "reminder",
    );
    expect(
      reproductiveReminderDates(
        [e],
        {
          ...defaultHealthSettings,
          pregnancy: { lmp: "2026-01-01", status: "loss" },
        },
        new Date(2026, 10, 6),
      ),
    ).toEqual([]);
    expect(
      reproductiveReminderDates(
        [{ ...e, deleted: true }],
        defaultHealthSettings,
        new Date(2026, 10, 6),
      ),
    ).toEqual([]);
  });
});
