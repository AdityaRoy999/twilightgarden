import type { Config, Snapshot, Metrics, Run, Page } from "../shared/types";
import type { AdminApi } from "./api";
import { icon, date, fmt, external } from "./format";
import { Status } from "./components";
import { BarChart, MetricChart, ActivityGrid } from "./Charts";
import { RunsTable } from "./RunsTable";

export function MetricsPage({
  metrics,
  active,
  snapshot,
}: {
  metrics: Metrics | null;
  active: number;
  snapshot: Snapshot | null;
}) {
  return (
    <div className="two-column">
      <section className="panel">
        <div className="panel-heading">
          <h2>API invocations</h2>
          <span className="quiet-label">CloudWatch · hourly</span>
        </div>
        <MetricChart metrics={metrics} />
        <p className="muted">
          These are admin backend Lambda invocations, not app user analytics.
          Measurements can arrive a few minutes late.
        </p>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <h2>Reliability at a glance</h2>
          {icon("Shield", 20)}
        </div>
        <div className="metric-row">
          <span>Lambda errors · 24h</span>
          <strong>{metrics?.errors ?? "—"}</strong>
        </div>
        <div className="metric-row">
          <span>Average execution duration</span>
          <strong>
            {metrics ? `${Math.round(metrics.averageMs)} ms` : "—"}
          </strong>
        </div>
        <div className="metric-row">
          <span>Active workflow runs</span>
          <strong>{active}</strong>
        </div>
        <div className="metric-row">
          <span>Region</span>
          <code>{snapshot?.region}</code>
        </div>
        <p className="muted">
          Lambda duration excludes browser, network, Cognito, and API Gateway
          time. It is not end-to-end app latency.
        </p>
      </section>
    </div>
  );
}
