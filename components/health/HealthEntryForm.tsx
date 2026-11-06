import { GardenCheckbox } from "../ui/GardenCheckbox";
import { GardenChoiceField } from "../ui/GardenChoiceField";
import { GardenDatePicker } from "../ui/GardenDatePicker";
import { GardenTimePicker } from "../ui/GardenTimePicker";
import React, { useState } from "react";
import { AppIcon } from "../ui/Icons";
import { SpringModal } from "../ui/SpringModal";
import {
  healthModules,
  healthEntryAlerts,
  validateHealthEntry,
  type HealthCategory,
  type HealthEntry,
} from "../../lib/reproductiveHealth";
import { localDateKey } from "../../lib/dates";
export function HealthEntryForm({
  category,
  entry,
  onClose,
  onSave,
  canShare,
  coupleId,
}: {
  category: HealthCategory;
  entry?: HealthEntry;
  onClose: () => void;
  onSave: (e: HealthEntry) => Promise<void>;
  canShare: boolean;
  coupleId?: string;
}) {
  const spec = healthModules[category];
  const [value, setValue] = useState<HealthEntry>(() =>
      entry
        ? {
            ...entry,
            shareWithPartner:
              entry.shareWithPartner && entry.shareCoupleId === coupleId,
          }
        : {
            id: crypto.randomUUID(),
            category,
            date: localDateKey(),
            title: "",
            notes: "",
            values: {},
            shareWithPartner: false,
          },
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const alerts = healthEntryAlerts(value);
  const field = (key: string, input: string, type: string) =>
    setValue((old) => ({
      ...old,
      values: {
        ...old.values,
        [key]: type === "number" && input !== "" ? Number(input) : input,
      },
    }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError("");
    try {
      validateHealthEntry(value);
      setBusy(true);
      await onSave(value);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save. Retry.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <SpringModal
      open
      onClose={busy ? undefined : onClose}
      label={entry ? "Edit health entry" : `Log ${spec.label.toLowerCase()}`}
      className="health-modal"
      sheet
    >
      <header>
        <span className="health-badge">
          <AppIcon name={spec.icon} size={26} />
        </span>
        <div>
          <h2>{entry ? "Edit entry" : spec.label}</h2>
          <p>{spec.description}</p>
        </div>
        <button
          type="button"
          aria-label="Close journal"
          onClick={onClose}
          disabled={busy}
        >
          <AppIcon name="close" size={24} />
        </button>
      </header>
      <form onSubmit={submit}>
        <div className="health-form-grid">
          <GardenDatePicker
            label="Journal date"
            value={value.date}
            max={localDateKey()}
            disabled={busy}
            onChange={(date) => setValue((old) => ({ ...old, date }))}
          />
          <label>
            Title, optional
            <input
              disabled={busy}
              value={value.title}
              maxLength={120}
              onChange={(e) => setValue({ ...value, title: e.target.value })}
            />
          </label>
          {spec.fields.map((f) => {
            const current = String(value.values[f.key] ?? "");
            const change = (input: string) => field(f.key, input, f.type);
            if (f.type === "select")
              return (
                <GardenChoiceField
                  key={f.key}
                  label={f.label}
                  value={current}
                  options={f.options!}
                  onChange={change}
                  context={f.key}
                  disabled={busy}
                />
              );
            if (f.type === "date")
              return (
                <GardenDatePicker
                  key={f.key}
                  label={f.label}
                  value={current}
                  onChange={change}
                  disabled={busy}
                />
              );
            if (f.type === "time")
              return (
                <GardenTimePicker
                  key={f.key}
                  label={f.label}
                  value={current}
                  onChange={change}
                  disabled={busy}
                />
              );
            return (
              <label key={f.key}>
                {f.label}
                <input
                  disabled={busy}
                  type={f.type}
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  maxLength={500}
                  value={current}
                  onChange={(e) => change(e.target.value)}
                />
              </label>
            );
          })}
          <label className="health-full">
            Private notes
            <textarea
              disabled={busy}
              maxLength={2000}
              rows={3}
              value={value.notes}
              onChange={(e) => setValue({ ...value, notes: e.target.value })}
            />
          </label>
        </div>
        <GardenCheckbox
          className="health-check"
          checked={value.shareWithPartner}
          disabled={busy || (!canShare && !value.shareWithPartner)}
          onChange={(checked) =>
            setValue({
              ...value,
              shareWithPartner: checked,
              shareCoupleId: checked ? coupleId : undefined,
            })
          }
        >
          <strong>Share this entry with my linked partner</strong>
          <small>
            {canShare
              ? "Only this entry, for this connection. Existing health-sharing consent must remain enabled."
              : "Private by default. Enable health sharing in Privacy & safety and connect to share."}{" "}
            Previously viewed copies cannot be recalled.
          </small>
        </GardenCheckbox>
        {alerts.map((a) => (
          <aside
            key={a.text}
            role="note"
            className={`health-notice ${a.level}`}
          >
            <AppIcon name="medical_services" size={23} />
            <div>
              <p>{a.text}</p>
              <a href={a.source} target="_blank" rel="noreferrer">
                Read the guidance
              </a>
            </div>
          </aside>
        ))}
        {error && (
          <p role="alert" className="health-error">
            {error}
          </p>
        )}
        <button className="reference-button" type="submit" disabled={busy}>
          {busy ? "Saving securely…" : "Save encrypted entry"}
          <AppIcon name="check" size={20} />
        </button>
      </form>
    </SpringModal>
  );
}
