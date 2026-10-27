import { calendarDayDifference, parseDateKey } from "./dates";
import { historyDetails, type HistoryLog } from "./logHistory";

/** Calendar copy for the supporter. Never infer an observed symptom from phase
 * or use fictional/future check-ins as evidence about the person. */
export function caregiverGuidance(logs: readonly HistoryLog[], today: string) {
  const latest = logs
    .filter(
      (log) =>
        log.date <= today &&
        calendarDayDifference(today, log.date) <= 7 &&
        !historyDetails(log).notes.startsWith("[Sample history:"),
    )
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!latest)
    return {
      body: "There is no recent personal check-in to guide you. Ask your partner how they feel and what would help today, rather than assuming from their cycle phase.",
      basis: "No recent shared check-in available.",
    };
  const details = historyDetails(latest),
    moods = details.moods.map((value) => value.toLowerCase()),
    symptoms = details.symptoms.map((value) => value.toLowerCase());
  const date =
    latest.date === today
      ? "today"
      : `on ${parseDateKey(latest.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  let body: string;
  if (details.energy === "low")
    body = `They logged low energy ${date}. Offer to take over a task or make room in your shared plans for a quiet break. Ask what would feel helpful now.`;
  else if (
    symptoms.some((value) =>
      ["cramps", "backache", "pelvic pain"].includes(value),
    )
  )
    body = `Their check-in ${date} includes ${symptoms.filter((value) => ["cramps", "backache", "pelvic pain"].includes(value)).join(" and ")}. Ask what would make them more comfortable, and offer practical help without pressure.`;
  else if (
    moods.some((value) =>
      ["sad", "anxious", "irritated", "swings"].includes(value),
    )
  )
    body = `They logged feeling ${moods.filter((value) => ["sad", "anxious", "irritated", "swings"].includes(value)).join(" and ")} ${date}. Ask whether they would like you to listen, spend quiet time together, or give them space.`;
  else if (details.sleep === "poor")
    body = `They reported poor sleep ${date}. Offer to handle a shared task or keep plans flexible, and ask whether they would welcome a quieter evening.`;
  else if (
    details.energy === "high" ||
    moods.some((value) => ["happy", "energetic"].includes(value))
  )
    body = `Their check-in ${date} includes ${details.energy === "high" ? "high energy" : moods.filter((value) => ["happy", "energetic"].includes(value)).join(" and ")}. Ask whether they would enjoy a walk or another activity together, and let them choose the pace.`;
  else
    body = `Read their shared check-in from ${latest.date === today ? "today" : parseDateKey(latest.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}, then ask what support they would like. Offer company or help with a task; let their answer guide you.`;
  return {
    body,
    basis:
      `Based on their shared check-in ${date}. ${latest.date === today ? "" : "How they feel today may have changed."}`.trim(),
  };
}
