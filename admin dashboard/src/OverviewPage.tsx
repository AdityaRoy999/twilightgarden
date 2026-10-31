import type { Config, Snapshot, Metrics, Run, Page } from "../shared/types";
import type { AdminApi } from "./api";
import { icon, date, fmt, external } from "./format";
import { Status } from "./components";
import { BarChart, MetricChart, ActivityGrid } from "./Charts";
import { RunsTable } from "./RunsTable";

export function OverviewPage({
  runs,
  metrics,
  go,
  openRun,
  setPlatform,
  setBuildOpen,
  busy,
  snapshot,
}: {
  runs: Run[];
  metrics: Metrics | null;
  go: (page: Page) => void;
  openRun: (id: number) => Promise<void>;
  setPlatform: (p: "ios" | "android") => void;
  setBuildOpen: (on: boolean) => void;
  busy: boolean;
  snapshot: Snapshot | null;
}) {
  return (
    <>
      <div className="overview-grid">
        <section className="panel build-chart">
          <div className="panel-heading">
            <div>
              <h2>Build activity</h2>
              <p>Every run. A little more progress.</p>
            </div>
            <span className="quiet-label">
              <i className="dot" />
              Latest runs
            </span>
          </div>
          <BarChart runs={runs} />
          <div className="chart-totals">
            <div>
              <span>iOS BUILDS</span>
              <strong>
                {runs.filter((r) => r.platform === "ios").length}
                <small>unsigned IPA</small>
              </strong>
            </div>
            <div>
              <span>ANDROID BUILDS</span>
              <strong>
                {runs.filter((r) => r.platform === "android").length}
                <small>test APK</small>
              </strong>
            </div>
            <button onClick={() => go("Builds")}>
              All builds {icon("ArrowRight", 17)}
            </button>
          </div>
        </section>
        <section className="panel pipelines">
          <div className="panel-heading">
            <h2>Your pipelines</h2>
            {icon("Ellipsis", 20)}
          </div>
          {(["ios", "android"] as const).map((p) => {
            const latest = runs.find((r) => r.platform === p);
            return (
              <div className="pipeline" key={p}>
                <div className={`pipeline-icon ${p}`}>
                  {icon(p === "ios" ? "Smartphone" : "Monitor", 24)}
                </div>
                <div>
                  <strong>
                    {p === "ios" ? "iOS application" : "Android application"}
                  </strong>
                  <small>
                    {p === "ios"
                      ? "GitHub · macOS runner"
                      : "GitHub · Linux runner"}
                  </small>
                  {latest && <Status run={latest} />}
                </div>
                <button
                  className="icon-button"
                  aria-label={`Build ${p}`}
                  onClick={() => {
                    setPlatform(p);
                    setBuildOpen(true);
                  }}
                  disabled={busy || snapshot?.paused}
                >
                  {icon("Play", 20)}
                </button>
              </div>
            );
          })}
          <div className="privacy-note">
            {icon("Shield", 18)}
            <p>
              Your users’ private content stays private. This console reads
              operational metadata.
            </p>
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>A steady rhythm</h2>
              <p>Workflow history · 105 days</p>
            </div>
            {icon("CalendarDays", 19)}
          </div>
          <ActivityGrid runs={runs} />
          <div className="chart-caption">
            <span>Counts within the latest 100 runs</span>
            <span>
              Less <i className="legend-cell" />{" "}
              <i className="legend-cell warm" />{" "}
              <i className="legend-cell hot" /> More
            </span>
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Console traffic</h2>
              <p>
                {metrics
                  ? `${fmt(metrics.requests)} requests · ${metrics.errors} Lambda errors`
                  : "CloudWatch data unavailable"}
              </p>
            </div>
            <span className="quiet-label">24H</span>
          </div>
          <MetricChart metrics={metrics} />
        </section>
      </div>
      <section className="panel runs-panel">
        <div className="panel-heading">
          <h2>Recent builds</h2>
          <button className="text-button" onClick={() => go("Builds")}>
            View all {icon("ArrowRight", 16)}
          </button>
        </div>
        <RunsTable runs={runs.slice(0, 5)} open={(id) => void openRun(id)} />
      </section>
    </>
  );
}
