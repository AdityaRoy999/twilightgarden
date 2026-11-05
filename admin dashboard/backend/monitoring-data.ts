import type { Reading } from "../shared/types";

export function number(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
/** Export only a fixed numeric allowlist. Never return labels, SQL text, IDs, or logs. */
export function databaseReadings(text: string): Reading[] {
  const values = new Map<string, number[]>();
  for (const line of text.split("\n")) {
    const match =
      /^([a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{([^}]*)\})?\s+([^\s]+)(?:\s+\d+)?$/.exec(
        line,
      );
    if (!match) continue;
    if (
      /datname="/.test(match[2] || "") &&
      !/datname="postgres"/.test(match[2])
    )
      continue;
    const value = number(match[3]);
    if (value === null) continue;
    values.set(match[1], [...(values.get(match[1]) || []), value]);
  }
  const sum = (key: string) => {
    const rows = values.get(key);
    return rows?.length ? rows.reduce((a, b) => a + b, 0) : null;
  };
  const first = (key: string) => values.get(key)?.[0] ?? null;
  const total = first("node_memory_MemTotal_bytes"),
    available = first("node_memory_MemAvailable_bytes");
  const rows: Reading[] = [
    {
      label: "Database size",
      value: first("pg_database_size_bytes"),
      unit: "bytes",
    },
    {
      label: "Database connections",
      value: sum("pg_stat_database_num_backends"),
      unit: "connections",
      limit: first("max_connections_connection_count") ?? undefined,
    },
    {
      label: "Completed SQL calls",
      value: sum("pg_stat_statements_total_queries"),
      unit: "calls",
      detail: "Cumulative since statement statistics reset; not HTTP requests",
    },
    {
      label: "Committed transactions",
      value: sum("pg_stat_database_xact_commit_total"),
      unit: "transactions",
      detail: "Cumulative since database statistics reset",
    },
    {
      label: "Rolled-back transactions",
      value: sum("pg_stat_database_xact_rollback_total"),
      unit: "transactions",
      detail: "Cumulative; includes deliberately rolled-back transactions",
    },
    {
      label: "Deadlocks",
      value: sum("pg_stat_database_deadlocks_total"),
      unit: "deadlocks",
      detail: "Cumulative since statistics reset",
    },
    {
      label: "Host memory used",
      value:
        total !== null && available !== null
          ? Math.max(0, total - available)
          : null,
      unit: "bytes",
      limit: total ?? undefined,
    },
    { label: "CPU cores", value: first("node_cpu_online"), unit: "cores" },
    { label: "Host load · 1 minute", value: first("node_load1"), unit: "load" },
    {
      label: "Pooler waiting clients",
      value: sum("pgbouncer_pools_client_waiting_connections"),
      unit: "connections",
    },
  ];
  return rows.filter((row) => row.value !== null);
}
export function logReadings(rows: any[]): {
  readings: Reading[];
  series: { at: string; value: number }[];
} {
  const total = (source: string, field: string) =>
    rows
      .filter((r) => r.source === source)
      .reduce((sum, row) => sum + (number(row[field]) ?? 0), 0);
  const readings = [
    {
      label: "Gateway requests",
      value: total("edge_logs", "requests"),
      unit: "requests",
      detail: "Gateway layer; do not add to function invocations",
    },
    {
      label: "Gateway 5xx responses",
      value: total("edge_logs", "errors"),
      unit: "responses",
    },
    {
      label: "Edge Function invocations",
      value: total("function_edge_logs", "requests"),
      unit: "requests",
      detail: "Function execution layer; may overlap gateway requests",
    },
    {
      label: "Edge Function 5xx responses",
      value: total("function_edge_logs", "errors"),
      unit: "responses",
    },
  ];
  // ClickHouse's DateTime JSON can omit the UTC suffix. Never interpret it in
  // the machine's local timezone (including local development in India).
  const utc = (at: string) =>
    new Date(/(?:Z|[+-]\d\d:\d\d)$/i.test(at) ? at : at + "Z").toISOString();
  return {
    readings,
    series: rows
      .filter((r) => r.source === "edge_logs")
      .map((r) => ({ at: utc(r.at), value: number(r.requests) ?? 0 }))
      .sort((a, b) => a.at.localeCompare(b.at)),
  };
}
export function focusReadings(text: string): Reading[] {
  const groups = new Map<string, { value: number; unit: string }>();
  for (const line of text.split("\n").filter(Boolean)) {
    const row = JSON.parse(line);
    if (!row || typeof row !== "object" || typeof row.ServiceName !== "string")
      throw new Error("Invalid billing response");
    if (typeof row.BillingCurrency !== "string" || !row.BillingCurrency)
      throw new Error("Missing billing currency");
    const currency = row.BillingCurrency;
    const cost = number(row.BilledCost);
    if (cost === null) continue;
    const key = `${row.ServiceName} billed cost (${currency})`;
    const old = groups.get(key);
    groups.set(key, { value: (old?.value ?? 0) + cost, unit: currency });
    const quantity = number(row.ConsumedQuantity),
      unit = row.ConsumedUnit;
    if (quantity !== null && typeof unit === "string") {
      const key = `${row.ServiceName} usage (${unit})`;
      const old = groups.get(key);
      groups.set(key, { value: (old?.value ?? 0) + quantity, unit });
    }
  }
  return [...groups].map(([label, value]) => ({ label, ...value }));
}
