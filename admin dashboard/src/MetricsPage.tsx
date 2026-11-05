import type {
  Snapshot,
  Metrics,
  MonitoringReport,
  Reading,
} from "../shared/types";
import type { AdminApi } from "./api";
import { icon, date, fmt, external } from "./format";
import { Status } from "./components";
import { BarChart, MetricChart, ActivityGrid } from "./Charts";
import { RunsTable } from "./RunsTable";

export function MetricsPage({
  metrics,
  active,
  snapshot,
  monitoring,
  monitorError,
}: {
  metrics: Metrics | null;
  active: number;
  snapshot: Snapshot | null;
  monitoring: MonitoringReport | null;
  monitorError: string;
}) {
  return (
    <div className="monitoring-page">
      <div className="info-box">
        Provider windows and scopes differ. Traffic counts are not invoices;
        unavailable sources and limits are never treated as zero. Refreshing
        uses cached reports to limit monitoring costs.
      </div>
      {monitorError && (
        <p className="alert error" role="alert">
          {monitorError}
        </p>
      )}
      {!monitoring && !monitorError && (
        <p role="status" className="muted">
          Collecting provider monitoring…
        </p>
      )}
      <div className="provider-grid">
        {monitoring?.sources.map((source) => (
          <section className="panel provider-panel" key={source.id}>
            <div className="panel-heading">
              <h2>{source.name}</h2>
              <span className={`provider-state ${source.status}`}>
                {source.status === "ready"
                  ? "Connected"
                  : source.status === "partial"
                    ? "Partial data"
                    : source.status === "setup"
                      ? "Setup needed"
                      : "Unavailable"}
              </span>
            </div>
            <p className="quiet-label">{source.window}</p>
            {source.series && (
              <MetricChart
                metrics={{
                  at: source.at,
                  requests: 0,
                  errors: 0,
                  averageMs: 0,
                  series: source.series.map((point) => ({
                    at: point.at,
                    requests: point.value,
                    errors: 0,
                    ms: 0,
                  })),
                }}
                label={`${source.name} over the last 24 hours`}
                unit={source.id === "cloudflare" ? "bytes" : "requests"}
              />
            )}
            <dl className="provider-readings">
              {source.readings.map((reading, index) => (
                <div key={`${reading.label}-${index}`}>
                  <dt>
                    {reading.label}
                    {reading.detail && <small>{reading.detail}</small>}
                  </dt>
                  <dd>
                    {readingValue(reading)}
                    {reading.limit !== undefined && (
                      <small>
                        Limit / capacity:{" "}
                        {readingValue({ ...reading, value: reading.limit })}
                      </small>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="muted">{source.message}</p>
            <div className="provider-footer">
              <small>Collected {date(source.at)}</small>
              <a className="text-button" href={source.url} {...external}>
                Provider details {icon("ArrowOut", 15)}
              </a>
            </div>
          </section>
        ))}
      </div>
      <div className="two-column">
        <section className="panel">
          <div className="panel-heading">
            <h2>Admin API invocations</h2>
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
            <strong>{snapshot ? active : "—"}</strong>
          </div>
          <div className="metric-row">
            <span>Region</span>
            <code>{snapshot?.region ?? "—"}</code>
          </div>
          <p className="muted">
            Lambda duration excludes browser, network, Cognito, and API Gateway
            time. It is not end-to-end app latency.
          </p>
        </section>
      </div>
    </div>
  );
}
function readingValue(reading: Reading) {
  if (reading.value === null) return "Unavailable";
  if (reading.unit === "bytes") {
    const i = Math.min(
      4,
      Math.max(
        0,
        Math.floor(Math.log(Math.max(1, reading.value)) / Math.log(1024)),
      ),
    );
    return `${(reading.value / 1024 ** i).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${["B", "KiB", "MiB", "GiB", "TiB"][i]}`;
  }
  const value =
    reading.unit === "USD" && Math.abs(reading.value) < 0.00005
      ? 0
      : reading.value;
  return `${value.toLocaleString(undefined, { maximumFractionDigits: reading.unit === "USD" ? 4 : 2 })} ${reading.unit}`;
}
