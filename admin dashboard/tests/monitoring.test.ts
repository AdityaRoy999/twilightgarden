import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  config: {} as Record<string, string>,
  cw: vi.fn(),
  ce: vi.fn(),
  lambda: vi.fn(),
  cache: vi.fn(),
}));
vi.mock("../backend/github", () => ({
  integrations: async () => mocks.config,
}));
vi.mock("../backend/store", () => ({
  observation: (id: string, ttl: number, load: () => Promise<unknown>) => {
    mocks.cache(id, ttl);
    return load();
  },
}));
vi.mock("@aws-sdk/client-cloudwatch", () => ({
  CloudWatchClient: class {
    send = mocks.cw;
  },
  GetMetricDataCommand: class {
    constructor(public input: unknown) {}
  },
}));
vi.mock("@aws-sdk/client-cost-explorer", () => ({
  CostExplorerClient: class {
    send = mocks.ce;
  },
  GetCostAndUsageCommand: class {
    constructor(public input: unknown) {}
  },
}));
vi.mock("@aws-sdk/client-lambda", () => ({
  LambdaClient: class {
    send = mocks.lambda;
  },
  GetAccountSettingsCommand: class {
    constructor(public input: unknown) {}
  },
}));
import { monitoring } from "../backend/monitoring";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.config = {};
  process.env.AWS_LAMBDA_FUNCTION_NAME = "test-admin";
  process.env.TABLE_NAME = "test-table";
  process.env.HTTP_API_ID = "test-api";
  mocks.cw.mockResolvedValue({
    MetricDataResults: [
      { Id: "lambda_calls", StatusCode: "Complete", Values: [12] },
    ],
  });
  mocks.lambda.mockResolvedValue({
    AccountLimit: { ConcurrentExecutions: 10, TotalCodeSize: 1000 },
    AccountUsage: { TotalCodeSize: 200 },
  });
  mocks.ce.mockResolvedValue({
    ResultsByTime: [
      {
        Estimated: true,
        Groups: [
          {
            Keys: ["Lambda", "Usage"],
            Metrics: { UnblendedCost: { Amount: "2", Unit: "USD" } },
          },
          {
            Keys: ["Lambda", "Credit"],
            Metrics: { UnblendedCost: { Amount: "-1.5", Unit: "USD" } },
          },
        ],
      },
    ],
  });
  vi.stubGlobal("fetch", vi.fn());
});
describe("monitoring provider isolation", () => {
  it("needs no external credentials for AWS and never substitutes fake zero for an unconnected provider", async () => {
    const result = await monitoring();
    expect(fetch).not.toHaveBeenCalled();
    expect(
      result.sources
        .find((s) => s.id === "aws")
        ?.readings.find((r) => r.label === "Admin Lambda invocations")?.value,
    ).toBe(12);
    expect(result.sources.find((s) => s.id === "supabase-api")).toMatchObject({
      status: "setup",
      readings: [],
    });
    expect(
      result.sources
        .find((s) => s.id === "aws-cost")
        ?.readings.find((r) => r.label === "Net cost after credits/refunds")
        ?.value,
    ).toBe(0.5);
    expect(
      mocks.cache.mock.calls.some(
        ([key, ttl]) => key.startsWith("aws-cost#") && ttl === 21600,
      ),
    ).toBe(true);
  });
  it("exports numeric Supabase aggregates while keeping the PAT and raw logs out of the response", async () => {
    mocks.config = { supabaseAccessToken: "test-private-access-token" };
    vi.mocked(fetch).mockImplementation(async (url, options) => {
      expect(String(url)).toMatch(
        /^https:\/\/api\.supabase\.com\/v1\/projects\/awijrkxrhlisixufiukw\/analytics\/endpoints\//,
      );
      expect(options?.headers).toMatchObject({
        Authorization: "Bearer test-private-access-token",
      });
      return String(url).includes("/logs?")
        ? new Response(
            JSON.stringify({
              result: [
                {
                  source: "edge_logs",
                  at: "2026-11-06T01:00:00",
                  requests: 11,
                  errors: 1,
                  private_payload: "never export this",
                },
              ],
            }),
          )
        : new Response('pg_database_size_bytes{datname="postgres"} 2048');
    });
    const result = await monitoring();
    expect(result.sources.find((s) => s.id === "supabase-api")).toMatchObject({
      status: "ready",
      series: [{ at: "2026-11-06T01:00:00.000Z", value: 11 }],
    });
    expect(
      result.sources.find((s) => s.id === "supabase-db")?.readings,
    ).toEqual([{ label: "Database size", value: 2048, unit: "bytes" }]);
    expect(JSON.stringify(result)).not.toMatch(
      /test-private-access-token|never export|private_payload/,
    );
  });
  it("isolates provider failures, redacts exceptions and preserves unavailable CloudWatch values", async () => {
    mocks.config = { supabaseAccessToken: "secret-that-must-not-leak" };
    vi.mocked(fetch).mockRejectedValue(new Error("secret-that-must-not-leak"));
    mocks.cw.mockResolvedValue({
      MetricDataResults: [
        { Id: "lambda_calls", StatusCode: "PartialData", Values: [] },
      ],
    });
    const result = await monitoring();
    expect(result.sources.find((s) => s.id === "supabase-api")?.status).toBe(
      "unavailable",
    );
    expect(result.sources.find((s) => s.id === "aws")).toMatchObject({
      status: "partial",
    });
    expect(
      result.sources.find((s) => s.id === "aws")?.readings[0].value,
    ).toBeNull();
    expect(result.sources.find((s) => s.id === "aws-cost")?.status).toBe(
      "ready",
    );
    expect(JSON.stringify(result)).not.toContain("secret-that-must-not-leak");
  });
});
