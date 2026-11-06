import React, { useState, useMemo, useEffect, lazy, Suspense } from "react";

import { Link, useSearchParams } from "react-router-dom";

import { motion } from "framer-motion";

import { useReproductive } from "../contexts/ReproductiveContext";

import { usePrivacy } from "../contexts/PrivacyContext";

import { useCouples } from "../contexts/CouplesContext";

import { useData } from "../contexts/DataContext";

import { useToday } from "../hooks/useToday";

import { useAppMotion } from "../hooks/useAppMotion";

import { springs, motionTransition } from "../lib/motion";

import {
  healthModules,
  modeLabels,
  pregnancyProgress,
  testReminderDate,
  type HealthCategory,
  type HealthEntry,
} from "../lib/reproductiveHealth";

import { healthArticles, educationChecked } from "../lib/healthEducation";

import { predictCycle } from "../lib/cyclePrediction";

import { parseDateKey } from "../lib/dates";

import { ReferenceHeading } from "../components/ui/ReferenceArt";

import { AppIcon } from "../components/ui/Icons";

import { SpringModal } from "../components/ui/SpringModal";

import { HealthArt } from "../components/health/HealthArt";

import { PregnancyJourney } from "../components/health/PregnancyJourney";

import { HealthGoalForm } from "../components/health/HealthGoalForm";

import { HealthEntryForm } from "../components/health/HealthEntryForm";

const FertilityChart = lazy(() =>
  import("../components/health/FertilityChart").then((m) => ({
    default: m.FertilityChart,
  })),
);

const categories = Object.keys(healthModules) as HealthCategory[];

export default function Health() {
  const health = useReproductive(),
    { preferences } = usePrivacy(),
    { couple } = useCouples(),
    { cycleSettings, logs } = useData(),
    today = useToday(),
    { reduced } = useAppMotion();

  const [params, setParams] = useSearchParams();
  const raw = params.get("section") || "overview",
    section =
      raw === "learn" || categories.includes(raw as HealthCategory)
        ? raw
        : "overview";

  const [exporting, setExporting] = useState(false),
    [importRows, setImportRows] = useState<HealthEntry[] | null>(null),
    [importError, setImportError] = useState(""),
    [importBusy, setImportBusy] = useState(false);

  const [goals, setGoals] = useState(false),
    [editing, setEditing] = useState<{
      category: HealthCategory;
      entry?: HealthEntry;
    } | null>(null),
    [deleting, setDeleting] = useState<HealthEntry | null>(null),
    [discarding, setDiscarding] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [query, setQuery] = useState(""),
    [article, setArticle] = useState(params.get("article") || "");

  useEffect(() => {
    setArticle(params.get("article") || "");
  }, [params]);
  const prediction = useMemo(
    () => predictCycle(cycleSettings, logs, today),
    [cycleSettings, logs, today],
  );

  const progress = pregnancyProgress(health.settings.pregnancy, today),
    isPregnant = health.settings.mode === "pregnancy" && !!progress;

  const entries =
    section === "overview"
      ? health.entries
      : health.entries.filter((e) => e.category === section);

  const canShare =
    couple?.status === "active" &&
    couple.share_enabled &&
    preferences?.share_health === true;

  const openSection = (key: string) => {
    setParams(key === "overview" ? {} : { section: key });
    setQuery("");
  };

  const exportRecords = async () => {
    try {
      const { downloadHealthFile } = await import("../lib/healthPortability");
      await downloadHealthFile(
        JSON.stringify(
          {
            format: "twilight-health-v1",
            exported: today,
            settings: health.settings,
            entries: health.entries,
          },
          null,
          2,
        ),
        `twilight-private-health-${today}.json`,
        "application/json",
      );
    } catch {
      setImportError("Export could not be saved. Please retry.");
    }
  };

  const readImport = async (file?: File) => {
    if (!file) return;
    setImportError("");
    try {
      if (file.size > 2_000_000)
        throw new Error("Choose a file smaller than 2 MB.");
      const { parseHealthImport } = await import("../lib/healthPortability");
      setImportRows(
        parseHealthImport(
          await file.text(),
          file.name.toLowerCase().endsWith(".csv") ? "csv" : "json",
          today,
        ),
      );
      setExporting(false);
    } catch (e) {
      setImportError(
        e instanceof Error ? e.message : "Import could not be read.",
      );
    }
  };

  const remove = async () => {
    if (!deleting || busy) return;
    setBusy(true);
    try {
      await health.removeEntry(deleting);
      setDeleting(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete.");
    } finally {
      setBusy(false);
    }
  };

  const currentArticle = healthArticles.find((a) => a.id === article);

  return (
    <div className="reference-page reproductive-page">
      <ReferenceHeading
        title="Your health, your way"
        description="A little more understanding. At every stage."
        action={
          <button
            className="health-round"
            onClick={() => setGoals(true)}
            aria-label="Change health journey"
          >
            <AppIcon name="settings" size={24} />
          </button>
        }
      />

      <nav className="health-breadcrumb" aria-label="Health sections">
        <Link to="/dashboard">
          <AppIcon name="arrow_back" size={18} />
          Today
        </Link>
        <button
          aria-current={section === "overview" ? "page" : undefined}
          onClick={() => openSection("overview")}
        >
          My health
        </button>
        <button
          aria-current={section === "learn" ? "page" : undefined}
          onClick={() => openSection("learn")}
        >
          Learn
        </button>
        {section !== "overview" && section !== "learn" && (
          <span>{healthModules[section as HealthCategory].label}</span>
        )}
      </nav>

      {health.loading ? (
        <p role="status">Opening your encrypted journal…</p>
      ) : (
        <>
          {(health.error || health.pending > 0) && (
            <aside className="health-notice" role="status">
              <AppIcon name="sync" size={24} />
              <div>
                <p>
                  {health.error ||
                    `${health.pending} encrypted edit${health.pending === 1 ? "" : "s"} waiting to sync on this device.`}
                </p>
                <div className="health-actions">
                  <button onClick={() => void health.refresh()}>
                    Retry sync
                  </button>
                  {health.pending > 0 && (
                    <>
                      <button onClick={exportRecords}>
                        Export visible entries
                      </button>
                      <button onClick={() => setDiscarding(true)}>
                        Discard pending edits
                      </button>
                    </>
                  )}
                </div>
              </div>
            </aside>
          )}

          {section === "overview" && (
            <>
              {isPregnant ? (
                <PregnancyJourney
                  settings={health.settings}
                  today={today}
                  onSettings={() => setGoals(true)}
                  onLog={() => setEditing({ category: "pregnancy" })}
                />
              ) : (
                <section className="reference-card health-goal-card">
                  <div>
                    <span className="bloom-eyebrow">
                      A space that grows with you
                    </span>
                    <h2>{modeLabels[health.settings.mode]}</h2>
                    <p>
                      {health.settings.pregnancy &&
                      health.settings.pregnancy.status !== "active"
                        ? "Your pregnancy timeline is paused. Your journal remains private, and you can choose what comes next."
                        : "Choose your goal, keep a private journal and find the tools you need for this chapter."}
                    </p>
                    <button
                      className="health-secondary"
                      onClick={() => setGoals(true)}
                    >
                      Choose my journey
                      <AppIcon name="arrow_forward" size={20} />
                    </button>
                  </div>
                  <HealthArt
                    kind={
                      health.settings.mode === "postpartum"
                        ? "postpartum"
                        : health.settings.mode === "conceive"
                          ? "fertility"
                          : "goal"
                    }
                  />
                </section>
              )}

              {health.settings.mode === "contraception" &&
                health.settings.contraception?.method && (
                  <section className="reference-card health-method">
                    <AppIcon name="verified_user" size={30} />
                    <div>
                      <h3>{health.settings.contraception.method}</h3>
                      <p>
                        {health.settings.contraception.review
                          ? `Review date: ${parseDateKey(health.settings.contraception.review).toLocaleDateString()}`
                          : "Follow the schedule advised for your method."}
                      </p>
                    </div>
                    <button
                      onClick={() => setEditing({ category: "reminder" })}
                    >
                      Set reminder
                    </button>
                  </section>
                )}

              {["cycle", "conceive", "perimenopause"].includes(
                health.settings.mode,
              ) && (
                <section className="reference-card health-prediction">
                  <h3>What your history tells us</h3>
                  <strong>
                    {prediction.length} days{" "}
                    <span>
                      {prediction.source === "observed"
                        ? "typical recorded cycle"
                        : "configured cycle length"}
                    </span>
                  </strong>
                  <p>
                    {prediction.cycles > 1
                      ? `Observed range: ${prediction.min}–${prediction.max} days, across ${prediction.cycles} recorded intervals.`
                      : "More recorded period starts will help describe your own pattern. A single cycle cannot establish a reliable range."}
                    {cycleSettings.irregularCycle
                      ? " Predictions are disabled for your irregular-cycle setting."
                      : ""}
                  </p>
                  <p className="health-muted">
                    These are calendar estimates, not confirmation of ovulation
                    or contraception.
                  </p>
                </section>
              )}

              <section className="health-module-grid" aria-label="Health tools">
                {categories.map((category) => (
                  <button
                    key={category}
                    className="reference-card health-module"
                    onClick={() => openSection(category)}
                  >
                    <HealthArt kind={category} />
                    <span className="health-module-label">
                      <AppIcon name={healthModules[category].icon} size={22} />
                      <strong>{healthModules[category].label}</strong>
                      <AppIcon name="arrow_forward" size={18} />
                    </span>
                    <p>{healthModules[category].description}</p>
                  </button>
                ))}
              </section>

              <button
                className="reference-card health-learn-link"
                onClick={() => openSection("learn")}
              >
                <HealthArt kind="learn" />
                <span>
                  <h2>A little understanding</h2>
                  <p>
                    Source-linked information about cycles, sexual health,
                    pregnancy and recovery.
                  </p>
                </span>
                <AppIcon name="arrow_forward" size={24} />
              </button>
            </>
          )}

          {section === "learn" ? (
            <section className="health-education">
              <div className="health-section-title">
                <div>
                  <h2>Learn at your own pace</h2>
                  <p>
                    Original summaries with links to health authorities. Not
                    individual medical advice.
                  </p>
                </div>
              </div>
              <label className="health-search">
                Search health topics
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Pregnancy, contraception, pain…"
                />
              </label>
              <div className="health-article-grid">
                {healthArticles
                  .filter((a) =>
                    `${a.title} ${a.topic} ${a.body}`
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                  )
                  .map((a) => (
                    <button
                      className="reference-card"
                      key={a.id}
                      onClick={() => setArticle(a.id)}
                    >
                      <span className="bloom-eyebrow">{a.topic}</span>
                      <h3>{a.title}</h3>
                      <p>{a.body}</p>
                      <span className="health-read">
                        Read & view source
                        <AppIcon name="arrow_forward" size={18} />
                      </span>
                    </button>
                  ))}
              </div>
              <p className="health-muted">
                Source links checked {educationChecked}. Clinical editorial
                review is still required before public health claims.
              </p>
            </section>
          ) : (
            <>
              {section !== "overview" && (
                <section className="reference-card health-category-hero">
                  <div>
                    <span className="bloom-eyebrow">
                      A private place to notice
                    </span>
                    <h2>{healthModules[section as HealthCategory].label}</h2>
                    <p>
                      {healthModules[section as HealthCategory].description}
                    </p>
                    <button
                      className="reference-button"
                      onClick={() =>
                        setEditing({ category: section as HealthCategory })
                      }
                    >
                      Add an entry
                      <AppIcon name="add" size={20} />
                    </button>
                  </div>
                  <HealthArt kind={section as HealthCategory} />
                </section>
              )}

              {section === "fertility" && (
                <Suspense
                  fallback={
                    <p role="status">Opening your observation chart…</p>
                  }
                >
                  <FertilityChart entries={health.entries} />
                </Suspense>
              )}

              {section === "reminder" && (
                <aside className="health-notice">
                  <AppIcon name="notifications" size={24} />
                  <p>
                    Scheduled alerts require the iOS or Android app with
                    notifications enabled. Browsers keep reminder dates in the
                    journal. The app schedules up to 40 upcoming alerts, with
                    daily reminders for 7 days and appointments within 32 days;
                    reopen it to refresh the schedule. Device settings may delay
                    alerts.
                  </p>
                </aside>
              )}

              {section === "intimacy" && (
                <aside className="health-notice">
                  <AppIcon name="info" size={24} />
                  <div>
                    <p>
                      Protection failed or unprotected sex? Seek qualified
                      advice about emergency contraception promptly. Do not wait
                      for a calendar estimate.
                    </p>
                    <a
                      href="https://www.who.int/news-room/fact-sheets/detail/emergency-contraception"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Emergency contraception information
                    </a>
                  </div>
                </aside>
              )}

              <section className="health-journal">
                <div className="health-section-title">
                  <h2>
                    {section === "overview"
                      ? "Recent check-ins"
                      : "Your journal"}
                  </h2>
                  <button
                    className="health-secondary"
                    onClick={() => setExporting(true)}
                  >
                    <AppIcon name="download" size={19} />
                    Import / export
                  </button>
                </div>
                {entries.length === 0 ? (
                  <div className="reference-card health-empty">
                    <HealthArt
                      kind={
                        section === "overview"
                          ? "goal"
                          : (section as HealthCategory)
                      }
                    />
                    <h3>A fresh page, just for you</h3>
                    <p>Nothing is assumed. Add an entry whenever you want.</p>
                  </div>
                ) : (
                  <div className="health-entry-grid">
                    {entries
                      .slice(0, section === "overview" ? 4 : 100)
                      .map((e) => (
                        <motion.article
                          className="reference-card health-entry"
                          key={e.id}
                          initial={reduced ? false : { opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={motionTransition(
                            springs.section,
                            reduced,
                          )}
                        >
                          <div className="health-entry-top">
                            <span className="health-badge">
                              <AppIcon
                                name={healthModules[e.category].icon}
                                size={25}
                              />
                            </span>
                            <div>
                              <span className="bloom-eyebrow">
                                {healthModules[e.category].label}
                              </span>
                              <h3>
                                {e.title ||
                                  parseDateKey(e.date).toLocaleDateString(
                                    undefined,
                                    {
                                      weekday: "short",
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                    },
                                  )}
                              </h3>
                              {e.title && (
                                <small>
                                  {parseDateKey(e.date).toLocaleDateString()}
                                </small>
                              )}
                            </div>
                          </div>
                          <dl>
                            {Object.entries(e.values)
                              .filter(
                                ([, v]) => v !== "" && v !== "Not recorded",
                              )
                              .map(([k, v]) => (
                                <div key={k}>
                                  <dt>
                                    {healthModules[e.category].fields.find(
                                      (f) => f.key === k,
                                    )?.label || k}
                                  </dt>
                                  <dd>{String(v)}</dd>
                                </div>
                              ))}
                          </dl>
                          {e.notes && (
                            <p className="health-entry-note">{e.notes}</p>
                          )}
                          {e.category === "intimacy" &&
                            e.values.protection === "None" && (
                              <p className="health-muted">
                                If pregnancy is possible and the next period
                                date is unknown: test from{" "}
                                {parseDateKey(
                                  testReminderDate(e.date),
                                ).toLocaleDateString()}
                                . Follow test instructions.
                              </p>
                            )}
                          <footer>
                            <span>
                              <AppIcon
                                name={
                                  e.shareWithPartner &&
                                  e.shareCoupleId === couple?.id &&
                                  canShare
                                    ? "group"
                                    : "lock"
                                }
                                size={16}
                              />
                              {e.shareWithPartner &&
                              e.shareCoupleId === couple?.id &&
                              canShare
                                ? "Shared with this connection"
                                : "Only you"}
                            </span>
                            <button
                              aria-label={`Edit ${e.title || e.date}`}
                              onClick={() =>
                                setEditing({ category: e.category, entry: e })
                              }
                            >
                              <AppIcon name="edit" size={20} />
                            </button>
                            <button
                              aria-label={`Delete ${e.title || e.date}`}
                              onClick={() => {
                                setError("");
                                setDeleting(e);
                              }}
                            >
                              <AppIcon name="delete" size={20} />
                            </button>
                          </footer>
                        </motion.article>
                      ))}
                  </div>
                )}
                {entries.length > 100 && (
                  <p>
                    Showing the latest 100 entries. Export to include your
                    complete journal.
                  </p>
                )}
              </section>
            </>
          )}

          <aside className="health-private-footnote">
            <AppIcon name="lock" size={18} />
            <p>
              Encrypted on your device. New entries are private. External source
              links open another provider. Exports are readable files—store them
              privately.
            </p>
          </aside>
        </>
      )}

      {goals && (
        <HealthGoalForm
          settings={health.settings}
          onSave={health.saveSettings}
          onClose={() => setGoals(false)}
        />
      )}

      {editing && (
        <HealthEntryForm
          key={editing.entry?.id || editing.category}
          {...editing}
          onClose={() => setEditing(null)}
          onSave={health.saveEntry}
          canShare={canShare}
          coupleId={couple?.id}
        />
      )}

      <SpringModal
        open={exporting}
        label="Your journal files"
        onClose={() => setExporting(false)}
        className="health-modal health-small"
      >
        <h2>Your journal, with you</h2>
        <p>
          Exports are readable files and can contain sexual health, pregnancy
          and other private entries. Choose where to save or share them.
        </p>
        <button
          className="reference-button"
          onClick={() => void exportRecords()}
        >
          Export JSON
          <AppIcon name="download" size={20} />
        </button>
        <button
          className="health-secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const { exportReproductivePDF } = await import(
                "../lib/healthPortability"
              );
              await exportReproductivePDF(health.settings, health.entries);
            } catch {
              setImportError("The report could not be saved. Retry.");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Preparing…" : "Export a PDF journal"}
        </button>
        <label>
          Import a journal or fertility CSV
          <input
            type="file"
            accept=".json,.csv,application/json,text/csv"
            onChange={(e) => void readImport(e.target.files?.[0])}
          />
        </label>
        <p className="health-muted">
          Up to 100 entries / 2 MB. Imported entries get new IDs and stay
          private. CSV columns: date,temperature,mucus,lh,test. Temperatures use
          °C. This is manual import; direct Apple Health / Health Connect sync
          is not connected.
        </p>
        {importError && <p role="alert">{importError}</p>}
        <button
          className="health-secondary"
          onClick={() => setExporting(false)}
        >
          Close
        </button>
      </SpringModal>

      <SpringModal
        open={importRows !== null}
        label="Confirm journal import"
        onClose={importBusy ? undefined : () => setImportRows(null)}
        className="health-modal health-small"
      >
        <h2>Import {importRows?.length} private entries?</h2>
        <p>
          Existing records stay unchanged. Re-importing the same file creates
          additional entries. Each imported entry starts private. Journey
          settings are not imported automatically.
        </p>
        {importError && <p role="alert">{importError}</p>}
        <div className="health-actions">
          <button
            className="health-secondary"
            disabled={importBusy}
            onClick={() => setImportRows(null)}
          >
            Cancel
          </button>
          <button
            className="reference-button"
            disabled={importBusy}
            onClick={async () => {
              if (!importRows) return;
              setImportBusy(true);
              try {
                let remaining = [...importRows];
                for (const entry of importRows) {
                  await health.saveEntry(entry);
                  remaining = remaining.slice(1);
                  setImportRows(remaining);
                }
                setImportRows(null);
                setExporting(false);
              } catch {
                setImportError(
                  "Import paused. Entries already saved are kept; retry imports only the remaining entries.",
                );
              } finally {
                setImportBusy(false);
              }
            }}
          >
            {importBusy ? "Importing securely…" : "Import entries"}
          </button>
        </div>
      </SpringModal>

      <SpringModal
        open={!!deleting}
        label="Delete health entry"
        onClose={busy ? undefined : () => setDeleting(null)}
        className="health-modal health-small"
      >
        <h2>Remove this entry?</h2>
        <p>
          This removes it from your journal and revokes future shared access. It
          cannot remove copies someone already viewed or exported.
        </p>
        {error && <p role="alert">{error}</p>}
        <div className="health-actions">
          <button
            className="health-secondary"
            disabled={busy}
            onClick={() => setDeleting(null)}
          >
            Keep entry
          </button>
          <button
            className="reference-button"
            disabled={busy}
            onClick={() => void remove()}
          >
            {busy ? "Removing…" : "Remove entry"}
          </button>
        </div>
      </SpringModal>

      <SpringModal
        open={discarding}
        label="Discard offline edits"
        onClose={() => setDiscarding(false)}
        className="health-modal health-small"
      >
        <h2>Discard pending local edits?</h2>
        <p>
          Export your visible entries first if you want to keep them. Server
          records will be loaded again. Unsynced changes on this device will be
          lost.
        </p>
        <div className="health-actions">
          <button
            className="health-secondary"
            onClick={() => setDiscarding(false)}
          >
            Keep edits
          </button>
          <button
            className="reference-button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await health.discard();
                setDiscarding(false);
              } finally {
                setBusy(false);
              }
            }}
          >
            Discard edits
          </button>
        </div>
      </SpringModal>

      <SpringModal
        open={!!currentArticle}
        label={currentArticle?.title}
        onClose={() => setArticle("")}
        className="health-modal health-small"
      >
        <span className="bloom-eyebrow">{currentArticle?.topic}</span>
        <h2>{currentArticle?.title}</h2>
        <p>{currentArticle?.body}</p>
        <p className="health-muted">
          Educational summary. Seek individual advice from a qualified
          professional. Clinical editorial review pending.
        </p>
        <a
          className="reference-button"
          href={currentArticle?.url}
          target="_blank"
          rel="noreferrer"
        >
          Open source guidance
          <AppIcon name="open_in_new" size={20} />
        </a>
        <button className="health-secondary" onClick={() => setArticle("")}>
          Close
        </button>
      </SpringModal>
    </div>
  );
}
