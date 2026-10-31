import { OverviewPage } from "./OverviewPage";
import { BuildsPage } from "./BuildsPage";
import { ReleasesPage } from "./ReleasesPage";
import { ReleaseComposer } from "./ReleaseComposer";
import { MetricsPage } from "./MetricsPage";
import { ActivityPage } from "./ActivityPage";
import { SettingsPage } from "./SettingsPage";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AnimatePresence,
  motion,
  MotionConfig,
  useReducedMotion,
} from "framer-motion";
import { icon, date, duration, fmt, external } from "./format";
import { Modal, Status } from "./components";
import { BarChart, MetricChart, ActivityGrid } from "./Charts";
import { RunsTable } from "./RunsTable";

import type {
  Page,
  Config,
  Metrics,
  Platform,
  Run,
  RunDetail,
  Snapshot,
} from "../shared/types";
import { AdminApi } from "./api";
import { signIn, signOut, token } from "./auth";

const nav: { name: Page; icon: string }[] = [
  { name: "Overview", icon: "Grid2X2" },
  { name: "Builds", icon: "Clipboard" },
  { name: "Releases", icon: "ArrowUp" },
  { name: "Metrics", icon: "ChartNoAxesCombined" },
  { name: "Activity", icon: "Clock" },
  { name: "Settings", icon: "Settings" },
];
export function App({ config }: { config: Config }) {
  const api = useMemo(() => new AdminApi(config), [config]);
  const [page, setPage] = useState<Page>("Overview");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(
    config.mode === "demo" || !!token(),
  );
  const [menu, setMenu] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [buildOpen, setBuildOpen] = useState(false);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [platform, setPlatform] = useState<Platform>("android");
  const [deployOpen, setDeployOpen] = useState(false);
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [animations, setAnimations] = useState(
    localStorage.getItem("admin-animations") !== "off",
  );
  const reduced = useReducedMotion() === true || !animations;
  const refreshBusy = useRef(false);
  const openRunId = useRef<number | null>(null);
  useEffect(() => {
    openRunId.current =
      detail && detail.run.status !== "completed" ? detail.run.id : null;
  }, [detail?.run.id, detail?.run.status]);
  const refresh = useCallback(async () => {
    if (refreshBusy.current || !authenticated) return;
    refreshBusy.current = true;
    try {
      const [data, met] = await Promise.allSettled([
        api.snapshot(),
        api.metrics(),
      ]);
      if (data.status === "fulfilled") {
        setSnapshot(data.value);
        setError("");
      } else setError(data.reason.message);
      if (met.status === "fulfilled") setMetrics(met.value);
      else
        setNotice(
          "API metrics unavailable. Check CloudWatch permissions or retry.",
        );
      // Refresh an open job after the two summary calls, keeping concurrency
      // within the small Lambda reservation. Never reopen a closed dialog.
      const runId = openRunId.current;
      if (runId !== null) {
        try {
          const next = await api.detail(runId);
          setDetail((current) => (current?.run.id === runId ? next : current));
        } catch {
          if (openRunId.current === runId)
            setNotice(
              "Build details could not refresh. Open the GitHub logs or retry shortly.",
            );
        }
      }
      if (config.mode === "live" && !token()) setAuthenticated(false);
    } finally {
      refreshBusy.current = false;
      setLoading(false);
    }
  }, [api, authenticated, config.mode]);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 15000);
    return () => clearInterval(timer);
  }, [refresh]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 7000);
    return () => clearTimeout(timer);
  }, [notice]);
  async function action(fn: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError("");
    try {
      await fn();
      setNotice(message);
      await refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed. Please retry.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function openRun(id: number) {
    await action(async () => setDetail(await api.detail(id)), "");
  }
  async function artifactDownload(id: number) {
    await action(async () => {
      const { url } = await api.download(id);
      const a = document.createElement("a");
      a.href = url;
      a.rel = "noopener noreferrer";
      a.click();
    }, "Download requested. GitHub artifacts contain the build and checksum.");
  }
  const runs = snapshot?.runs || [];
  const completed = runs.filter((r) => r.status === "completed");
  const successes = completed.filter((r) => r.conclusion === "success").length;
  const average = completed.length
    ? completed.reduce((s, r) => s + r.duration, 0) / completed.length
    : 0;
  const active = runs.filter((r) => r.status !== "completed").length;
  const filtered = runs.filter(
    (r) =>
      (filter === "all" || r.platform === filter || r.conclusion === filter) &&
      `${r.name} ${r.title} ${r.sha}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const go = (name: Page) => {
    setPage(name);
    setMenu(false);
    setQuery("");
    setFilter("all");
    window.scrollTo({ top: 0 });
  };
  if (!authenticated)
    return (
      <div className="login">
        <div className="brand-mark">{icon("Flower2", 25)}</div>
        <span className="eyebrow">TWILIGHT CONTROL</span>
        <h1>
          Your app.
          <br />
          One quiet command center.
        </h1>
        <p>
          Build, release, and observe Twilight Garden.
          <br />
          Private access. Protected with MFA.
        </p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button
          className="primary"
          onClick={() => void signIn(config).catch((e) => setError(e.message))}
        >
          {icon("Lock", 18)} Sign in securely {icon("ArrowRight", 18)}
        </button>
        <small>Invite-only admin access · AWS Cognito</small>
      </div>
    );
  return (
    <MotionConfig reducedMotion={reduced ? "always" : "user"}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="console">
        <aside className={menu ? "sidebar open" : "sidebar"}>
          <a
            className="brand"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              go("Overview");
            }}
          >
            <span className="brand-mark">{icon("Flower2", 23)}</span>Twilight
            <span className="brand-control">/ control</span>
          </a>
          <div className="workspace">
            <span className="workspace-avatar">TG</span>
            <div>
              <strong>Twilight Garden</strong>
              <small>Personal workspace</small>
            </div>
            {icon("ChevronDown", 15)}
          </div>
          <span className="nav-label">WORKSPACE</span>
          <nav>
            {nav.slice(0, 5).map((n) => (
              <button
                key={n.name}
                onClick={() => go(n.name)}
                aria-current={page === n.name ? "page" : undefined}
                className={page === n.name ? "nav-item selected" : "nav-item"}
              >
                {icon(n.icon, 19)}
                {n.name}
                {n.name === "Builds" && active > 0 && (
                  <span className="nav-count">{active}</span>
                )}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="infra-card">
              <span className="dot" /> AWS · Mumbai
              <small>
                Serverless by design.
                <br />
                Ready when you are.
              </small>
              <button onClick={() => go("Settings")}>
                Infrastructure settings {icon("ArrowOut", 14)}
              </button>
            </div>
            <button
              className={page === "Settings" ? "nav-item selected" : "nav-item"}
              onClick={() => go("Settings")}
            >
              {icon("Settings", 19)}Settings
            </button>
            <div className="account">
              <span className="account-avatar">A</span>
              <div>
                <strong>Administrator</strong>
                <small>
                  {config.mode === "demo"
                    ? "Local demo session"
                    : "Private admin session"}
                </small>
              </div>
              {config.mode === "live" && (
                <button
                  className="icon-button"
                  aria-label="Sign out"
                  onClick={() => signOut(config)}
                >
                  {icon("Logout", 18)}
                </button>
              )}
            </div>
          </div>
        </aside>
        {menu && (
          <button
            className="sidebar-cover"
            aria-label="Close navigation"
            onClick={() => setMenu(false)}
          />
        )}
        <div className="content">
          <header className="topbar">
            <div className="breadcrumb">
              <button
                className="mobile-menu icon-button"
                aria-label="Open navigation"
                onClick={() => setMenu(!menu)}
              >
                {icon("Menu")}
              </button>
              <span>Workspace</span>
              {icon("ChevronRight", 14)}
              <strong>{page}</strong>
            </div>
            <div className="topbar-actions">
              <span className="connection">
                <i className="dot" />
                {config.mode === "demo"
                  ? "Demo environment"
                  : "Live environment"}
              </span>
              <button
                className="icon-button"
                aria-label="Refresh data"
                onClick={() => void refresh()}
                disabled={busy}
              >
                {icon("RefreshCw", 18)}
              </button>
              <a
                className="icon-button"
                {...external}
                href="https://github.com/AdityaRoy999/twilightgarden"
                aria-label="Open repository"
              >
                {icon("ArrowOut", 18)}
              </a>
            </div>
          </header>
          <main id="main">
            <div className="page-heading">
              <div>
                <span className="eyebrow">TWILIGHT GARDEN / OPERATIONS</span>
                <h1>
                  {page === "Overview"
                    ? "Everything, in view."
                    : page === "Builds"
                      ? "From commit to device."
                      : page === "Releases"
                        ? "Ship with intention."
                        : page === "Metrics"
                          ? "A pulse on your console."
                          : page === "Activity"
                            ? "Every action, accounted for."
                            : "Make it yours."}
                </h1>
                <p>
                  {page === "Overview"
                    ? "A little clarity for everything you’re building."
                    : page === "Builds"
                      ? "Your iOS and Android pipelines, together in one place."
                      : page === "Releases"
                        ? "Production status and deliberate deployments."
                        : page === "Metrics"
                          ? "Real AWS Lambda measurements. Last 24 hours, in your local time."
                          : page === "Activity"
                            ? "An admin audit trail, without private user content."
                            : "Connections, preferences, and cost-aware controls."}
                </p>
              </div>
              <button
                className="primary"
                onClick={() => setBuildOpen(true)}
                disabled={snapshot?.paused || busy}
              >
                {icon("Plus", 18)}New build
              </button>
            </div>
            {config.mode === "demo" && (
              <div className="demo-banner">
                {icon("Monitor", 16)}
                <span>
                  <strong>Local preview</strong> — sample data only. Actions
                  here never trigger builds or deployments.
                </span>
                <button onClick={() => go("Settings")}>
                  Connect AWS {icon("ArrowRight", 15)}
                </button>
              </div>
            )}
            {error && (
              <div className="alert error" role="alert">
                {icon("AlertCircle", 18)}
                <span>{error}</span>
                <button
                  className="icon-button"
                  aria-label="Dismiss error"
                  onClick={() => setError("")}
                >
                  {icon("X", 16)}
                </button>
              </div>
            )}
            {notice && (
              <div className="alert" role="status">
                {icon("CheckCircle", 18)}
                {notice}
              </div>
            )}
            {loading && !snapshot ? (
              <div className="loading-grid" aria-label="Loading operations">
                <div />
                <div />
                <div />
                <div />
              </div>
            ) : (
              <motion.div
                key={page}
                initial={reduced ? false : { opacity: 0.6 }}
                animate={{ opacity: 1 }}
                transition={{ duration: reduced ? 0 : 0.15 }}
              >
                {(page === "Overview" || page === "Metrics") && (
                  <div className="stats">
                    <div className="stat">
                      <span>
                        {icon("Clipboard", 17)}Workflow runs
                        <em>Latest sample</em>
                      </span>
                      <strong>
                        {fmt(runs.length)}
                        <small>runs</small>
                      </strong>
                      <p>
                        Up to 100 recent GitHub runs
                        <span className="spark-bars">▁▃▂▅▃▆▅▇</span>
                      </p>
                    </div>
                    <div className="stat">
                      <span>
                        {icon("CheckCircle", 17)}Success rate
                        <em className="green">Completed</em>
                      </span>
                      <strong>
                        {completed.length
                          ? Math.round((successes / completed.length) * 100)
                          : "—"}
                        <small>%</small>
                      </strong>
                      <p>
                        {successes} successful / {completed.length} completed
                      </p>
                    </div>
                    <div className="stat">
                      <span>
                        {icon("Clock", 17)}Average build<em>Duration</em>
                      </span>
                      <strong>
                        {completed.length ? duration(average) : "—"}
                      </strong>
                      <p>Across completed runs</p>
                    </div>
                    <div className="stat">
                      <span>
                        {icon("Zap", 17)}Admin API
                        <em className="green">24 hours</em>
                      </span>
                      <strong>
                        {metrics ? fmt(metrics.requests) : "—"}
                        <small>requests</small>
                      </strong>
                      <p>
                        {metrics
                          ? `${Math.round(metrics.averageMs)} ms average Lambda duration`
                          : "Metrics awaiting data"}
                      </p>
                    </div>
                  </div>
                )}
                {page === "Overview" && (
                  <OverviewPage
                    runs={runs}
                    metrics={metrics}
                    go={go}
                    openRun={openRun}
                    setPlatform={setPlatform}
                    setBuildOpen={setBuildOpen}
                    busy={busy}
                    snapshot={snapshot}
                  />
                )}
                {page === "Builds" && (
                  <BuildsPage
                    filter={filter}
                    setFilter={setFilter}
                    query={query}
                    setQuery={setQuery}
                    filtered={filtered}
                    openRun={openRun}
                  />
                )}
                {page === "Releases" && (
                  <ReleasesPage
                    snapshot={snapshot}
                    busy={busy}
                    setDeployOpen={setDeployOpen}
                    setReleaseOpen={setReleaseOpen}
                    go={go}
                  />
                )}
                {page === "Metrics" && (
                  <MetricsPage
                    metrics={metrics}
                    active={active}
                    snapshot={snapshot}
                  />
                )}
                {page === "Activity" && <ActivityPage snapshot={snapshot} />}
                {page === "Settings" && (
                  <SettingsPage
                    config={config}
                    snapshot={snapshot}
                    busy={busy}
                    action={action}
                    api={api}
                    animations={animations}
                    setAnimations={setAnimations}
                  />
                )}
              </motion.div>
            )}
            <footer>
              <span>
                <i className="dot" />
                Twilight Control <b>·</b>{" "}
                {snapshot
                  ? `Updated ${new Date(snapshot.fetchedAt).toLocaleTimeString()}`
                  : "Waiting for data"}
              </span>
              <span>Built for a little more peace of mind.</span>
            </footer>
          </main>
        </div>
      </div>
      <AnimatePresence>
        {buildOpen && (
          <Modal
            title="Start a new build"
            reduced={reduced}
            close={() => {
              if (!busy) setBuildOpen(false);
            }}
          >
            <p className="body-copy">
              A fresh device build from <code>main</code>. GitHub runs the
              pipeline; this console tracks it.
            </p>
            <div className="build-choices">
              {(["android", "ios", "dmg"] as const).map((p) => (
                <button
                  key={p}
                  aria-pressed={platform === p}
                  className={platform === p ? "choice selected" : "choice"}
                  onClick={() => setPlatform(p)}
                >
                  {icon(p === "ios" ? "Smartphone" : "Monitor", 28)}
                  <strong>
                    {p === "ios" ? "iOS" : p === "dmg" ? "macOS" : "Android"}
                  </strong>
                  <small>
                    {p === "ios"
                      ? "Unsigned IPA"
                      : p === "dmg"
                        ? "Test DMG"
                        : "Debug APK"}
                  </small>
                </button>
              ))}
            </div>
            <div className="info-box">
              {icon("Shield", 18)}
              {platform === "ios"
                ? "You’ll sign the IPA with Sideloadly using your Apple ID."
                : platform === "dmg"
                  ? "Apple Silicon DMG: ad-hoc signed, not notarized. macOS installation warnings may apply."
                  : "Test APKs use debug signing. Production signing is a separate release step."}
            </div>
            {error && (
              <p className="alert error" role="alert">
                {error}
              </p>
            )}
            <button
              className="primary full"
              disabled={busy || snapshot?.paused}
              onClick={() =>
                void action(
                  () => api.build(platform, crypto.randomUUID()),
                  "Build request accepted. It may take a moment to appear.",
                ).then((ok) => {
                  if (ok) {
                    setBuildOpen(false);
                    go("Builds");
                  }
                })
              }
            >
              {icon("Play", 18)}
              {busy
                ? "Requesting build…"
                : `Build ${platform === "ios" ? "iOS" : platform === "dmg" ? "macOS" : "Android"}`}
            </button>
          </Modal>
        )}
      </AnimatePresence>
      {releaseOpen && (
        <ReleaseComposer
          api={api}
          busy={busy}
          paused={snapshot?.paused === true}
          error={error}
          reduced={reduced}
          close={() => setReleaseOpen(false)}
          action={action}
          done={() => {
            setReleaseOpen(false);
            go("Builds");
          }}
        />
      )}
      {deployOpen && (
        <Modal
          title="Deploy latest main?"
          reduced={reduced}
          close={() => {
            if (!busy) setDeployOpen(false);
          }}
        >
          <p className="body-copy">
            This requests a production deployment through your configured Vercel
            deploy hook. Only the configured main branch is deployed.
          </p>
          <div className="info-box">
            {icon("AlertCircle", 18)}Production changes may affect app users.
            Review the latest main commit before continuing.
          </div>
          <a
            className="text-button"
            href="https://github.com/AdityaRoy999/twilightgarden/commits/main"
            {...external}
          >
            Review commits {icon("ArrowOut", 16)}
          </a>
          <button
            className="primary full"
            disabled={busy}
            onClick={() =>
              void action(
                () => api.deploy(crypto.randomUUID()),
                "Deployment request accepted. Check Vercel for its final status.",
              ).then((ok) => {
                if (ok) setDeployOpen(false);
              })
            }
          >
            {busy ? "Requesting deployment…" : "Confirm production deployment"}
          </button>
        </Modal>
      )}
      {detail && (
        <Modal
          title={`Run #${detail.run.id}`}
          reduced={reduced}
          close={() => setDetail(null)}
        >
          <div className="detail-status">
            <h3>{detail.run.name}</h3>
            <Status run={detail.run} />
          </div>
          <p className="muted">
            {date(detail.run.createdAt)} ·{" "}
            <code>{detail.run.sha.slice(0, 7)}</code> · {detail.run.branch}
          </p>
          {detail.jobs.map((j) => (
            <div className="job" key={j.id}>
              <h3>{j.name}</h3>
              {j.steps.map((s, i) => (
                <div className="job-step" key={i}>
                  {icon(
                    s.conclusion === "success"
                      ? "CheckCircle"
                      : s.conclusion === "failure"
                        ? "AlertCircle"
                        : "Clock",
                    16,
                  )}
                  <span>{s.name}</span>
                  <small>{s.conclusion || s.status}</small>
                </div>
              ))}
            </div>
          ))}
          <h3>Artifacts</h3>
          {detail.artifacts.length ? (
            detail.artifacts.map((a) => (
              <div className="artifact" key={a.id}>
                <div>
                  <strong>{a.name}</strong>
                  <small>
                    {(a.size / 1048576).toFixed(1)} MB · expires{" "}
                    {date(a.expiresAt)}
                  </small>
                </div>
                <button
                  className="secondary"
                  disabled={busy || a.expired}
                  onClick={() => void artifactDownload(a.id)}
                >
                  {icon("Download", 17)}
                  {a.expired ? "Expired" : "ZIP"}
                </button>
              </div>
            ))
          ) : (
            <p className="muted">
              No artifact available yet. Verification-only runs do not produce
              an app.
            </p>
          )}
          <div className="release-actions">
            <a className="secondary" href={detail.run.url} {...external}>
              Full logs on GitHub {icon("ArrowOut", 16)}
            </a>
            {detail.run.status !== "completed" && (
              <button
                className="danger"
                disabled={busy}
                onClick={() =>
                  void action(
                    () => api.cancel(detail.run.id),
                    "Cancellation requested.",
                  ).then((ok) => {
                    if (ok) setDetail(null);
                  })
                }
              >
                Cancel run
              </button>
            )}
          </div>
        </Modal>
      )}
    </MotionConfig>
  );
}
