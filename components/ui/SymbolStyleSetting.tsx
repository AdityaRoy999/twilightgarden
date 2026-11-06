import React, { useRef } from "react";
import { useTheme, type HealthSymbolStyle } from "../../contexts/ThemeContext";
import { AppIcon } from "./Icons";
import { LogSymbol } from "./LogSymbol";

const styles: HealthSymbolStyle[] = ["filled", "line"];
export function SymbolStyleSetting() {
  const { healthSymbolStyle = "filled", updateHealthSymbolStyle } = useTheme(),
    group = useRef<HTMLDivElement>(null);
  return (
    <div className="reference-setting-row symbol-style-setting">
      <div>
        <span className="reference-icon">
          <AppIcon name="palette" size={24} />
        </span>
        <span>
          <strong>Custom symbol style</strong>
          <small>Health check-ins and journal symbols</small>
        </span>
      </div>
      <div
        ref={group}
        className="symbol-style-options"
        role="radiogroup"
        aria-label="Custom symbol style"
        onKeyDown={(e) => {
          if (
            ![
              "ArrowLeft",
              "ArrowRight",
              "ArrowUp",
              "ArrowDown",
              "Home",
              "End",
            ].includes(e.key)
          )
            return;
          e.preventDefault();
          const index =
            e.key === "Home"
              ? 0
              : e.key === "End"
                ? 1
                : healthSymbolStyle === "filled"
                  ? 1
                  : 0;
          updateHealthSymbolStyle(styles[index]);
          group.current
            ?.querySelectorAll<HTMLButtonElement>("button")
            [index]?.focus();
        }}
      >
        {styles.map((style) => (
          <button
            type="button"
            role="radio"
            aria-checked={healthSymbolStyle === style}
            tabIndex={healthSymbolStyle === style ? 0 : -1}
            aria-label={style === "filled" ? "Filled symbols" : "Line symbols"}
            key={style}
            onClick={() => updateHealthSymbolStyle(style)}
          >
            <LogSymbol kind="happy" variant={style} />
            <span>{style === "filled" ? "Filled" : "Line"}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
