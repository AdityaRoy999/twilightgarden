import React, { useId, useRef, useState } from "react";
import { localDateKey, parseDateKey } from "../../lib/dates";
import { AppIcon } from "./Icons";

export function calendarCells(year: number, month: number) {
  const first = new Date(year, month, 1),
    start = new Date(year, month, 1 - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    return {
      key: localDateKey(date),
      day: date.getDate(),
      outside: date.getMonth() !== month,
    };
  });
}
export function GardenDatePicker({
  label,
  value,
  onChange,
  min,
  max,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
}) {
  const id = useId(),
    selected = parseDateKey(value),
    initial = Number.isFinite(selected.getTime()) ? selected : new Date(),
    [month, setMonth] = useState(
      () => new Date(initial.getFullYear(), initial.getMonth(), 1),
    ),
    [focused, setFocused] = useState(value || localDateKey()),
    [open, setOpen] = useState(false),
    [view, setView] = useState<"days" | "months" | "years">("days"),
    [decade, setDecade] = useState(Math.floor(initial.getFullYear() / 12) * 12),
    grid = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const allowed = (date: string) =>
    !disabled && (!min || date >= min) && (!max || date <= max);
  const cells = calendarCells(month.getFullYear(), month.getMonth());
  const focusable =
    cells.find((d) => d.key === focused && !d.outside && allowed(d.key))?.key ||
    cells.find((d) => !d.outside && allowed(d.key))?.key;
  const move = (amount: number) =>
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + amount, 1));
  const choose = (key: string) => {
    if (!allowed(key)) return;
    onChange(key);
    setOpen(false);
    trigger.current?.focus();
  };
  const keys = (e: React.KeyboardEvent, day: string) => {
    let date = parseDateKey(day);
    if (
      ![
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "Home",
        "End",
        "PageUp",
        "PageDown",
      ].includes(e.key)
    )
      return;
    e.preventDefault();
    if (e.key.startsWith("Page")) {
      const next = new Date(date);
      next.setDate(1);
      next.setMonth(
        next.getMonth() + (e.key === "PageUp" ? -1 : 1) * (e.shiftKey ? 12 : 1),
      );
      next.setDate(
        Math.min(
          date.getDate(),
          new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate(),
        ),
      );
      date = next;
    } else
      date.setDate(
        date.getDate() +
          ({
            ArrowLeft: -1,
            ArrowRight: 1,
            ArrowUp: -7,
            ArrowDown: 7,
            Home: -date.getDay(),
            End: 6 - date.getDay(),
          }[e.key] || 0),
      );
    const key = localDateKey(date);
    if (!allowed(key)) return;
    setFocused(key);
    setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    requestAnimationFrame(() =>
      grid.current
        ?.querySelector<HTMLButtonElement>(`[data-date="${key}"]`)
        ?.focus(),
    );
  };
  const years = Array.from({ length: 12 }, (_, i) => decade + i),
    months = Array.from({ length: 12 }, (_, i) =>
      new Date(2000, i, 1).toLocaleDateString(undefined, { month: "short" }),
    );
  return (
    <div
      className="garden-date"
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.preventDefault();
          e.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <span id={id} className="garden-field-label">
        {label}
      </span>
      <button
        type="button"
        ref={trigger}
        className="garden-date-trigger"
        aria-labelledby={`${id} ${id}-value`}
        aria-expanded={open}
        aria-controls={`${id}-calendar`}
        disabled={disabled}
        onClick={() => {
          if (!open) {
            setMonth(new Date(initial.getFullYear(), initial.getMonth(), 1));
            setFocused(value || localDateKey());
            setView("days");
          }
          setOpen(!open);
        }}
      >
        <AppIcon name="calendar_today" size={22} />
        <span id={`${id}-value`}>
          {value && Number.isFinite(selected.getTime())
            ? selected.toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
                year: "numeric",
              })
            : "Choose a date"}
        </span>
        <AppIcon name="expand_more" size={18} />
      </button>
      {open && (
        <section
          id={`${id}-calendar`}
          className="garden-calendar"
          aria-label={`${label} calendar`}
        >
          <header>
            <button
              type="button"
              aria-label={
                view === "years"
                  ? "Previous 12 years"
                  : view === "months"
                    ? "Previous year"
                    : "Previous month"
              }
              onClick={() =>
                view === "years"
                  ? setDecade((d) => d - 12)
                  : view === "months"
                    ? setMonth(
                        (m) => new Date(m.getFullYear() - 1, m.getMonth(), 1),
                      )
                    : move(-1)
              }
            >
              <AppIcon name="chevron_left" size={22} />
            </button>
            <button
              type="button"
              className="garden-calendar-caption"
              onClick={() => {
                if (view === "days") setView("months");
                else {
                  setDecade(Math.floor(month.getFullYear() / 12) * 12);
                  setView(view === "months" ? "years" : "days");
                }
              }}
            >
              {view === "days"
                ? month.toLocaleDateString(undefined, {
                    month: "long",
                    year: "numeric",
                  })
                : view === "months"
                  ? month.getFullYear()
                  : `${decade}–${decade + 11}`}
              <AppIcon name="expand_more" size={16} />
            </button>
            <button
              type="button"
              aria-label={
                view === "years"
                  ? "Next 12 years"
                  : view === "months"
                    ? "Next year"
                    : "Next month"
              }
              onClick={() =>
                view === "years"
                  ? setDecade((d) => d + 12)
                  : view === "months"
                    ? setMonth(
                        (m) => new Date(m.getFullYear() + 1, m.getMonth(), 1),
                      )
                    : move(1)
              }
            >
              <AppIcon name="chevron_right" size={22} />
            </button>
          </header>
          {view === "days" ? (
            <>
              <div className="garden-calendar-week" aria-hidden="true">
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>
              <div
                ref={grid}
                className="garden-calendar-days"
                role="group"
                aria-label="Choose day"
              >
                {cells.map((d) => (
                  <button
                    type="button"
                    key={d.key}
                    data-date={d.key}
                    data-outside={d.outside}
                    tabIndex={d.key === focusable ? 0 : -1}
                    onFocus={() => setFocused(d.key)}
                    aria-label={parseDateKey(d.key).toLocaleDateString(
                      undefined,
                      {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      },
                    )}
                    aria-pressed={d.key === value}
                    aria-current={d.key === localDateKey() ? "date" : undefined}
                    disabled={!allowed(d.key)}
                    onKeyDown={(e) => keys(e, d.key)}
                    onClick={() => choose(d.key)}
                  >
                    {d.day}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="garden-calendar-months">
              {view === "months"
                ? months.map((m, i) => (
                    <button
                      type="button"
                      key={m}
                      onClick={() => {
                        setMonth(new Date(month.getFullYear(), i, 1));
                        setView("days");
                      }}
                    >
                      {m}
                    </button>
                  ))
                : years.map((year) => (
                    <button
                      type="button"
                      key={year}
                      onClick={() => {
                        setMonth(new Date(year, month.getMonth(), 1));
                        setView("months");
                      }}
                    >
                      {year}
                    </button>
                  ))}
            </div>
          )}
          <footer>
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              Clear
            </button>
            <button
              type="button"
              disabled={!allowed(localDateKey())}
              onClick={() => choose(localDateKey())}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              Done
            </button>
          </footer>
        </section>
      )}
    </div>
  );
}
