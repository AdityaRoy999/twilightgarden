// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, it, expect } from "vitest";
import { ThemeProvider, useTheme } from "../contexts/ThemeContext";
import { SymbolStyleSetting } from "../components/ui/SymbolStyleSetting";
import { ChoiceSymbol } from "../components/ui/ChoiceSymbol";
import { LogSymbol } from "../components/ui/LogSymbol";
import { AppIcon } from "../components/ui/Icons";
import { GardenChoiceField } from "../components/ui/GardenChoiceField";
import { healthModules } from "../lib/reproductiveHealth";
afterEach(() => {
  cleanup();
  localStorage.clear();
});
function Demo() {
  return (
    <ThemeProvider>
      <SymbolStyleSetting />
      <GardenChoiceField
        label="Sleep"
        value="Good"
        options={["Good", "Fair", "Poor"]}
        onChange={() => {}}
      />
      <LogSymbol kind="calm" />
      <AppIcon name="bedtime" />
      <p>Message reaction: ❤️</p>
    </ThemeProvider>
  );
}
it("defaults to filled artwork and persists line mode across remounts", () => {
  const first = render(<Demo />);
  expect(
    screen
      .getByRole("radio", { name: "Filled symbols" })
      .getAttribute("aria-checked"),
  ).toBe("true");
  expect(
    first.container
      .querySelector("[data-log-symbol=calm]")
      ?.getAttribute("data-symbol-style"),
  ).toBe("filled");
  fireEvent.click(screen.getByRole("radio", { name: "Line symbols" }));
  expect(localStorage.getItem("theme-health-symbol-style")).toBe("line");
  expect(
    first.container
      .querySelector("[data-log-symbol=calm]")
      ?.getAttribute("data-symbol-style"),
  ).toBe("line");
  first.unmount();
  render(<Demo />);
  expect(
    screen
      .getByRole("radio", { name: "Line symbols" })
      .getAttribute("aria-checked"),
  ).toBe("true");
});
it("changes custom artwork everywhere without altering core Solar icons, records or emoji", () => {
  const view = render(<Demo />),
    solar = view.container.querySelector("[data-solar]")!.outerHTML,
    filled = view.container.querySelector(
      '[data-choice-symbol="moon:0"]',
    )!.innerHTML;
  fireEvent.click(screen.getByRole("radio", { name: "Line symbols" }));
  expect(view.container.querySelector("[data-solar]")!.outerHTML).toBe(solar);
  expect(
    screen.getByRole("radio", { name: "Good" }).getAttribute("aria-checked"),
  ).toBe("true");
  expect(screen.getByText("Message reaction: ❤️")).toBeTruthy();
  expect(
    view.container.querySelector('[data-choice-symbol="moon:0"]')!.innerHTML,
  ).not.toBe(filled);
});
it("offers keyboard selection and resets the artwork with appearance defaults", () => {
  function Reset() {
    const { resetTheme } = useTheme();
    return <button onClick={resetTheme}>Reset appearance</button>;
  }
  render(
    <ThemeProvider>
      <SymbolStyleSetting />
      <Reset />
    </ThemeProvider>,
  );
  fireEvent.keyDown(screen.getByRole("radio", { name: "Filled symbols" }), {
    key: "ArrowRight",
  });
  expect(document.activeElement).toBe(
    screen.getByRole("radio", { name: "Line symbols" }),
  );
  expect(
    screen
      .getByRole("radio", { name: "Line symbols" })
      .getAttribute("aria-checked"),
  ).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Reset appearance" }));
  expect(
    screen
      .getByRole("radio", { name: "Filled symbols" })
      .getAttribute("aria-checked"),
  ).toBe("true");
  expect(localStorage.getItem("theme-health-symbol-style")).toBe("filled");
});
it("has drawn filled and line variants for every health choice, with no external assets", () => {
  for (const module of Object.values(healthModules))
    for (const field of module.fields)
      for (const value of field.options || []) {
        const view = render(
          <ThemeProvider>
            <ChoiceSymbol value={value} context={field.key} variant="filled" />
            <ChoiceSymbol value={value} context={field.key} variant="line" />
          </ThemeProvider>,
        );
        const icons = view.container.querySelectorAll("svg");
        expect(icons).toHaveLength(2);
        expect(icons[0].getAttribute("data-symbol-style")).toBe("filled");
        expect(icons[1].getAttribute("data-symbol-style")).toBe("line");
        expect(icons[0].innerHTML).not.toBe(icons[1].innerHTML);
        expect(view.container.querySelector("image,img,use")).toBeNull();
        view.unmount();
      }
});
it("gives every flow, mood and energy symbol a filled and line drawing", () => {
  for (const kind of [
    "calm",
    "happy",
    "frisky",
    "swings",
    "anxious",
    "sad",
    "irritated",
    "energetic",
    "low",
    "medium",
    "high",
    "spotting",
    "light",
    "flow-medium",
    "heavy",
  ]) {
    const view = render(
      <ThemeProvider>
        <LogSymbol kind={kind} variant="filled" />
        <LogSymbol kind={kind} variant="line" />
      </ThemeProvider>,
    );
    const icons = view.container.querySelectorAll("svg");
    expect(icons).toHaveLength(2);
    expect(icons[0].innerHTML).not.toBe(icons[1].innerHTML);
    view.unmount();
  }
});
