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
          <label>
            Journal date
            <input
              type="date"
              required
              max={localDateKey()}
              value={value.date}
              onInput={(e) => {
                const date = e.currentTarget.value;
                setValue((old) => ({ ...old, date }));
              }}
              onChange={(e) => setValue({ ...value, date: e.target.value })}
            />
          </label>
          <label>
            Title, optional
            <input
              value={value.title}
              maxLength={120}
              onChange={(e) => setValue({ ...value, title: e.target.value })}
            />
          </label>
          {spec.fields.map((f) => (
            <label key={f.key}>
              {f.label}
              {f.type === "select" ? (
                <select
                  value={String(value.values[f.key] ?? "")}
                  onChange={(e) => field(f.key, e.target.value, f.type)}
                >
                  <option value="">Choose, or leave unrecorded</option>
                  {f.options!.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={f.type}
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  maxLength={500}
                  value={String(value.values[f.key] ?? "")}
                  onInput={
                    f.type === "date" || f.type === "time"
                      ? (e) => field(f.key, e.currentTarget.value, f.type)
                      : undefined
                  }
                  onChange={(e) => field(f.key, e.target.value, f.type)}
                />
              )}
            </label>
          ))}
          <label className="health-full">
            Private notes
            <textarea
              maxLength={2000}
              rows={3}
              value={value.notes}
              onChange={(e) => setValue({ ...value, notes: e.target.value })}
            />
          </label>
        </div>
        <label className="health-check">
          <input
            type="checkbox"
            checked={value.shareWithPartner}
            disabled={!canShare && !value.shareWithPartner}
            onChange={(e) =>
              setValue({
                ...value,
                shareWithPartner: e.target.checked,
                shareCoupleId: e.target.checked ? coupleId : undefined,
              })
            }
          />
          <span>
            <strong>Share this entry with my linked partner</strong>
            <small>
              {canShare
                ? "Only this entry, for this connection. Existing health-sharing consent must remain enabled."
                : "Private by default. Enable health sharing in Privacy & safety and connect to share."}{" "}
              Previously viewed copies cannot be recalled.
            </small>
          </span>
        </label>
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
