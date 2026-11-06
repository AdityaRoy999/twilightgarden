import React, { useId, useState } from "react";
import { AppIcon } from "./Icons";
export function GardenTimePicker({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const id = useId(),
    [open, setOpen] = useState(false),
    [part, setPart] = useState<"hour" | "minute">("hour");
  const [h = "09", m = "00"] = (value || "09:00").split(":");
  const hour = Number(h) || 0,
    minute = Number(m) || 0;
  return (
    <div
      className="garden-time"
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.preventDefault();
          e.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <span className="garden-field-label" id={id}>
        {label}
      </span>
      <button
        type="button"
        className="garden-date-trigger"
        aria-labelledby={`${id} ${id}-value`}
        aria-controls={`${id}-clock`}
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen(!open)}
      >
        <AppIcon name="schedule" size={22} />
        <span id={`${id}-value`}>{value || "Choose a time"}</span>
        <AppIcon name="expand_more" size={18} />
      </button>
      {open && (
        <section
          className="garden-clock"
          id={`${id}-clock`}
          aria-label={`${label} picker`}
        >
          <div className="garden-clock-header">
            <svg viewBox="0 0 60 60" width="54" height="54" aria-hidden="true">
              <circle cx="30" cy="30" r="25" fill="var(--selection-bg)" />
              <path
                d={`M30 30L${30 + 14 * Math.sin((((hour % 12) + minute / 60) * Math.PI) / 6)} ${30 - 14 * Math.cos((((hour % 12) + minute / 60) * Math.PI) / 6)}M30 30L${30 + 21 * Math.sin((minute * Math.PI) / 30)} ${30 - 21 * Math.cos((minute * Math.PI) / 30)}`}
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <circle cx="30" cy="30" r="3" fill="currentColor" />
            </svg>
            <button
              type="button"
              aria-pressed={part === "hour"}
              onClick={() => setPart("hour")}
            >
              Hours
            </button>
            <button
              type="button"
              aria-pressed={part === "minute"}
              onClick={() => setPart("minute")}
            >
              Minutes
            </button>
          </div>
          <div
            className="garden-clock-values"
            role="group"
            aria-label={`Choose ${part}`}
          >
            {Array.from({ length: part === "hour" ? 24 : 60 }, (_, n) => (
              <button
                type="button"
                disabled={disabled}
                key={n}
                aria-pressed={
                  value !== "" && (part === "hour" ? hour : minute) === n
                }
                onClick={() => {
                  onChange(
                    part === "hour"
                      ? `${String(n).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
                      : `${String(hour).padStart(2, "0")}:${String(n).padStart(2, "0")}`,
                  );
                  if (part === "hour") setPart("minute");
                  else setOpen(false);
                }}
              >
                {String(n).padStart(2, "0")}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="health-secondary"
            onClick={() => setOpen(false)}
          >
            Done
          </button>
        </section>
      )}
    </div>
  );
}
