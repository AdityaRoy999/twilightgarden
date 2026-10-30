import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { parseDateKey, localDateKey } from "./dates";
import { readPrivateRows } from "./privateData";
import { optionalVault } from "./vaultRuntime";

export function privateReminderDates(
  now: Date,
  settings: {
    lastPeriodStart: string;
    avgCycleLength: number;
    irregularCycle?: boolean;
  },
  logs: { date: string }[],
  prefs: {
    notifications_enabled?: boolean;
    period_notifications?: boolean;
    reminder_notifications?: boolean;
  },
) {
  if (prefs.notifications_enabled !== true) return [];
  const dates: Date[] = [];
  for (let offset = 0; offset < 7; offset++) {
    const date = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + offset,
      20,
    );
    if (date <= now) continue;
    const key = localDateKey(date);
    const daily =
      prefs.reminder_notifications !== false &&
      !logs.some((log) => log.date === key);
    let period = false;
    if (
      settings.lastPeriodStart &&
      !settings.irregularCycle &&
      prefs.period_notifications !== false
    ) {
      const start = parseDateKey(settings.lastPeriodStart);
      const expected = new Date(
        start.getFullYear(),
        start.getMonth(),
        start.getDate() + settings.avgCycleLength,
      );
      const days = Math.round(
        (Date.UTC(
          expected.getFullYear(),
          expected.getMonth(),
          expected.getDate(),
        ) -
          Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())) /
          86400000,
      );
      period = days >= 1 && days <= 3;
    }
    if (daily || period) dates.push(date);
  }
  return dates;
}
let revision = 0;
export async function schedulePrivateReminders(
  settings: Parameters<typeof privateReminderDates>[1],
  logs: { date: string }[],
) {
  if (!Capacitor.isNativePlatform() || !optionalVault()) return;
  const own = optionalVault()!.userId,
    version = ++revision;
  const prefs = (await readPrivateRows(own, "preferences"))[0] || {};
  if (version !== revision || optionalVault()?.userId !== own) return;
  if ((await LocalNotifications.checkPermissions()).display !== "granted")
    return;
  const dates = privateReminderDates(new Date(), settings, logs, prefs);
  await LocalNotifications.cancel({
    notifications: Array.from({ length: 7 }, (_, i) => ({ id: 710001 + i })),
  });
  if (version !== revision || !dates.length) return;
  await LocalNotifications.schedule({
    notifications: dates.map((at, i) => ({
      id: 710001 + i,
      title: "Twilight Garden",
      body: "You have a private reminder. Open the app to view it.",
      schedule: { at },
      extra: { url: "/dashboard" },
    })),
  });
}
