// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
vi.mock("../lib/privateData", () => ({ readPrivateRows: vi.fn() }));
import { privateReminderDates } from "../lib/privateReminders";
describe("device-only health reminders", () => {
  const settings = { lastPeriodStart: "2026-10-01", avgCycleLength: 28 };
  it("never schedules without explicit notification enablement", () => {
    expect(
      privateReminderDates(new Date(2026, 9, 26, 10), settings, [], {}),
    ).toEqual([]);
  });
  it("deduplicates a period and daily reminder and skips dates already logged", () => {
    const dates = privateReminderDates(
      new Date(2026, 9, 26, 10),
      settings,
      [{ date: "2026-10-29" }],
      { notifications_enabled: true },
    );
    expect(dates.length).toBe(6);
    expect(new Set(dates.map((x) => x.getTime())).size).toBe(6);
    expect(dates.every((x) => x.getHours() === 20)).toBe(true);
  });
  it("does not repeat an elapsed reminder or infer a period for irregular cycles", () => {
    expect(
      privateReminderDates(
        new Date(2026, 9, 26, 21),
        { ...settings, irregularCycle: true },
        [],
        { notifications_enabled: true, reminder_notifications: false },
      ),
    ).toEqual([]);
  });
});
