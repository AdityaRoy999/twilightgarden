import React from "react";
import { parseDateKey } from "../../lib/dates";

export function metricDetails(
  row: Record<string, any>,
  metric: "cycle" | "sleep" | "energy",
) {
  const date = parseDateKey(row.date || "");
  if (!Number.isFinite(date.getTime())) return null;
  const heading = date.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const value =
    metric === "cycle"
      ? `${row.value} days`
      : metric === "sleep"
        ? { 1: "Poor", 2: "Fair", 3: "Good" }[row.sleep as 1 | 2 | 3] ||
          "Not logged"
        : { 1: "Low", 2: "Medium", 3: "High" }[row.energy as 1 | 2 | 3] ||
          "Not logged";
  return {
    heading,
    label:
      metric === "cycle"
        ? "Cycle length"
        : metric === "sleep"
          ? "Sleep quality"
          : "Energy level",
    value,
    end: row.endDate
      ? parseDateKey(row.endDate).toLocaleDateString(undefined, {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : null,
  };
}

export function MetricTooltip({
  active,
  payload,
  metric,
}: {
  active?: boolean;
  payload?: readonly any[];
  metric: "cycle" | "sleep" | "energy";
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const detail = metricDetails(row, metric);
  if (!detail) return null;
  return (
    <div className="metric-tooltip" role="status">
      <strong>{detail.heading}</strong>
      <dl>
        <div>
          <dt>{detail.label}</dt>
          <dd>{detail.value}</dd>
        </div>
        {metric === "sleep" && typeof row.sleepHours === "number" && (
          <div>
            <dt>Rest logged</dt>
            <dd>{row.sleepHours} hours</dd>
          </div>
        )}
      </dl>
      {detail.end && <small>Until the next start · {detail.end}</small>}
    </div>
  );
}

export function DistributionTooltip({
  active,
  payload,
  total,
  unit = "days",
  startDate,
  endDate,
}: {
  active?: boolean;
  payload?: readonly any[];
  total: number;
  unit?: string;
  startDate?: string;
  endDate?: string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="metric-tooltip">
      <strong>{row.name}</strong>
      <p>
        {row.value} {unit} ·{" "}
        {Math.round((row.value / Math.max(1, total)) * 100)}% of {total} logged{" "}
        {unit}
      </p>
      {startDate && endDate && (
        <small>
          {parseDateKey(startDate).toLocaleDateString()} –{" "}
          {parseDateKey(endDate).toLocaleDateString()}
        </small>
      )}
    </div>
  );
}
