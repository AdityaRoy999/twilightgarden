import React, { useState } from "react";
import { SpringModal } from "../ui/SpringModal";
import { AppIcon } from "../ui/Icons";
import {
  healthModes,
  modeLabels,
  validateHealthSettings,
  type HealthSettings,
} from "../../lib/reproductiveHealth";
import { localDateKey } from "../../lib/dates";
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
              <label>
                First day of last period
                <input
                  type="date"
                  max={localDateKey()}
                  value={pregnancy.lmp}
                  onInput={(e) =>
                    set({
                      ...s,
                      pregnancy: { ...pregnancy, lmp: e.currentTarget.value },
                    })
                  }
                  onChange={(e) =>
                    set({
                      ...s,
                      pregnancy: { ...pregnancy, lmp: e.target.value },
                    })
                  }
                />
              </label>
              <label>
                Clinician-adjusted due date, optional
                <input
                  type="date"
                  value={pregnancy.dueDate || ""}
                  onInput={(e) =>
                    set({
                      ...s,
                      pregnancy: {
                        ...pregnancy,
                        dueDate: e.currentTarget.value,
                      },
                    })
                  }
                  onChange={(e) =>
                    set({
                      ...s,
                      pregnancy: { ...pregnancy, dueDate: e.target.value },
                    })
                  }
                />
              </label>
              <label>
                Pregnancy status
                <select
                  value={pregnancy.status}
                  onChange={(e) => {
                    const status = e.target.value as typeof pregnancy.status;
                    set({
                      ...s,
                      mode:
                        status === "active" || status === "paused"
                          ? "pregnancy"
                          : "postpartum",
                      pregnancy: { ...pregnancy, status },
                    });
                  }}
                >
                  <option value="active">Active pregnancy</option>
                  <option value="paused">Pause pregnancy visuals</option>
                  <option value="birth">Baby born</option>
                  <option value="loss">Pregnancy loss</option>
                  <option value="ended">Pregnancy ended</option>
                </select>
              </label>
              {["birth", "loss", "ended"].includes(pregnancy.status) && (
                <label>
                  Date, optional
                  <input
                    type="date"
                    max={localDateKey()}
                    value={pregnancy.outcomeDate || ""}
                    onInput={(e) =>
                      set({
                        ...s,
                        pregnancy: {
                          ...pregnancy,
                          outcomeDate: e.currentTarget.value,
                        },
                      })
                    }
                    onChange={(e) =>
                      set({
                        ...s,
                        pregnancy: {
                          ...pregnancy,
                          outcomeDate: e.target.value,
                        },
                      })
                    }
                  />
                </label>
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
              <label>
                Method
                <select
                  value={s.contraception?.method || ""}
                  onChange={(e) =>
                    set({
                      ...s,
                      contraception: {
                        ...s.contraception,
                        method: e.target.value,
                      },
                    })
                  }
                >
                  <option value="">Choose a method</option>
                  {[
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
                  ].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label>
                Started, optional
                <input
                  type="date"
                  value={s.contraception?.started || ""}
                  onInput={(e) =>
                    set({
                      ...s,
                      contraception: {
                        ...s.contraception,
                        method: s.contraception?.method || "",
                        started: e.currentTarget.value,
                      },
                    })
                  }
                  onChange={(e) =>
                    set({
                      ...s,
                      contraception: {
                        method: "",
                        ...s.contraception,
                        started: e.target.value,
                      },
                    })
                  }
                />
              </label>
              <label>
                Review / replacement date, as advised
                <input
                  type="date"
                  value={s.contraception?.review || ""}
                  onInput={(e) =>
                    set({
                      ...s,
                      contraception: {
                        ...s.contraception,
                        method: s.contraception?.method || "",
                        review: e.currentTarget.value,
                      },
                    })
                  }
                  onChange={(e) =>
                    set({
                      ...s,
                      contraception: {
                        method: "",
                        ...s.contraception,
                        review: e.target.value,
                      },
                    })
                  }
                />
              </label>
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
          {busy ? "Saving…" : "Save my journey"}
          <AppIcon name="check" size={20} />
        </button>
      </form>
    </SpringModal>
  );
}
