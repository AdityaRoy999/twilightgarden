import type { Config, Snapshot, Metrics, Run, Page } from "../shared/types";
import type { AdminApi } from "./api";
import { icon, date, fmt, external } from "./format";
import { Status } from "./components";
import { BarChart, MetricChart, ActivityGrid } from "./Charts";
import { RunsTable } from "./RunsTable";

export function BuildsPage({
  filter,
  setFilter,
  query,
  setQuery,
  filtered,
  openRun,
}: {
  filter: string;
  setFilter: (value: string) => void;
  query: string;
  setQuery: (value: string) => void;
  filtered: Run[];
  openRun: (id: number) => Promise<void>;
}) {
  return (
    <section className="panel runs-panel">
      <div className="filter-row">
        <div className="filter-tabs">
          {["all", "ios", "android", "dmg", "release", "failure"].map((f) => (
            <button
              key={f}
              className={filter === f ? "active" : ""}
              onClick={() => setFilter(f)}
            >
              {f === "all"
                ? "All builds"
                : f === "ios"
                  ? "iOS"
                  : f === "android"
                    ? "Android"
                    : f === "dmg"
                      ? "macOS"
                      : f === "release"
                        ? "Releases"
                        : "Failed"}
            </button>
          ))}
        </div>
        <label className="search">
          {icon("Search", 17)}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search builds or commits"
            aria-label="Search builds"
          />
        </label>
      </div>
      <RunsTable runs={filtered} open={(id) => void openRun(id)} />
    </section>
  );
}
