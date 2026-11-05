import { describe, it, expect } from "vitest";
import {
  databaseReadings,
  logReadings,
  focusReadings,
  number,
} from "../backend/monitoring-data";
describe("provider monitoring normalization", () => {
  it("keeps zero while rejecting missing/non-numeric/infinite values", () => {
    expect(number(0)).toBe(0);
    for (const value of [null, undefined, "", "NaN", "+Inf"])
      expect(number(value)).toBeNull();
  });
  it("exports only known database aggregates and never raw labels or SQL", () => {
    const readings = databaseReadings(
      'pg_stat_database_num_backends{datname="postgres"} 3\npg_stat_database_num_backends{datname="template1"} 100\nmax_connections_connection_count 60\npg_stat_statements_total_queries{query="private SQL"} 42\npg_database_size_bytes{datname="postgres"} 1024\nunknown_private_metric{email="private"} 99',
    );
    expect(
      readings.find((v) => v.label === "Database connections"),
    ).toMatchObject({ value: 3, limit: 60 });
    expect(readings.find((v) => v.label === "Completed SQL calls")?.value).toBe(
      42,
    );
    expect(JSON.stringify(readings)).not.toMatch(
      /private|template1|unknown_private_metric/,
    );
    expect(readings.some((v) => v.label === "Host memory used")).toBe(false);
  });
  it("does not add overlapping gateway and function layers together", () => {
    const result = logReadings([
      {
        at: "2026-11-06T00:00:00",
        source: "edge_logs",
        requests: 10,
        errors: 2,
      },
      {
        at: "2026-11-06T00:00:00Z",
        source: "function_edge_logs",
        requests: 4,
        errors: 1,
      },
    ]);
    expect(result.readings.map((r) => r.value)).toEqual([10, 2, 4, 1]);
    expect(result.series).toEqual([
      { at: "2026-11-06T00:00:00.000Z", value: 10 },
    ]);
  });
  it("groups billing by currency and unit without mixing unlike resources", () => {
    const text = [
      {
        ServiceName: "Functions",
        BilledCost: "1.2",
        BillingCurrency: "USD",
        ConsumedQuantity: 3,
        ConsumedUnit: "requests",
      },
      {
        ServiceName: "Functions",
        BilledCost: "0.8",
        BillingCurrency: "USD",
        ConsumedQuantity: 2,
        ConsumedUnit: "GB-hours",
      },
      { ServiceName: "Functions", BilledCost: "-0.5", BillingCurrency: "EUR" },
    ]
      .map((r) => JSON.stringify(r))
      .join("\n");
    const rows = focusReadings(text);
    expect(
      rows.find((r) => r.label === "Functions billed cost (USD)")?.value,
    ).toBe(2);
    expect(rows.find((r) => r.unit === "EUR")?.value).toBe(-0.5);
    expect(
      rows.filter((r) => r.label.includes("usage")).map((r) => r.value),
    ).toEqual([3, 2]);
  });
  it("rejects error objects instead of presenting an empty successful billing report", () => {
    expect(() => focusReadings('{"error":{"code":"forbidden"}}')).toThrow();
    expect(() =>
      focusReadings('{"ServiceName":"Functions","BilledCost":2}'),
    ).toThrow("Missing billing currency");
  });
});
