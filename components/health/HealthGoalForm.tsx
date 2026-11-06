import React, { useState } from "react";
import { SpringModal } from "../ui/SpringModal";
import { AppIcon } from "../ui/Icons";
import { GardenDatePicker } from "../ui/GardenDatePicker";
import { GardenSelect } from "../ui/GardenSelect";
import { GardenChoiceField } from "../ui/GardenChoiceField";
import {
  healthModes,
  modeLabels,
  validateHealthSettings,
  type HealthSettings,
} from "../../lib/reproductiveHealth";
import { localDateKey } from "../../lib/dates";
const journeyIcons = {
  cycle: "cycle",
  contraception: "verified_user",
  conceive: "eco",
  pregnancy: "favorite",
  postpartum: "medical_services",
  perimenopause: "spa",
};
export function HealthGoalForm({
  settings,
  onSave,
  onClose,
}: {
  settings: HealthSettings;
  onSave: (s: HealthSettings) => Promise<void>;
  onClose: () => void;
}) {
  const [s, set] = useState(settings),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const pregnancy = s.pregnancy || { lmp: "", status: "active" as const };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError("");
    try {
      validateHealthSettings(s);
      setBusy(true);
      await onSave(s);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save. Retry.");
    } finally {
      setBusy(false);
    }
  };
  const pregnancyDate = (
    key: "lmp" | "dueDate" | "outcomeDate",
    value: string,
  ) => set({ ...s, pregnancy: { ...pregnancy, [key]: value } });
  const methodDate = (key: "started" | "review", value: string) =>
    set({
      ...s,
      contraception: { method: "", ...s.contraception, [key]: value },
    });
  return (
    <SpringModal
      open
      label="Your health journey"
      onClose={busy ? undefined : onClose}
      className="health-modal"
      sheet
    >
      <header>
        <span className="health-badge">
          <AppIcon name="eco" size={26} />
        </span>
        <div>
          <h2>Your health journey</h2>
          <p>
            Choose the tools that feel right for you. You can change this any
            time.
          </p>
        </div>
        <button
          type="button"
          aria-label="Close health goals"
          disabled={busy}
          onClick={onClose}
        >
          <AppIcon name="close" size={24} />
        </button>
      </header>
      <form onSubmit={submit}>
        <div className="health-goals">
          {healthModes.map((mode) => (
            <button
              key={mode}
              type="button"
              disabled={busy}
              aria-pressed={s.mode === mode}
              onClick={() =>
                set({
                  ...s,
                  mode,
                  ...(mode === "pregnancy"
                    ? { pregnancy: { ...pregnancy, status: "active" } }
                    : {}),
                })
              }
            >
              <AppIcon name={journeyIcons[mode]} size={25} />
              {modeLabels[mode]}
            </button>
          ))}
        </div>
        {(s.mode === "pregnancy" || s.pregnancy) && (
          <fieldset>
            <legend>Pregnancy dates & visibility</legend>
            <p>
              Weeks start from the last period, usually before conception. Use
              the due date confirmed by your care team if available.
            </p>
            <div className="health-form-grid">
              <GardenDatePicker
                label="First day of last period"
                value={pregnancy.lmp}
                max={localDateKey()}
                disabled={busy}
                onChange={(v) => pregnancyDate("lmp", v)}
              />
              <GardenDatePicker
                label="Clinician-adjusted due date, optional"
                value={pregnancy.dueDate || ""}
                disabled={busy}
                onChange={(v) => pregnancyDate("dueDate", v)}
              />
              <GardenSelect
                label="Pregnancy status"
                value={pregnancy.status}
                disabled={busy}
                onChange={(v) => {
                  const status = v as typeof pregnancy.status;
                  set({
                    ...s,
                    mode:
                      status === "active" || status === "paused"
                        ? "pregnancy"
                        : "postpartum",
                    pregnancy: { ...pregnancy, status },
                  });
                }}
                options={[
                  {
                    value: "active",
                    label: "Active pregnancy",
                    icon: "favorite",
                  },
                  {
                    value: "paused",
                    label: "Pause pregnancy visuals",
                    icon: "pause",
                  },
                  { value: "birth", label: "Baby born", icon: "person" },
                  { value: "loss", label: "Pregnancy loss", icon: "spa" },
                  {
                    value: "ended",
                    label: "Pregnancy ended",
                    icon: "medical_services",
                  },
                ]}
              />
              {["birth", "loss", "ended"].includes(pregnancy.status) && (
                <GardenDatePicker
                  label="Date, optional"
                  value={pregnancy.outcomeDate || ""}
                  max={localDateKey()}
                  disabled={busy}
                  onChange={(v) => pregnancyDate("outcomeDate", v)}
                />
              )}
            </div>
            <p className="health-muted">
              Pausing or ending pregnancy mode stops the growing-baby view and
              pregnancy-test reminders. Calendar fertility estimates stay paused
              until you choose a cycle-tracking journey again. Your private
              journal stays with you.
            </p>
          </fieldset>
        )}
        {s.mode === "contraception" && (
          <fieldset>
            <legend>Your current method</legend>
            <div className="health-form-grid">
              <GardenChoiceField
                label="Method"
                value={s.contraception?.method || ""}
                disabled={busy}
                options={[
                  "Condoms / barriers",
                  "Combined pill",
                  "Progestogen-only pill",
                  "IUD / IUS",
                  "Implant",
                  "Injection",
                  "Patch",
                  "Vaginal ring",
                  "Other",
                  "None",
                ]}
                onChange={(method) =>
                  set({ ...s, contraception: { ...s.contraception, method } })
                }
              />
              <div className="garden-field-stack">
                <GardenDatePicker
                  label="Started, optional"
                  value={s.contraception?.started || ""}
                  disabled={busy}
                  onChange={(v) => methodDate("started", v)}
                />
                <GardenDatePicker
                  label="Review / replacement date, as advised"
                  value={s.contraception?.review || ""}
                  disabled={busy}
                  onChange={(v) => methodDate("review", v)}
                />
              </div>
            </div>
            <p className="health-muted">
              Set a private reminder separately. Do not use a calendar
              prediction to avoid pregnancy.
            </p>
          </fieldset>
        )}
        {error && (
          <p role="alert" className="health-error">
            {error}
          </p>
        )}
        <button type="submit" className="reference-button" disabled={busy}>
          {busy ? "Saving..." : "Save my journey"}
          <AppIcon name="check" size={20} />
        </button>
      </form>
    </SpringModal>
  );
}
