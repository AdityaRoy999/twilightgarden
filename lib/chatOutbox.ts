import type { Database } from "./database.types";
export type ChatSend =
  Database["public"]["Functions"]["send_chat_note"]["Args"];
export interface QueuedChat {
  params: ChatSend;
  createdAt: string;
}
export function readOutbox(userId: string, coupleId: string): QueuedChat[] {
  try {
    const data = JSON.parse(
      localStorage.getItem(`twilight-outbox:${userId}:${coupleId}`) || "[]",
    );
    return Array.isArray(data)
      ? data
          .filter(
            (v) =>
              v?.params?.p_couple === coupleId &&
              typeof v?.params?.p_id === "string" &&
              typeof v?.params?.p_content === "string",
          )
          .slice(-30)
      : [];
  } catch {
    return [];
  }
}
export function writeOutbox(
  userId: string,
  coupleId: string,
  entries: QueuedChat[],
) {
  const key = `twilight-outbox:${userId}:${coupleId}`;
  if (entries.length)
    localStorage.setItem(key, JSON.stringify(entries.slice(-30)));
  else localStorage.removeItem(key);
}
