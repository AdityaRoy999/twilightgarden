import React from "react";
import {
  Area,
  AreaChart,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  fertilitySeries,
  type HealthEntry,
} from "../../lib/reproductiveHealth";
import { parseDateKey } from "../../lib/dates";
import { useAppMotion } from "../../hooks/useAppMotion";
export function FertilityChart({ entries }: { entries: HealthEntry[] }) {
  const rows = fertilitySeries(entries).slice(-60),
    { reduced } = useAppMotion();
  const temps = rows.filter((r) => r.temperature !== null);
  return (
    <section className="reference-card health-fertility-chart">
      <h2>Your observations</h2>
      <p>
        Temperature and test history, without an inferred ovulation diagnosis.
      </p>
      {temps.length < 2 ? (
        <div className="health-empty">
          Log temperature on at least two days to see your chart.
        </div>
      ) : (
        <div style={{ height: 250, width: "100%", minWidth: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={rows}
              margin={{ top: 20, right: 18, left: 0, bottom: 5 }}
            >
              <XAxis
                dataKey="date"
                tickFormatter={(d) =>
                  parseDateKey(d).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })
                }
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={["dataMin - .1", "dataMax + .1"]}
                tickFormatter={(v) => Number(v).toFixed(1)}
                width={43}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  const row = payload?.[0]?.payload;
                  return active && row ? (
                    <div className="health-chart-tooltip">
                      <strong>
                        {parseDateKey(row.date).toLocaleDateString(undefined, {
                          weekday: "long",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </strong>
                      <p>Basal temperature: {row.temperature} °C</p>
                      <p>LH: {row.lh || "Not recorded"}</p>
                      <p>Mucus: {row.mucus || "Not recorded"}</p>
                    </div>
                  ) : null;
                }}
              />
              <Area
                type="monotone"
                dataKey="temperature"
                stroke="var(--color-primary-ink)"
                fill="var(--selection-bg)"
                strokeWidth={3}
                connectNulls={false}
                isAnimationActive={!reduced}
                dot={false}
                activeDot={{ r: 5, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="health-observations">
        {rows
          .slice(-8)
          .reverse()
          .map((r, i) => (
            <div key={`${r.date}:${i}`}>
              <strong>
                {parseDateKey(r.date).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </strong>
              <span>
                {r.temperature !== null
                  ? `${r.temperature} °C`
                  : "Temperature not recorded"}
              </span>
              <span>LH: {r.lh || "Not recorded"}</span>
            </div>
          ))}
      </div>
    </section>
  );
}
