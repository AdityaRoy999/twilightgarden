import React from "react";
import { AppIcon } from "./Icons";

/** Native semantics, original themed surface. Consent wording is never hidden. */
export function GardenCheckbox({
  checked,
  onChange,
  disabled = false,
  children,
  className = "",
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label
      className={`garden-check ${className}`}
      data-checked={checked}
      data-disabled={disabled}
    >
      <input
        className="garden-check-input"
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="garden-check-mark" aria-hidden="true">
        <AppIcon name="check" size={19} />
      </span>
      <span className="garden-check-copy">{children}</span>
    </label>
  );
}
