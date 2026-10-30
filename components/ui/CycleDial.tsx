import React, { useRef } from "react";
import { AppIcon } from "./Icons";
export function CycleDial({
  value,
  min,
  max,
  onChange,
  label,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  label: string;
}) {
  const active = useRef<number | null>(null);
  const point = (angle: number) => {
    const r = (angle * Math.PI) / 180;
    return [140 + 108 * Math.sin(r), 140 - 108 * Math.cos(r)];
  };
  const start = point(-135),
    end = point(135),
    thumb = point(-135 + (270 * (value - min)) / (max - min));
  const set = (n: number) =>
    onChange(Math.min(max, Math.max(min, Math.round(n))));
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const angle =
      (Math.atan2(
        e.clientX - box.left - box.width / 2,
        -(e.clientY - box.top - box.height / 2),
      ) *
        180) /
      Math.PI;
    let sweep = (angle + 135 + 360) % 360;
    if (sweep > 270) sweep = sweep > 315 ? 0 : 270;
    set(min + (sweep / 270) * (max - min));
  };
  return (
    <div className="cycle-dial-group">
      <div
        className="cycle-dial"
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={`${value} days`}
        onKeyDown={(e) => {
          if (
            [
              "ArrowLeft",
              "ArrowDown",
              "ArrowRight",
              "ArrowUp",
              "Home",
              "End",
              "PageUp",
              "PageDown",
            ].includes(e.key)
          ) {
            e.preventDefault();
            set(
              e.key === "Home"
                ? min
                : e.key === "End"
                  ? max
                  : value +
                    (["ArrowLeft", "ArrowDown", "PageDown"].includes(e.key)
                      ? -1
                      : 1) *
                      (e.key.startsWith("Page") ? 5 : 1),
            );
          }
        }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          active.current = e.pointerId;
          e.currentTarget.setPointerCapture?.(e.pointerId);
          move(e);
        }}
        onPointerMove={(e) => {
          if (active.current === e.pointerId) move(e);
        }}
        onPointerUp={() => {
          active.current = null;
        }}
        onPointerCancel={() => {
          active.current = null;
        }}
      >
        <svg viewBox="0 0 280 280" aria-hidden="true">
          <path
            d={`M${start.join(" ")}A108 108 0 1 1 ${end.join(" ")}`}
            pathLength="1"
            className="dial-track"
          />
          <path
            d={`M${start.join(" ")}A108 108 0 1 1 ${end.join(" ")}`}
            pathLength="1"
            strokeDasharray={`${(value - min) / (max - min)} 1`}
            className="dial-progress"
          />
          {Array.from({ length: max - min + 1 }, (_, i) => {
            const p = point(-135 + (270 * i) / (max - min));
            return (
              <circle
                key={i}
                cx={p[0]}
                cy={p[1]}
                r="2"
                fill="var(--bg-surface)"
              />
            );
          })}
          <circle cx={thumb[0]} cy={thumb[1]} r="12" className="dial-thumb" />
        </svg>
        <div className="dial-number" aria-hidden="true">
          <strong>{value}</strong>
          <span>days</span>
        </div>
      </div>
      <div className="dial-adjust">
        <button
          type="button"
          aria-label={`Decrease ${label.toLowerCase()}`}
          disabled={value <= min}
          onClick={() => set(value - 1)}
        >
          <AppIcon name="remove" size={22} />
        </button>
        <p>
          Drag the ring or use − / +
          <small>
            {min}–{max} days
          </small>
        </p>
        <button
          type="button"
          aria-label={`Increase ${label.toLowerCase()}`}
          disabled={value >= max}
          onClick={() => set(value + 1)}
        >
          <AppIcon name="add" size={22} />
        </button>
      </div>
    </div>
  );
}
