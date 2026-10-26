import type { SharedNote } from "../types";
const rank = { sent: 1, delivered: 2, read: 3 };
export function mergeChatNotes(
  current: SharedNote[],
  incoming: SharedNote[],
  userId: string,
): SharedNote[] {
  const notes = new Map(current.map((note) => [note.id, note]));
  for (const note of incoming) {
    const previous = notes.get(note.id);
    if (note.deleted_by?.includes(userId)) {
      notes.delete(note.id);
      continue;
    }
    const status =
      previous && rank[previous.status] > rank[note.status]
        ? previous.status
        : note.status;
    notes.set(note.id, {
      ...previous,
      ...note,
      status,
      localStatus: undefined,
    });
  }
  return [...notes.values()].sort(
    (a, b) =>
      a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
  );
}
export function cursorFilter(
  note: Pick<SharedNote, "id" | "created_at">,
): string {
  if (
    !/^[a-f0-9-]{36}$/i.test(note.id) ||
    Number.isNaN(Date.parse(note.created_at))
  )
    throw new Error("Invalid history cursor");
  return `created_at.lt.${note.created_at},and(created_at.eq.${note.created_at},id.lt.${note.id})`;
}
