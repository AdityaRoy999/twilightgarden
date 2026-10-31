import type { Config, Snapshot, Metrics, Run, Page } from "../shared/types";
import type { AdminApi } from "./api";
import { icon, date, fmt, external } from "./format";
import { Status } from "./components";
import { BarChart, MetricChart, ActivityGrid } from "./Charts";
import { RunsTable } from "./RunsTable";

export function ActivityPage({ snapshot }: { snapshot: Snapshot | null }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Admin audit trail</h2>
        <button
          className="secondary"
          onClick={() => {
            const blob = new Blob(
              [JSON.stringify(snapshot?.audit || [], null, 2)],
              { type: "application/json" },
            );
            const u = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = u;
            a.download = "twilight-admin-audit.json";
            a.click();
            setTimeout(() => URL.revokeObjectURL(u), 1000);
          }}
        >
          {icon("Download", 17)}Export JSON
        </button>
      </div>
      <div className="audit-list">
        {snapshot?.audit.map((a) => (
          <div className="audit-item" key={a.id}>
            <span className={`audit-icon ${a.outcome}`}>
              {icon(
                a.action.includes("build")
                  ? "Clipboard"
                  : a.action.includes("deploy")
                    ? "ArrowUp"
                    : "Settings",
                20,
              )}
            </span>
            <div>
              <strong>{a.action.replaceAll(".", " / ")}</strong>
              <p>{a.detail}</p>
              <small>
                {a.actor} · {date(a.at)} · {a.outcome}
              </small>
            </div>
          </div>
        ))}
        {!snapshot?.audit.length && (
          <p className="empty">Your first admin action will appear here.</p>
        )}
      </div>
      <p className="muted">
        Latest 100 events · records expire after 90 days. Request outcomes are
        separate from final build results.
      </p>
    </section>
  );
}
