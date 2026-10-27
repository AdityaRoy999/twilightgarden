// @vitest-environment jsdom
import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("../hooks/useAppMotion", () => ({
  useAppMotion: () => ({ reduced: true }),
}));
import { LogHistoryView } from "../components/history/LogHistoryView";
import {
  historyEntries,
  historyDetails,
  type HistoryLog,
} from "../lib/logHistory";
afterEach(cleanup);
const log: HistoryLog = {
  id: "one",
  date: "2026-10-26",
  moods: ["calm", "happy"],
  symptoms: ["cramps", "cramps", "headache"],
  flow: "medium",
  sleep_quality: "fair",
  sleep_hours: 0,
  energy_level: "low",
  notes: "A shared note with a real line.\nAnd a second line.",
};
it("uses local calendar dates, stable newest-first ordering and complete mapped fields", () => {
  expect(
    historyEntries([log, { date: "invalid" }, { date: "2026-10-27" }]).map(
      (entry) => entry.date,
    ),
  ).toEqual(["2026-10-27", "2026-10-26"]);
  expect(historyDetails(log)).toMatchObject({
    energy: "low",
    sleep: "fair",
    hours: 0,
    symptoms: ["cramps", "headache"],
  });
  expect(
    historyDetails({ date: "2026-10-25", note: "Legacy note" }).notes,
  ).toBe("Legacy note");
});
it("switches between grid and list and shows all details read-only for a caregiver", () => {
  render(<LogHistoryView logs={[log]} />);
  fireEvent.click(screen.getByRole("button", { name: "List view" }));
  expect(
    screen
      .getByRole("button", { name: "List view" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  expect(screen.getByText("2 symptoms")).toBeTruthy();
  fireEvent.click(
    screen.getByRole("button", { name: "View check-in for October 26, 2026" }),
  );
  const modal = screen.getByRole("dialog", {
    name: "Check-in for October 26, 2026",
  });
  expect(within(modal).getByText("medium")).toBeTruthy();
  expect(within(modal).getByText("low")).toBeTruthy();
  expect(within(modal).getByText("fair · 0 hours")).toBeTruthy();
  expect(within(modal).getByText(/A shared note/)).toBeTruthy();
  expect(within(modal).getByText("happy")).toBeTruthy();
  expect(
    within(modal).queryByRole("button", { name: "Edit this check-in" }),
  ).toBeNull();
});
it("allows only the owner view to edit and removes stale selected data when rows disappear", () => {
  const edit = vi.fn();
  const view = render(
    <LogHistoryView logs={[log]} readOnly={false} onEdit={edit} />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "View check-in for October 26, 2026" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Edit this check-in" }));
  expect(edit).toHaveBeenCalledWith("2026-10-26");
  view.rerender(<LogHistoryView logs={[]} readOnly={false} onEdit={edit} />);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByText("No check-ins yet")).toBeTruthy();
});
it("bounds the initial render while retaining access to older history", () => {
  const rows = Array.from({ length: 40 }, (_, i) => ({
    date: `2026-${i < 20 ? "10" : "09"}-${String((i % 20) + 1).padStart(2, "0")}`,
    id: String(i),
  }));
  render(<LogHistoryView logs={rows} />);
  expect(
    screen.getAllByRole("button", { name: /View check-in for/ }),
  ).toHaveLength(30);
  fireEvent.click(screen.getByRole("button", { name: /Show more check-ins/ }));
  expect(
    screen.getAllByRole("button", { name: /View check-in for/ }),
  ).toHaveLength(40);
  expect(screen.getAllByText("Not logged")).toHaveLength(40);
});
