import React, { useMemo, useState } from "react";
import { AppIcon } from "../ui/Icons";
import { BotanicalBranch } from "../ui/BotanicalBranch";
import { LogSymbol } from "../ui/LogSymbol";
import { SpringModal } from "../ui/SpringModal";
import {
  historyDetails,
  historyEntries,
  historyKey,
  historyMood,
  type HistoryLog,
} from "../../lib/logHistory";
import { parseDateKey } from "../../lib/dates";

function MoodArt({ mood }: { mood: string }) {
  const solar: Record<string, string> = {
    calm: "Leaf",
    relaxed: "Flower2",
    happy: "Sun",
    grateful: "Sun",
    energetic: "Zap",
    swings: "Waves",
    frisky: "Heart",
  };
  return solar[mood] ? (
    <AppIcon name={solar[mood]} size={28} />
  ) : ["sad", "anxious", "irritated"].includes(mood) ? (
    <LogSymbol kind={mood} />
  ) : (
    <AppIcon name="Clipboard" size={25} />
  );
}
function HistoryBotanical() {
  return (
    <svg className="history-botanical" viewBox="0 0 150 150" aria-hidden="true">
      <path
        d="M5 150Q3 73 72 72T150 12V150Z"
        fill="currentColor"
        opacity=".1"
      />
      <BotanicalBranch transform="translate(40 0) scale(.78)" opacity={.24}/>
      <circle cx="72" cy="30" r="3" fill="currentColor" opacity=".3" />
      <circle cx="61" cy="46" r="2" fill="currentColor" opacity=".4" />
    </svg>
  );
}
export function HistoryLogDetails({
  log,
  onClose,
  readOnly = true,
  onEdit,
}: {
  log: HistoryLog | null;
  onClose: () => void;
  readOnly?: boolean;
  onEdit?: (date: string) => void;
}) {
  const mood = log ? historyMood(log) : null,
    details = log ? historyDetails(log) : null;
  const date = log
    ? parseDateKey(log.date).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "";
  return (
    <SpringModal
      open={!!log}
      onClose={onClose}
      label={log ? `Check-in for ${date}` : "Check-in details"}
      className="history-detail-modal"
    >
      {log && details && mood ? (
        <>
          <button
            type="button"
            className="history-close"
            aria-label="Close check-in"
            onClick={onClose}
          >
            <AppIcon name="X" size={23} />
          </button>
          <header className="history-detail-heading" data-tone={mood.tone}>
            <span className="history-mood-art">
              <MoodArt mood={mood.name} />
            </span>
            <h2>{date}</h2>
            <p>{readOnly ? "Shared check-in" : "Your check-in"}</p>
          </header>
          {details.notes.startsWith("[Sample history:") ? (
            <p className="history-sample">
              Sample entry · fictional test history
            </p>
          ) : null}
          <div className="history-detail-sections">
            <section>
              <h3>
                <AppIcon name="Smile" size={21} />
                Mood
              </h3>
              {details.moods.length ? (
                <div className="history-tags">
                  {details.moods.map((mood) => (
                    <span key={mood}>{mood}</span>
                  ))}
                </div>
              ) : (
                <p>Not logged</p>
              )}
            </section>
            {details.periodStarted ? (
              <p className="history-period-start">
                <AppIcon name="Droplet" size={21} />A new period started on this
                date.
              </p>
            ) : null}
            <div className="history-detail-metrics">
              <section>
                <h3>
                  <AppIcon name="Droplet" size={21} />
                  Flow
                </h3>
                <p>{log.flow || "Not logged"}</p>
              </section>
              <section>
                <h3>
                  <AppIcon name="Zap" size={21} />
                  Energy
                </h3>
                <p>{details.energy || "Not logged"}</p>
              </section>
              <section>
                <h3>
                  <AppIcon name="Moon" size={21} />
                  Sleep
                </h3>
                <p>
                  {details.sleep || "Not logged"}
                  {details.hours !== undefined && details.hours !== null
                    ? ` · ${details.hours} hours`
                    : ""}
                </p>
              </section>
            </div>
            <section>
              <h3>
                <AppIcon name="Sparkles" size={21} />
                Symptoms
              </h3>
              {details.symptoms.length ? (
                <div className="history-tags">
                  {details.symptoms.map((symptom) => (
                    <span key={symptom}>{symptom}</span>
                  ))}
                </div>
              ) : (
                <p>None logged</p>
              )}
            </section>
            {details.notes ? (
              <section className="history-note">
                <h3>
                  <AppIcon name="PenLine" size={21} />
                  Notes
                </h3>
                <p>{details.notes}</p>
              </section>
            ) : null}
          </div>
          {!readOnly && onEdit ? (
            <button
              type="button"
              className="reference-button history-edit"
              onClick={() => onEdit(log.date)}
            >
              <AppIcon name="PenLine" size={20} />
              Edit this check-in
            </button>
          ) : null}
        </>
      ) : null}
    </SpringModal>
  );
}
export function LogHistoryView({
  logs,
  readOnly = true,
  onEdit,
  onBack,
  initialView = "grid",
}: {
  logs: readonly HistoryLog[];
  readOnly?: boolean;
  onEdit?: (date: string) => void;
  onBack?: () => void;
  initialView?: "list" | "grid";
}) {
  const [view, setView] = useState(initialView),
    [selectedId, setSelectedId] = useState<string | null>(null),
    [limit, setLimit] = useState(30);
  const entries = useMemo(() => historyEntries(logs), [logs]);
  // Resolve selection against current shared rows. Revoked sharing or deleted
  // entries immediately removes the modal instead of retaining a copied record.
  const selected =
    entries.find((log) => historyKey(log) === selectedId) || null;
  return (
    <section className="log-history-view">
      <header className="history-header">
        {onBack ? (
          <button
            className="history-back"
            type="button"
            aria-label="Back"
            onClick={onBack}
          >
            <AppIcon name="ArrowLeft" size={26} />
          </button>
        ) : null}
        <div>
          <h2>Log History</h2>
          <p>
            {readOnly
              ? "The check-ins your partner has shared with you."
              : "Your check-ins, one day at a time."}
          </p>
        </div>
        <div
          className="history-view-toggle"
          role="group"
          aria-label="History layout"
        >
          {(["list", "grid"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-label={`${mode === "grid" ? "Grid" : "List"} view`}
              aria-pressed={view === mode}
              onClick={() => setView(mode)}
            >
              <AppIcon name={mode === "grid" ? "Grid2X2" : "List"} size={24} />
            </button>
          ))}
        </div>
      </header>
      {!entries.length ? (
        <div className="history-empty">
          <AppIcon name="Clipboard" size={40} />
          <h3>No check-ins yet</h3>
          <p>
            {readOnly
              ? "Shared entries will appear here when your partner logs them."
              : "Your saved moods, symptoms and notes will appear here."}
          </p>
        </div>
      ) : (
        <>
          <div className={`history-entries ${view}`}>
            {entries.slice(0, limit).map((log) => {
              const mood = historyMood(log),
                details = historyDetails(log),
                date = parseDateKey(log.date);
              return (
                <button
                  type="button"
                  key={historyKey(log)}
                  className="history-entry"
                  data-tone={mood.tone}
                  aria-label={`View check-in for ${date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`}
                  onClick={() => setSelectedId(historyKey(log))}
                >
                  <HistoryBotanical />
                  <time dateTime={log.date} className="history-date">
                    <span>
                      {date.toLocaleDateString("en-US", { month: "short" })}
                    </span>
                    <strong>{date.getDate()}</strong>
                    <small>{date.getFullYear()}</small>
                  </time>
                  <span className="history-mood-art">
                    <MoodArt mood={mood.name} />
                  </span>
                  <span className="history-summary">
                    <strong>
                      {mood.name}
                      {mood.additional ? ` +${mood.additional}` : ""}
                    </strong>
                    <span>
                      <i />
                      {details.symptoms.length}{" "}
                      {details.symptoms.length === 1 ? "symptom" : "symptoms"}
                    </span>
                  </span>
                  <span className="history-entry-arrow">
                    <AppIcon
                      name={view === "grid" ? "ArrowOut" : "ChevronRight"}
                      size={24}
                    />
                  </span>
                </button>
              );
            })}
          </div>
          {entries.length > limit ? (
            <button
              type="button"
              className="history-load-more"
              onClick={() => setLimit((value) => value + 30)}
            >
              Show more check-ins{" "}
              <span>
                {Math.min(limit, entries.length)} of {entries.length}
              </span>
              <AppIcon name="ChevronDown" size={19} />
            </button>
          ) : null}
        </>
      )}
      <HistoryLogDetails
        log={selected}
        onClose={() => setSelectedId(null)}
        readOnly={readOnly}
        onEdit={onEdit}
      />
    </section>
  );
}
