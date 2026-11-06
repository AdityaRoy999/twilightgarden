import React, { useId, useRef } from "react";
import { ChoiceSymbol } from "./ChoiceSymbol";
import { AppIcon } from "./Icons";
/** An eleven-step pain scale. Blank and recorded zero remain different values. */
export function PainMeter({
  value,
  onChange,
}: {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}) {
  const id = useId(),
    track = useRef<HTMLDivElement>(null);
  const pointer = (e: React.PointerEvent) => {
    const box = track.current?.getBoundingClientRect();
    if (box && box.width > 0)
      onChange(
        Math.max(
          0,
          Math.min(10, Math.round(((e.clientX - box.left) / box.width) * 10)),
        ),
      );
  };
  return (
    <div className="garden-pain">
      <div className="garden-pain-heading">
        <span className="garden-choice-art">
          <ChoiceSymbol
            value={
              value === undefined
                ? "Not recorded"
                : value < 4
                  ? "Mild"
                  : value < 8
                    ? "Moderate"
                    : "Severe"
            }
          />
        </span>
        <div>
          <span id={id}>Pain severity</span>
          <strong aria-live="polite">
            {value === undefined ? "Not recorded" : `${value} / 10`}
          </strong>
        </div>
        {value !== undefined && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            aria-label="Clear pain severity"
          >
            <AppIcon name="close" size={17} />
          </button>
        )}
      </div>
      <div
        ref={track}
        className="garden-pain-track"
        role="slider"
        tabIndex={0}
        aria-labelledby={id}
        aria-valuemin={0}
        aria-valuemax={10}
        aria-valuenow={value ?? 0}
        aria-valuetext={
          value === undefined ? "Not recorded" : `${value} out of 10`
        }
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          pointer(e);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) pointer(e);
        }}
        onPointerUp={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId))
            e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onKeyDown={(e) => {
          if (
            [
              "ArrowLeft",
              "ArrowDown",
              "ArrowRight",
              "ArrowUp",
              "Home",
              "End",
            ].includes(e.key)
          ) {
            e.preventDefault();
            onChange(
              e.key === "Home"
                ? 0
                : e.key === "End"
                  ? 10
                  : Math.max(
                      0,
                      Math.min(
                        10,
                        (value ?? 0) +
                          (["ArrowLeft", "ArrowDown"].includes(e.key) ? -1 : 1),
                      ),
                    ),
            );
          }
        }}
      >
        {Array.from({ length: 11 }, (_, n) => (
          <span
            key={n}
            data-filled={value !== undefined && n <= value}
            data-current={value === n}
            style={{ height: `${22 + n * 2.4}px` }}
          >
            <i />
          </span>
        ))}
      </div>
      <div className="garden-pain-labels">
        <span>0 · No pain</span>
        <span>10 · Most intense</span>
      </div>
    </div>
  );
}
