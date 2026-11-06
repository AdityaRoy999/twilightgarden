// @vitest-environment jsdom
import React, { useState } from "react";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  within,
  waitFor,
} from "@testing-library/react";
import { afterEach, it, expect, vi } from "vitest";
import {
  GardenDatePicker,
  calendarCells,
} from "../components/ui/GardenDatePicker";
import { GardenSelect } from "../components/ui/GardenSelect";
import { GardenCheckbox } from "../components/ui/GardenCheckbox";
import { GardenChoiceField } from "../components/ui/GardenChoiceField";
import { GardenTimePicker } from "../components/ui/GardenTimePicker";
import { parseDateKey } from "../lib/dates";
import { PainMeter } from "../components/ui/PainMeter";
import { ThemeProvider, useTheme } from "../contexts/ThemeContext";
import { healthModules } from "../lib/reproductiveHealth";
import { ChoiceSymbol, choiceSymbolSpec } from "../components/ui/ChoiceSymbol";
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});
it("renders leap day and keeps month cells as local date keys", () => {
  const cells = calendarCells(2028, 1);
  expect(cells).toHaveLength(42);
  expect(cells[0].key).toBe("2028-01-30");
  expect(cells.filter((d) => !d.outside)).toHaveLength(29);
  expect(cells.find((d) => d.key === "2028-02-29")?.day).toBe(29);
});
it("enforces calendar bounds and never saves a disabled day", () => {
  const change = vi.fn();
  render(
    <GardenDatePicker
      label="Journal date"
      value="2028-02-28"
      min="2028-02-01"
      max="2028-02-29"
      onChange={change}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /Journal date/ }));
  const future = screen.getByRole("button", {
    name: parseDateKey("2028-03-01").toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
  });
  expect(future.hasAttribute("disabled")).toBe(true);
  fireEvent.click(future);
  expect(change).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", {
      name: parseDateKey("2028-02-29").toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
    }),
  );
  expect(change).toHaveBeenCalledWith("2028-02-29");
  expect(screen.queryByRole("region")).toBeNull();
});
it("moves the calendar keyboard focus across a month boundary with one day tab stop", async () => {
  render(
    <GardenDatePicker label="Date" value="2028-02-29" onChange={() => {}} />,
  );
  fireEvent.click(screen.getByRole("button", { name: /Date/ }));
  const grid = screen.getByRole("group", { name: "Choose day" });
  expect(grid.querySelectorAll('[tabindex="0"]')).toHaveLength(1);
  fireEvent.keyDown(
    screen.getByRole("button", {
      name: parseDateKey("2028-02-29").toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
    }),
    { key: "ArrowRight" },
  );
  await waitFor(() =>
    expect(document.activeElement?.getAttribute("data-date")).toBe(
      "2028-03-01",
    ),
  );
  expect(grid.querySelectorAll('[tabindex="0"]')).toHaveLength(1);
});
it("lets Escape close an inline picker without escaping the enclosing form", () => {
  const outer = vi.fn();
  render(
    <div onKeyDown={outer}>
      <GardenSelect
        label="Request type"
        value="access"
        onChange={() => {}}
        options={[
          { value: "access", label: "Access", icon: "description" },
          { value: "delete", label: "Delete", icon: "delete" },
        ]}
      />
    </div>,
  );
  const trigger = screen.getByRole("combobox");
  fireEvent.click(trigger);
  fireEvent.keyDown(trigger, { key: "Escape" });
  expect(screen.queryByRole("listbox")).toBeNull();
  expect(outer).not.toHaveBeenCalled();
});
it("supports keyboard listbox navigation and preserves machine values", () => {
  const change = vi.fn();
  render(
    <GardenSelect
      label="Request"
      value="access"
      onChange={change}
      options={[
        { value: "access", label: "Access my data" },
        { value: "deletion", label: "Delete my data" },
      ]}
    />,
  );
  const trigger = screen.getByRole("combobox");
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
  fireEvent.keyDown(trigger, { key: "End" });
  fireEvent.keyDown(trigger, { key: "Enter" });
  expect(change).toHaveBeenCalledWith("deletion");
  expect(screen.queryByRole("listbox")).toBeNull();
});
it("keeps consent visible and unchecked until explicitly chosen", () => {
  function Demo() {
    const [c, set] = useState(false);
    return (
      <GardenCheckbox checked={c} onChange={set}>
        <strong>Share this entry</strong>
        <small>Private by default</small>
      </GardenCheckbox>
    );
  }
  render(<Demo />);
  const box = screen.getByRole("checkbox");
  expect((box as HTMLInputElement).checked).toBe(false);
  fireEvent.click(screen.getByText("Share this entry"));
  expect((box as HTMLInputElement).checked).toBe(true);
  expect(screen.getByText("Private by default")).toBeTruthy();
});
it("persists icon-only labels without changing selected records or accessible names", () => {
  function Demo() {
    const { showLoggingLabels, updateShowLoggingLabels } = useTheme();
    const [v, set] = useState("Moderate");
    return (
      <>
        <button onClick={() => updateShowLoggingLabels(!showLoggingLabels)}>
          Labels
        </button>
        <GardenChoiceField
          label="Impact"
          value={v}
          options={["Mild", "Moderate", "Severe"]}
          onChange={set}
        />
      </>
    );
  }
  const first = render(
    <ThemeProvider>
      <Demo />
    </ThemeProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Labels" }));
  expect(screen.queryByText("Moderate")).toBeNull();
  expect(
    screen
      .getByRole("radio", { name: "Moderate" })
      .getAttribute("aria-checked"),
  ).toBe("true");
  expect(localStorage.getItem("theme-logging-labels")).toBe("false");
  first.unmount();
  render(
    <ThemeProvider>
      <Demo />
    </ThemeProvider>,
  );
  expect(screen.queryByText("Moderate")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Labels" }));
  expect(screen.getByText("Moderate")).toBeTruthy();
});
it("supports health radio keys and clearing while preserving option spelling", () => {
  function Demo() {
    const [v, set] = useState("");
    return (
      <ThemeProvider>
        <GardenChoiceField
          label="Screening"
          value={v}
          options={["Not recorded", "Booked", "Completed", "Follow-up needed"]}
          onChange={set}
        />
      </ThemeProvider>
    );
  }
  render(<Demo />);
  fireEvent.keyDown(screen.getByRole("radio", { name: "Not recorded" }), {
    key: "End",
  });
  expect(
    screen
      .getByRole("radio", { name: "Follow-up needed" })
      .getAttribute("aria-checked"),
  ).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Clear screening" }));
  expect(
    screen
      .getAllByRole("radio")
      .every((b) => b.getAttribute("aria-checked") === "false"),
  ).toBe(true);
});
it("keeps zero pain distinct from no record and supports keyboard adjustment", () => {
  function Demo() {
    const [v, set] = useState<number>();
    return <PainMeter value={v} onChange={set} />;
  }
  render(<Demo />);
  const slider = screen.getByRole("slider");
  expect(slider.getAttribute("aria-valuetext")).toBe("Not recorded");
  fireEvent.keyDown(slider, { key: "Home" });
  expect(slider.getAttribute("aria-valuetext")).toBe("0 out of 10");
  fireEvent.keyDown(slider, { key: "ArrowRight" });
  expect(slider.getAttribute("aria-valuenow")).toBe("1");
  fireEvent.click(screen.getByRole("button", { name: "Clear pain severity" }));
  expect(slider.getAttribute("aria-valuetext")).toBe("Not recorded");
});
it("keeps exact minutes and midnight in the custom clock", () => {
  function Demo() {
    const [v, set] = useState("");
    return <GardenTimePicker label="Local time" value={v} onChange={set} />;
  }
  render(<Demo />);
  fireEvent.click(screen.getByRole("button", { name: /Local time/ }));
  fireEvent.click(
    within(screen.getByRole("group", { name: "Choose hour" })).getByRole(
      "button",
      { name: "00" },
    ),
  );
  fireEvent.click(
    within(screen.getByRole("group", { name: "Choose minute" })).getByRole(
      "button",
      { name: "07" },
    ),
  );
  expect(screen.getByRole("button", { name: /Local time 00:07/ })).toBeTruthy();
});
it("provides local SVG artwork for every reproductive health choice", () => {
  for (const module of Object.values(healthModules))
    for (const field of module.fields)
      for (const option of field.options || []) {
        const view = render(
          <ChoiceSymbol value={option} context={field.key} />,
        );
        expect(view.container.querySelector("svg")).toBeTruthy();
        expect(view.container.querySelector("img, use, image")).toBeNull();
        view.unmount();
      }
  expect(choiceSymbolSpec("Mild")).not.toEqual(choiceSymbolSpec("Moderate"));
  expect(choiceSymbolSpec("Moderate")).not.toEqual(choiceSymbolSpec("Severe"));
  expect(choiceSymbolSpec("Low", "libido")).not.toEqual(
    choiceSymbolSpec("Low", "wellbeing"),
  );
});
