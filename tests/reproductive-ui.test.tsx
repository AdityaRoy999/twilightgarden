// @vitest-environment jsdom
import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { afterEach, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
vi.mock("../hooks/useAppMotion", () => ({
  useAppMotion: () => ({ reduced: true }),
}));
import { HealthEntryForm } from "../components/health/HealthEntryForm";
import { HealthGoalForm } from "../components/health/HealthGoalForm";
import { PregnancyJourney } from "../components/health/PregnancyJourney";
import { defaultHealthSettings } from "../lib/reproductiveHealth";
afterEach(cleanup);
it("keeps sexual health private by default and preserves a failed draft", async () => {
  const save = vi.fn().mockRejectedValue(new Error("Offline test"));
  render(
    <HealthEntryForm
      category="intimacy"
      onClose={() => {}}
      onSave={save}
      canShare={false}
    />,
  );
  expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(
    false,
  );
  expect(screen.getByRole("checkbox").hasAttribute("disabled")).toBe(true);
  fireEvent.change(screen.getByLabelText("Private notes"), {
    target: { value: "Synthetic private note" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save encrypted entry" }));
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toBe("Offline test"),
  );
  expect(
    (screen.getByLabelText("Private notes") as HTMLTextAreaElement).value,
  ).toBe("Synthetic private note");
  expect(save.mock.calls[0][0].shareWithPartner).toBe(false);
});
it("does not submit an unnamed medication", async () => {
  const save = vi.fn();
  render(
    <HealthEntryForm
      category="medication"
      onClose={() => {}}
      onSave={save}
      canShare={false}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Save encrypted entry" }));
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain("name"),
  );
  expect(save).not.toHaveBeenCalled();
});
it("switching pregnancy preview does not change saved dates", () => {
  const settings = {
    ...defaultHealthSettings,
    mode: "pregnancy" as const,
    pregnancy: { lmp: "2026-01-01", status: "active" as const },
  };
  render(
    <MemoryRouter>
      <PregnancyJourney
        settings={settings}
        today="2026-04-09"
        onSettings={() => {}}
        onLog={() => {}}
      />
    </MemoryRouter>,
  );
  expect(
    screen.getByRole("heading", { name: "14 weeks, 0 days" }),
  ).toBeTruthy();
  fireEvent.change(screen.getByRole("slider"), { target: { value: "36" } });
  expect(screen.getByRole("heading", { name: "36 weeks" })).toBeTruthy();
  expect(settings.pregnancy.lmp).toBe("2026-01-01");
  fireEvent.click(
    screen.getByRole("button", { name: "Back to my current week" }),
  );
  expect(
    screen.getByRole("heading", { name: "14 weeks, 0 days" }),
  ).toBeTruthy();
});
it("pausing pregnancy hides visuals while retaining the pregnancy mode and history", async () => {
  const save = vi.fn().mockResolvedValue(undefined);
  render(
    <HealthGoalForm
      settings={{
        ...defaultHealthSettings,
        mode: "pregnancy",
        pregnancy: { lmp: "2026-10-01", status: "active" },
      }}
      onSave={save}
      onClose={() => {}}
    />,
  );
  fireEvent.change(screen.getByLabelText("Pregnancy status"), {
    target: { value: "paused" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save my journey" }));
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(save.mock.calls[0][0]).toMatchObject({
    mode: "pregnancy",
    pregnancy: { status: "paused", lmp: "2026-10-01" },
  });
});

it("retains native date and time input when submitting a reminder", async () => {
  const save = vi.fn().mockResolvedValue(undefined);
  render(
    <HealthEntryForm
      category="reminder"
      onClose={() => {}}
      onSave={save}
      canShare={false}
    />,
  );
  fireEvent.input(screen.getByLabelText("Next date"), {
    target: { value: "2027-01-15" },
  });
  fireEvent.input(screen.getByLabelText("Local time"), {
    target: { value: "09:30" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save encrypted entry" }));
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(save.mock.calls[0][0].values).toMatchObject({
    date: "2027-01-15",
    time: "09:30",
  });
});
