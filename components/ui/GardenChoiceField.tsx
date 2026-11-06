import React, { useId, useRef } from "react";
import { useTheme } from "../../contexts/ThemeContext";
import { ChoiceSymbol } from "./ChoiceSymbol";
import { AppIcon } from "./Icons";
export function GardenChoiceField({
  label,
  value,
  options,
  onChange,
  context = "",
  disabled = false,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  context?: string;
  disabled?: boolean;
}) {
  const { showLoggingLabels = true } = useTheme();
  const id = useId(),
    group = useRef<HTMLDivElement>(null);
  const choose = (index: number) => {
    const option = options[index];
    onChange(option);
    group.current
      ?.querySelectorAll<HTMLButtonElement>("[role=radio]")
      [index]?.focus();
  };
  return (
    <fieldset
      className="garden-choice-field"
      disabled={disabled}
      data-labels={showLoggingLabels}
    >
      <legend id={id}>{label}</legend>
      <div
        ref={group}
        role="radiogroup"
        aria-labelledby={id}
        className="garden-choices"
        style={
          {
            "--choice-columns":
              options.length <= 3
                ? options.length
                : options.length === 4
                  ? 2
                  : 3,
          } as React.CSSProperties
        }
        onKeyDown={(e) => {
          const current = options.indexOf(value),
            keys = [
              "ArrowLeft",
              "ArrowRight",
              "ArrowUp",
              "ArrowDown",
              "Home",
              "End",
            ];
          if (!keys.includes(e.key)) return;
          e.preventDefault();
          const index =
            e.key === "Home"
              ? 0
              : e.key === "End"
                ? options.length - 1
                : current < 0
                  ? 0
                  : (current +
                      (["ArrowLeft", "ArrowUp"].includes(e.key) ? -1 : 1) +
                      options.length) %
                    options.length;
          choose(index);
        }}
      >
        {options.map((option, index) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={value === option}
            aria-label={option}
            title={showLoggingLabels ? undefined : option}
            tabIndex={value === option || (!value && index === 0) ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(option)}
          >
            <span className="garden-choice-art">
              <ChoiceSymbol value={option} context={context} />
            </span>
            {showLoggingLabels && (
              <span className="garden-choice-label">{option}</span>
            )}
          </button>
        ))}
      </div>
      {value && (
        <button
          className="garden-choice-clear"
          type="button"
          disabled={disabled}
          onClick={() => onChange("")}
          aria-label={`Clear ${label.toLowerCase()}`}
        >
          <AppIcon name="close" size={14} />
          Clear
        </button>
      )}
    </fieldset>
  );
}
