import type { Run } from "../shared/types";
import { date, duration, icon } from "./format";
import { Status } from "./components";
export function RunsTable({
  runs,
  open,
}: {
  runs: Run[];
  open: (id: number) => void;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Workflow / commit</th>
            <th>Platform</th>
            <th>Status</th>
            <th>Duration</th>
            <th>Started</th>
            <th>
              <span className="sr-only">Details</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id}>
              <td>
                <button className="table-title" onClick={() => open(r.id)}>
                  {r.title || r.name}
                </button>
                <small>
                  {r.name} <b>·</b> <code>{r.sha.slice(0, 7)}</code>
                </small>
              </td>
              <td>
                <span className="platform">
                  {icon(
                    r.platform === "ios"
                      ? "Smartphone"
                      : r.platform === "android"
                        ? "Monitor"
                        : "Shield",
                    16,
                  )}
                  {r.platform === "ci"
                    ? "Checks"
                    : r.platform === "ios"
                      ? "iOS"
                      : r.platform === "dmg"
                        ? "macOS"
                        : r.platform === "release"
                          ? "Release"
                          : "Android"}
                </span>
              </td>
              <td>
                <Status run={r} />
              </td>
              <td className="mono">
                {r.status === "completed"
                  ? duration(r.duration)
                  : "In progress"}
              </td>
              <td>{date(r.createdAt)}</td>
              <td>
                <button
                  className="icon-button"
                  aria-label={`Details for run ${r.id}`}
                  onClick={() => open(r.id)}
                >
                  {icon("ArrowOut", 18)}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!runs.length && (
        <div className="empty">
          No matching runs. Try another filter or start your first build.
        </div>
      )}
    </div>
  );
}
