import { it, expect } from "vitest";
import { parseHealthImport } from "../lib/healthPortability";
it("imports observations privately and never reuses grants or IDs from a file", () => {
  const source = {
    id: "old",
    date: "2026-11-01",
    category: "intimacy",
    values: { comfort: "Comfortable" },
    title: "Private",
    notes: "Test",
    shareWithPartner: true,
    shareCoupleId: "old-couple",
  };
  const [result] = parseHealthImport(
    JSON.stringify({ format: "twilight-health-v1", entries: [source] }),
    "json",
    "2026-11-06",
  );
  expect(result.id).not.toBe("old");
  expect(result.shareWithPartner).toBe(false);
  expect(result.shareCoupleId).toBeUndefined();
});
it("imports a documented Celsius CSV without interpreting formulas or unknown columns", () => {
  const rows = parseHealthImport(
    "date,temperature,mucus,lh,test\n2026-11-01,36.42,Dry,Negative,",
    "csv",
    "2026-11-06",
  );
  expect(rows[0].values.temperature).toBe(36.42);
  expect(() =>
    parseHealthImport("date,temperature\n2026-11-01,=2+2", "csv", "2026-11-06"),
  ).toThrow();
  expect(() =>
    parseHealthImport("date,unknown\n2026-11-01,hello", "csv", "2026-11-06"),
  ).toThrow();
});
it("rejects future dates, huge files and malformed rows before importing anything", () => {
  expect(() => parseHealthImport("x".repeat(2_000_001), "csv")).toThrow();
  expect(() =>
    parseHealthImport("date,temperature\n2027-01-01,36.4", "csv", "2026-11-06"),
  ).toThrow();
  expect(() =>
    parseHealthImport(
      JSON.stringify({ format: "twilight-health-v1", entries: [null] }),
      "json",
    ),
  ).toThrow();
});
