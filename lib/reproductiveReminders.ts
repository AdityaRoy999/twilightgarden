import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { readPrivateRows } from "./privateData";
import { optionalVault } from "./vaultRuntime";
import {
  addCalendarDays,
  type HealthEntry,
  type HealthSettings,
} from "./reproductiveHealth";
import { localDateKey, parseDateKey } from "./dates";
export function reproductiveReminderDates(
  entries: HealthEntry[],
  settings: HealthSettings,
  now = new Date(),
) {
  const items: { id: string; at: Date }[] = [];
  for (const e of entries) {
    if (e.deleted || !["appointment", "reminder"].includes(e.category))
      continue;
    if (
      e.values.purpose === "Pregnancy test" &&
      settings.pregnancy &&
      settings.pregnancy.status !== "active" &&
      settings.mode !== "conceive"
    )
      continue;
    const date = String(e.values.date || "");
    if (!Number.isFinite(parseDateKey(date).getTime())) continue;
    const time = String(e.values.time || "09:00");
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) continue;
    const daily = e.category === "reminder" && e.values.repeat === "Daily";
    const start = daily && date < localDateKey(now) ? localDateKey(now) : date;
    for (let i = 0; i < (daily ? 7 : 1); i++) {
      const at = parseDateKey(addCalendarDays(start, i)),
        [h, m] = time.split(":").map(Number);
      at.setHours(h, m, 0, 0);
      if (at > now && at.getTime() - now.getTime() <= 32 * 86400000)
        items.push({ id: e.id, at });
    }
  }
  return items.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, 40);
}
let revision = 0;
export async function scheduleReproductiveReminders(
  entries: HealthEntry[],
  settings: HealthSettings,
) {
  if (!Capacitor.isNativePlatform() || !optionalVault()) return;
  const own = optionalVault()!.userId,
    epoch = optionalVault()!.epoch,
    version = ++revision;
  const prefs = (await readPrivateRows(own, "preferences"))[0] || {};
  if (version !== revision || optionalVault()?.epoch !== epoch) return;
  await LocalNotifications.cancel({
    notifications: Array.from({ length: 40 }, (_, i) => ({ id: 720001 + i })),
  });
  if (
    prefs.notifications_enabled !== true ||
    (await LocalNotifications.checkPermissions()).display !== "granted"
  )
    return;
  const dates = reproductiveReminderDates(entries, settings);
  if (version !== revision || optionalVault()?.epoch !== epoch) return;
  if (dates.length)
    await LocalNotifications.schedule({
      notifications: dates.map(({ at }, i) => ({
        id: 720001 + i,
        title: "Twilight Garden",
        body: "You have a private reminder. Open your journal to view it.",
        schedule: { at },
        extra: { url: "/health?section=reminder" },
      })),
    });
}
