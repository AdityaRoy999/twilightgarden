import type { Run, Metrics } from "../shared/types";
import { date, duration, external } from "./format";
export function BarChart({ runs }: { runs: Run[] }) {
  const recent = runs.slice(0, 20).reverse();
  return (
    <>
      <div
        className="bar-chart"
        role="img"
        aria-label="Build duration for recent workflow runs"
      >
        <div className="chart-axis">
          <span>Longer</span>
          <span>Duration</span>
          <span>Shorter</span>
        </div>
        <div className="bar-columns">
          {recent.map((r) => (
            <a
              {...external}
              href={r.url}
              key={r.id}
              className={`bar-column ${r.conclusion === "failure" ? "bad" : ""}`}
              aria-label={`${r.name}, ${date(r.createdAt)}, ${duration(r.duration)}`}
              title={`${date(r.createdAt)} · ${r.name} · ${duration(r.duration)}`}
            >
              <span
                style={{
                  height: `${Math.max(4, Math.min(100, (r.duration / Math.max(...recent.map((v) => v.duration), 1)) * 100))}%`,
                }}
              />
            </a>
          ))}
        </div>
      </div>
      <div className="chart-caption">
        <span>{recent[0] ? date(recent[0].createdAt) : "No builds yet"}</span>
        <span>Most recent {recent.length} runs</span>
      </div>
    </>
  );
}
export function MetricChart({ metrics }: { metrics: Metrics | null }) {
  const values = metrics?.series || [];
  const max = Math.max(1, ...values.map((x) => x.requests));
  const points = values
    .map(
      (v, i) =>
        `${8 + (i * 584) / Math.max(1, values.length - 1)},${152 - (v.requests / max) * 130}`,
    )
    .join(" ");
  return (
    <div className="line-chart">
      <svg
        viewBox="0 0 600 180"
        role="img"
        aria-label="Admin API requests over the last 24 hours"
      >
        <defs>
          <linearGradient id="chart-wash" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="var(--accent)" stopOpacity=".17" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[22, 65, 108, 152].map((y) => (
          <path key={y} d={`M0 ${y}H600`} className="grid-line" />
        ))}
        {values.length > 0 && (
          <>
            <polygon
              points={`8,160 ${points} 592,160`}
              fill="url(#chart-wash)"
            />
            <polyline
              points={points}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            {values.map((v, i) => (
              <circle
                key={v.at}
                cx={8 + (i * 584) / Math.max(1, values.length - 1)}
                cy={152 - (v.requests / max) * 130}
                r="4"
                fill="var(--accent)"
              >
                <title>
                  {date(v.at)} · {v.requests} requests · {v.errors} errors ·{" "}
                  {Math.round(v.ms)} ms average
                </title>
              </circle>
            ))}
          </>
        )}
      </svg>
      <div className="chart-caption">
        <span>24 hours ago</span>
        <span>Last completed hour · hover for details</span>
      </div>
    </div>
  );
}
export function ActivityGrid({ runs }: { runs: Run[] }) {
  const cells = Array.from({ length: 105 }, (_, i) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 104 + i);
    const day = start.toDateString();
    const count = runs.filter(
      (r) => new Date(r.createdAt).toDateString() === day,
    ).length;
    return { day, count };
  });
  return (
    <div
      className="activity-grid"
      role="img"
      aria-label="Workflow activity over the last 105 days, within the most recent 100 runs"
    >
      {cells.map((c) => (
        <span
          key={c.day}
          className={c.count > 3 ? "hot" : c.count ? "warm" : ""}
          title={`${c.day} · ${c.count} runs in current sample`}
        />
      ))}
    </div>
  );
}
