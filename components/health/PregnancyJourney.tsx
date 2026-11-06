import React, { useState } from "react";
import { Link } from "react-router-dom";
import { PregnancyIllustration } from "./PregnancyIllustration";
import {
  pregnancyProgress,
  pregnancyStage,
  pregnancyStages,
  type HealthSettings,
} from "../../lib/reproductiveHealth";
import { parseDateKey } from "../../lib/dates";
import { AppIcon } from "../ui/Icons";
export function PregnancyJourney({
  settings,
  today,
  onSettings,
  onLog,
}: {
  settings: HealthSettings;
  today: string;
  onSettings: () => void;
  onLog: () => void;
}) {
  const progress = pregnancyProgress(settings.pregnancy, today);
  const [preview, setPreview] = useState<number | null>(null);
  if (!progress) return null;
  const week = preview ?? progress.weeks,
    stage = pregnancyStage(week);
  return (
    <section className="pregnancy-journey">
      <div className="pregnancy-hero reference-card">
        <div className="pregnancy-copy">
          <span className="bloom-eyebrow">
            {preview === null
              ? "Your pregnancy today"
              : "Exploring your timeline"}
          </span>
          <h2>
            {week} weeks{preview === null ? `, ${progress.day} days` : ""}
          </h2>
          <p className="pregnancy-stage-title">{stage.name}</p>
          <p>{stage.detail}</p>
          <div className="pregnancy-facts">
            <span>
              Trimester{" "}
              <strong>
                {preview === null
                  ? progress.trimester
                  : week < 13
                    ? 1
                    : week < 28
                      ? 2
                      : 3}
              </strong>
            </span>
            <span>
              Estimated due date
              <strong>
                {parseDateKey(progress.dueDate).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </strong>
            </span>
          </div>
          <div className="health-actions">
            <button className="reference-button" onClick={onLog}>
              A little check-in
              <AppIcon name="add" size={20} />
            </button>
            <button className="health-secondary" onClick={onSettings}>
              Dates & preferences
            </button>
          </div>
        </div>
        <PregnancyIllustration
          week={week + (preview === null ? progress.day / 7 : 0)}
          preview={preview !== null}
        />
      </div>
      <div className="pregnancy-timeline reference-card">
        <div>
          <h3>Little by little</h3>
          <p>
            {preview === null
              ? "Your stage updates each local calendar day."
              : "Previewing a stage does not change your pregnancy dates."}
          </p>
        </div>
        <label>
          Explore a week <output>{week}</output>
          <input
            aria-label="Explore pregnancy week"
            type="range"
            min="0"
            max="42"
            step="1"
            value={week}
            onChange={(e) => setPreview(Number(e.target.value))}
          />
        </label>
        <div className="pregnancy-milestones">
          {pregnancyStages
            .filter((s) => [4, 12, 20, 28, 36, 40].includes(s.week))
            .map((s) => (
              <button
                key={s.week}
                aria-pressed={week === s.week}
                onClick={() => setPreview(s.week)}
              >
                <span>{s.week}</span>weeks
              </button>
            ))}
        </div>
        {preview !== null && (
          <button className="health-secondary" onClick={() => setPreview(null)}>
            Back to my current week
          </button>
        )}
        <p className="health-muted">
          A cartoon guide to general development, not a scan, size measurement
          or wellbeing assessment. Due dates are estimates.{" "}
          <a
            href="https://www.nhs.uk/best-start-in-life/pregnancy/week-by-week-guide-to-pregnancy/"
            target="_blank"
            rel="noreferrer"
          >
            Read the NHS week-by-week guide
          </a>
          .
        </p>
        <Link to="/health?section=learn&article=movement">
          Movement concerns? Read when to seek help
          <AppIcon name="arrow_forward" size={18} />
        </Link>
      </div>
    </section>
  );
}
