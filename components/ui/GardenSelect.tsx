import React, { useEffect, useId, useRef, useState } from "react";
import { AppIcon } from "./Icons";
export type GardenOption = { value: string; label: string; icon?: string };
/** Local, keyboard-operated listbox. Expands in its scroll area, outside no route transform. */
export function GardenSelect({
  label,
  value,
  onChange,
  options,
  disabled = false,
  id: givenId,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly GardenOption[];
  disabled?: boolean;
  id?: string;
}) {
  const generated = useId(),
    id = givenId || generated,
    root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    [open, setOpen] = useState(false),
    [active, setActive] = useState(0),
    query = useRef({ text: "", at: 0 });
  const chosen = options.find((o) => o.value === value) || options[0];
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  useEffect(() => {
    if (open)
      root.current
        ?.querySelector(`[data-active="true"]`)
        ?.scrollIntoView?.({ block: "nearest" });
  }, [active, open]);
  const begin = () => {
    setActive(
      Math.max(
        0,
        options.findIndex((o) => o.value === value),
      ),
    );
    setOpen(true);
  };
  const choose = (index: number) => {
    if (disabled || !options[index]) return;
    onChange(options[index].value);
    setOpen(false);
    trigger.current?.focus();
  };
  return (
    <div className="garden-select" ref={root}>
      <span id={`${id}-label`} className="garden-field-label">
        {label}
      </span>
      <button
        ref={trigger}
        id={id}
        type="button"
        role="combobox"
        aria-labelledby={`${id}-label ${id}-value`}
        aria-controls={`${id}-list`}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-activedescendant={open ? `${id}-option-${active}` : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : begin())}
        onKeyDown={(e) => {
          if (e.key === "Escape" && open) {
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
            return;
          }
          if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
            e.preventDefault();
            if (!open) {
              begin();
              return;
            }
            setActive((i) =>
              e.key === "Home"
                ? 0
                : e.key === "End"
                  ? options.length - 1
                  : (i + (e.key === "ArrowUp" ? -1 : 1) + options.length) %
                    options.length,
            );
          } else if ((e.key === "Enter" || e.key === " ") && open) {
            e.preventDefault();
            choose(active);
          } else if (e.key.length === 1 && e.key !== " ") {
            const now = Date.now();
            query.current = {
              text:
                (now - query.current.at < 800 ? query.current.text : "") +
                e.key.toLowerCase(),
              at: now,
            };
            const found = options.findIndex((o) =>
              o.label.toLowerCase().startsWith(query.current.text),
            );
            if (found >= 0) {
              e.preventDefault();
              setOpen(true);
              setActive(found);
            }
          } else if (e.key === "Tab") setOpen(false);
        }}
      >
        <AppIcon name={chosen?.icon || "category"} size={22} />
        <span id={`${id}-value`}>{chosen?.label || "Choose an option"}</span>
        <AppIcon name={open ? "expand_less" : "expand_more"} size={18} />
      </button>
      {open && (
        <div
          id={`${id}-list`}
          role="listbox"
          aria-labelledby={`${id}-label`}
          className="garden-select-list"
        >
          {options.map((o, i) => (
            <button
              key={o.value}
              id={`${id}-option-${i}`}
              type="button"
              role="option"
              disabled={disabled}
              aria-selected={value === o.value}
              tabIndex={-1}
              data-active={active === i}
              onPointerMove={() => setActive(i)}
              onClick={() => choose(i)}
            >
              <AppIcon name={o.icon || "category"} size={22} />
              <span>{o.label}</span>
              {value === o.value && <AppIcon name="check" size={18} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
