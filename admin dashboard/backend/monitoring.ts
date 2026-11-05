import {
  CloudWatchClient,
  GetMetricDataCommand,
} from "@aws-sdk/client-cloudwatch";
import {
  CostExplorerClient,
  GetCostAndUsageCommand,
} from "@aws-sdk/client-cost-explorer";
import {
  LambdaClient,
  GetAccountSettingsCommand,
} from "@aws-sdk/client-lambda";
import { createHash } from "node:crypto";
import { integrations } from "./github";
import { observation } from "./store";
import {
  databaseReadings,
  logReadings,
  focusReadings,
  number,
} from "./monitoring-data";
import type {
  MonitoringReport,
  ProviderReport,
  Reading,
} from "../shared/types";

const project = "awijrkxrhlisixufiukw";
const cw = new CloudWatchClient({ maxAttempts: 1 }),
  ce = new CostExplorerClient({ region: "us-east-1", maxAttempts: 1 }),
  lambda = new LambdaClient({ maxAttempts: 1 });
const stamp = () => new Date().toISOString();
const report = (
  id: string,
  name: string,
  url: string,
  window: string,
): ProviderReport => ({
  id,
  name,
  url,
  window,
  at: stamp(),
  status: "ready",
  message: "",
  readings: [],
});
async function boundedText(
  response: Response,
  max = 4_000_000,
): Promise<string> {
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(
      `Provider returned HTTP ${response.status}. Check monitoring permissions and plan access.`,
    );
  }
  const reader = response.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let total = 0,
    text = "";
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.length;
      if (total > max)
        throw new Error(
          "Monitoring response exceeded the safe size limit. Narrow the provider report.",
        );
      text += decoder.decode(next.value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    await reader.cancel();
  }
}
async function get(url: string, token: string) {
  return boundedText(
    await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      redirect: "error",
      signal: AbortSignal.timeout(8000),
    }),
  );
}
async function source(
  base: ProviderReport,
  load: (base: ProviderReport) => Promise<void>,
): Promise<ProviderReport> {
  try {
    await load(base);
  } catch (error) {
    base.status = base.readings.length ? "partial" : "unavailable";
    base.message =
      error instanceof Error &&
      /Provider returned HTTP|safe size limit/.test(error.message)
        ? error.message
        : "Monitoring unavailable. Check provider access and retry later.";
  }
  return base;
}
export const logSQL =
  "select toStartOfHour(timestamp) as at, source, count() as requests, countIf(toInt32OrZero(log_attributes['response.status_code']) >= 500) as errors, countIf(endsWith(log_attributes['request.pathname'], '/ai-generate')) as ai_requests, countIf(endsWith(log_attributes['request.pathname'], '/call-credentials')) as relay_requests from logs where source in ('edge_logs','function_edge_logs') group by at, source order by at";
async function supabaseSources(
  config: Awaited<ReturnType<typeof integrations>>,
) {
  const window = "Last 24 hours · log retention and provider sampling apply";
  const api = report(
    "supabase-api",
    "App API · Supabase",
    `https://supabase.com/dashboard/project/${project}/logs/explorer`,
    window,
  );
  const db = report(
    "supabase-db",
    "Database · Supabase",
    `https://supabase.com/dashboard/project/${project}/reports/database`,
    "Latest database snapshot · counters since provider reset",
  );
  if (!config.supabaseAccessToken)
    return [api, db].map((r) => ({
      ...r,
      status: "setup" as const,
      message:
        "Add supabaseAccessToken in AWS Secrets Manager with Logs Read and Usage Analytics Read for this project.",
    }));
  const root = `https://api.supabase.com/v1/projects/${project}/analytics/endpoints/`;
  return Promise.all([
    source(api, async (r) => {
      const end = new Date(),
        start = new Date(end.getTime() - 86400000);
      const query = new URLSearchParams({
        sql: logSQL,
        iso_timestamp_start: start.toISOString(),
        iso_timestamp_end: end.toISOString(),
      });
      const data = JSON.parse(
        await get(root + "logs?" + query, config.supabaseAccessToken!),
      );
      if (data.error || !Array.isArray(data.result))
        throw new Error("Invalid logs response");
      const parsed = logReadings(data.result);
      r.readings = parsed.readings;
      r.series = parsed.series;
      for (const [field, label] of [
        ["ai_requests", "AI gateway invocations"],
        ["relay_requests", "Call relay credential requests"],
      ])
        r.readings.push({
          label,
          value: data.result
            .filter((row: any) => row.source === "function_edge_logs")
            .reduce((s: number, row: any) => s + (number(row[field]) ?? 0), 0),
          unit: "requests",
          detail:
            "Function calls include rejected requests; not external AI tokens or billed relay bandwidth",
        });
      r.message =
        "Aggregates only. Includes test, admin, and internal traffic recorded by the provider. No request URLs, bodies, identities, or raw logs are returned.";
    }),
    source(db, async (r) => {
      r.readings = databaseReadings(
        await get(root + "metrics", config.supabaseAccessToken!),
      );
      if (!r.readings.length) throw new Error("No recognized metrics");
      r.message =
        "Read-only Prometheus metrics. Missing series are omitted; cumulative SQL calls are not a billable request count. Invoice, egress allowance, MAU and storage-plan quotas remain authoritative in Supabase Billing.";
    }),
  ]);
}
async function awsRuntime(): Promise<ProviderReport> {
  return source(
    report(
      "aws",
      "AWS infrastructure",
      "https://console.aws.amazon.com/cloudwatch/home?region=ap-south-1",
      "Last 24 clock hours · current hour partial",
    ),
    async (r) => {
      const end = new Date(),
        start = new Date(end);
      start.setUTCMinutes(0, 0, 0);
      start.setUTCHours(start.getUTCHours() - 23);
      const specs: [string, string, string, string, string, string][] = [
        [
          "lambda_calls",
          "AWS/Lambda",
          "Invocations",
          "Sum",
          "FunctionName",
          process.env.AWS_LAMBDA_FUNCTION_NAME!,
        ],
        [
          "lambda_errors",
          "AWS/Lambda",
          "Errors",
          "Sum",
          "FunctionName",
          process.env.AWS_LAMBDA_FUNCTION_NAME!,
        ],
        [
          "lambda_throttles",
          "AWS/Lambda",
          "Throttles",
          "Sum",
          "FunctionName",
          process.env.AWS_LAMBDA_FUNCTION_NAME!,
        ],
        [
          "api_requests",
          "AWS/ApiGateway",
          "Count",
          "Sum",
          "ApiId",
          process.env.HTTP_API_ID!,
        ],
        [
          "api_4xx",
          "AWS/ApiGateway",
          "4xx",
          "Sum",
          "ApiId",
          process.env.HTTP_API_ID!,
        ],
        [
          "api_5xx",
          "AWS/ApiGateway",
          "5xx",
          "Sum",
          "ApiId",
          process.env.HTTP_API_ID!,
        ],
        [
          "db_reads",
          "AWS/DynamoDB",
          "ConsumedReadCapacityUnits",
          "Sum",
          "TableName",
          process.env.TABLE_NAME!,
        ],
        [
          "db_writes",
          "AWS/DynamoDB",
          "ConsumedWriteCapacityUnits",
          "Sum",
          "TableName",
          process.env.TABLE_NAME!,
        ],
      ].filter((x) => !!x[5]) as any;
      const [result, account] = await Promise.allSettled([
        cw.send(
          new GetMetricDataCommand({
            StartTime: start,
            EndTime: end,
            ScanBy: "TimestampAscending",
            MetricDataQueries: specs.map(
              ([Id, Namespace, MetricName, Stat, Name, Value]) => ({
                Id,
                MetricStat: {
                  Metric: {
                    Namespace,
                    MetricName,
                    Dimensions: [{ Name, Value }],
                  },
                  Period: 3600,
                  Stat,
                },
                ReturnData: true,
              }),
            ),
          }),
          { abortSignal: AbortSignal.timeout(8000) },
        ),
        lambda.send(new GetAccountSettingsCommand({}), {
          abortSignal: AbortSignal.timeout(8000),
        }),
      ]);
      if (result.status === "fulfilled") {
        const descriptions: Record<string, [string, string]> = {
          lambda_calls: ["Admin Lambda invocations", "requests"],
          lambda_errors: ["Admin Lambda errors", "errors"],
          lambda_throttles: ["Admin Lambda throttles", "requests"],
          api_requests: ["Admin API Gateway requests", "requests"],
          api_4xx: ["Admin API 4xx", "responses"],
          api_5xx: ["Admin API 5xx", "responses"],
          db_reads: ["Admin DynamoDB reads", "capacity units"],
          db_writes: ["Admin DynamoDB writes", "capacity units"],
        };
        for (const series of result.value.MetricDataResults || []) {
          const name = descriptions[series.Id!];
          if (!name) continue;
          const complete = series.StatusCode === "Complete";
          if (!complete) r.status = "partial";
          r.readings.push({
            label: name[0],
            value: series.Values?.length
              ? series.Values.reduce((a, b) => a + b, 0)
              : null,
            unit: name[1],
            detail: !complete
              ? "Provider returned incomplete samples"
              : series.Values?.length
                ? "CloudWatch reported samples"
                : "No samples published in this window",
          });
        }
      } else {
        r.status = "partial";
        r.message = "CloudWatch monitoring permission unavailable.";
      }
      if (account.status === "fulfilled")
        r.readings.push(
          {
            label: "Account Lambda concurrency quota",
            value: account.value.AccountLimit?.ConcurrentExecutions ?? null,
            unit: "concurrent executions",
          },
          {
            label: "Account Lambda code storage",
            value: account.value.AccountUsage?.TotalCodeSize ?? null,
            unit: "bytes",
            limit: account.value.AccountLimit?.TotalCodeSize,
          },
        );
      else {
        r.status = "partial";
        r.message +=
          " Add lambda:GetAccountSettings to read actual regional account quotas.";
      }
      r.message +=
        " Infrastructure figures describe this AWS admin stack; the consumer app runs on Vercel/Supabase. Account quotas include other AWS workloads.";
    },
  );
}
async function awsCosts(): Promise<ProviderReport> {
  return source(
    report(
      "aws-cost",
      "AWS costs",
      "https://console.aws.amazon.com/costmanagement/home#/cost-explorer",
      "Calendar month to date · account-wide · billing data delayed",
    ),
    async (r) => {
      const start = new Date();
      start.setUTCDate(1);
      const end = new Date(Date.now() + 86400000);
      const groups: any[] = [];
      let next: string | undefined;
      let estimated = false;
      const signal = AbortSignal.timeout(12000);
      for (let page = 0; page < 5; page++) {
        const result = await ce.send(
          new GetCostAndUsageCommand({
            TimePeriod: {
              Start: start.toISOString().slice(0, 10),
              End: end.toISOString().slice(0, 10),
            },
            Granularity: "MONTHLY",
            Metrics: ["UnblendedCost"],
            GroupBy: [
              { Type: "DIMENSION", Key: "SERVICE" },
              { Type: "DIMENSION", Key: "RECORD_TYPE" },
            ],
            NextPageToken: next,
          }),
          { abortSignal: signal },
        );
        for (const period of result.ResultsByTime || []) {
          groups.push(...(period.Groups || []));
          estimated ||= !!period.Estimated;
        }
        next = result.NextPageToken;
        if (!next) break;
      }
      const units = new Set(groups.map((g) => g.Metrics?.UnblendedCost?.Unit));
      if (units.size > 1) throw new Error("Mixed billing currencies");
      const unit = [...units][0] || "USD",
        costs = new Map<string, number>();
      let gross = 0,
        credits = 0,
        refunds = 0;
      for (const group of groups) {
        const amount = number(group.Metrics?.UnblendedCost?.Amount);
        if (amount === null) continue;
        const [service, type] = group.Keys || [];
        costs.set(service, (costs.get(service) || 0) + amount);
        if (type === "Credit") credits += amount;
        else if (type === "Refund") refunds += amount;
        else gross += amount;
      }
      r.readings = [
        { label: "Charges before credits/refunds", value: gross, unit },
        { label: "Credits applied this month", value: credits, unit },
        { label: "Refunds applied this month", value: refunds, unit },
        {
          label: "Net cost after credits/refunds",
          value: gross + credits + refunds,
          unit,
        },
        ...[...costs]
          .sort((a, b) => b[1] - a[1])
          .map(([label, value]) => ({ label, value, unit })),
      ];
      r.status = next ? "partial" : "ready";
      r.message = `${estimated ? "Estimated, not a final invoice. " : ""}AWS account-wide costs include other projects. Applied credits are not remaining promotional credit balance. Cached for 6 hours across Lambda instances; Cost Explorer charges per API request.${next ? " Provider report was truncated." : ""}`;
    },
  );
}
async function vercelCosts(
  config: Awaited<ReturnType<typeof integrations>>,
): Promise<ProviderReport> {
  const r = report(
    "vercel",
    "Vercel usage & costs",
    "https://vercel.com/dashboard/usage",
    "Calendar month to date · team-wide · provider billing delay",
  );
  if (!config.vercelToken || !config.vercelTeamId)
    return {
      ...r,
      status: "setup",
      message:
        "Add vercelToken and vercelTeamId in Secrets Manager. Billing API access depends on team role and plan.",
    };
  return source(r, async (r) => {
    if (!/^team_[a-zA-Z0-9]+$/.test(config.vercelTeamId!))
      throw new Error("Invalid team");
    const from = new Date();
    from.setUTCDate(1);
    from.setUTCHours(0, 0, 0, 0);
    const query = new URLSearchParams({
      teamId: config.vercelTeamId!,
      from: from.toISOString(),
      to: stamp(),
    });
    r.readings = focusReadings(
      await get(
        "https://api.vercel.com/v1/billing/charges?" + query,
        config.vercelToken!,
      ),
    );
    r.message =
      "FOCUS billing data, grouped by service and unit. Team-wide, including other projects; not a live latency trace. Remaining allowances and live request breakdown are available in Vercel Usage/Observability.";
  });
}
async function githubCosts(
  config: Awaited<ReturnType<typeof integrations>>,
): Promise<ProviderReport> {
  const r = report(
    "github-cost",
    "GitHub Actions billing",
    "https://github.com/settings/billing/usage",
    "Current month · this repository only",
  );
  if (!config.githubBillingToken)
    return {
      ...r,
      status: "setup",
      message:
        "Optional githubBillingToken needs Plan Read on the owner account. Keep build credentials separate.",
    };
  return source(r, async (r) => {
    const repo = process.env.GITHUB_REPO!,
      owner = repo.split("/")[0],
      now = new Date();
    const response = await fetch(
      `https://api.github.com/users/${encodeURIComponent(owner)}/settings/billing/usage?year=${now.getUTCFullYear()}&month=${now.getUTCMonth() + 1}`,
      {
        headers: {
          Authorization: `Bearer ${config.githubBillingToken}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2026-03-10",
        },
        redirect: "error",
        signal: AbortSignal.timeout(8000),
      },
    );
    const body = JSON.parse(await boundedText(response));
    if (!Array.isArray(body.usageItems))
      throw new Error("Invalid usage response");
    const rows = body.usageItems.filter(
      (v: any) =>
        v.repositoryName === repo || v.repositoryName === repo.split("/")[1],
    );
    const sums = new Map<string, number>();
    for (const row of rows) {
      const value = number(row.quantity);
      if (value !== null) {
        const key = `${row.product} · ${row.sku} (${row.unitType})`;
        sums.set(key, (sums.get(key) || 0) + value);
      }
    }
    r.readings = [
      {
        label: "Net reported repository cost",
        value: rows.reduce(
          (s: number, row: any) => s + (number(row.netAmount) ?? 0),
          0,
        ),
        unit: "USD",
      },
      ...[...sums].map(([label, value]) => ({
        label,
        value,
        unit: "provider units",
      })),
    ];
    r.message =
      "Uses the owner billing report. Free/included usage may not appear as billable rows; workflow wall-clock minutes are not charged runner minutes. Billing limits remain in GitHub Billing.";
  });
}
async function cloudflareUsage(
  config: Awaited<ReturnType<typeof integrations>>,
): Promise<ProviderReport> {
  const r = report(
    "cloudflare",
    "Cloudflare TURN traffic",
    "https://dash.cloudflare.com/",
    "Last 24 hours · selected TURN key · adaptive analytics",
  );
  if (
    !config.cloudflareAnalyticsToken ||
    !config.cloudflareAccountId ||
    !config.cloudflareTurnKeyId
  )
    return {
      ...r,
      status: "setup",
      message:
        "Add cloudflareAnalyticsToken (Account Analytics Read), cloudflareAccountId and cloudflareTurnKeyId. Calling credentials cannot substitute for an analytics token.",
    };
  return source(r, async (r) => {
    if (
      !/^[a-f0-9]{32}$/i.test(config.cloudflareAccountId!) ||
      !/^[a-zA-Z0-9_-]{16,128}$/.test(config.cloudflareTurnKeyId!)
    )
      throw new Error("Invalid Cloudflare account configuration");
    const from = new Date(Date.now() - 86400000).toISOString().slice(0, 10),
      to = stamp().slice(0, 10);
    const query = `query { viewer { accounts(filter: {accountTag: ${JSON.stringify(config.cloudflareAccountId)}}) { callsTurnUsageAdaptiveGroups(limit: 1000, filter: {date_geq: ${JSON.stringify(from)}, date_leq: ${JSON.stringify(to)}, keyId: ${JSON.stringify(config.cloudflareTurnKeyId)}}, orderBy: [datetimeHour_ASC]) { dimensions { datetimeHour } sum { egressBytes ingressBytes } } } } }`;
    const response = await fetch(
      "https://api.cloudflare.com/client/v4/graphql",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.cloudflareAnalyticsToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
        redirect: "error",
        signal: AbortSignal.timeout(8000),
      },
    );
    const data = JSON.parse(await boundedText(response));
    if (data.errors?.length) throw new Error("Analytics access unavailable");
    const accounts = data.data?.viewer?.accounts;
    if (!Array.isArray(accounts) || !accounts.length)
      throw new Error("Account not available");
    const cutoff = Date.now() - 86400000;
    const rows = accounts
      .flatMap((a: any) => a.callsTurnUsageAdaptiveGroups || [])
      .filter((row: any) => Date.parse(row.dimensions?.datetimeHour) >= cutoff);
    r.readings = ["egressBytes", "ingressBytes"].map((field) => ({
      label: field === "egressBytes" ? "TURN egress" : "TURN ingress",
      value: rows.reduce(
        (sum: number, row: any) => sum + (number(row.sum?.[field]) ?? 0),
        0,
      ),
      unit: "bytes",
    }));
    r.message =
      "Actual relay traffic only. Direct peer-to-peer media is not counted. The oldest hourly bucket may be partial/omitted. Cloudflare billing, included allowance and account credits remain authoritative in its dashboard.";
    r.series = rows.map((row: any) => ({
      at: row.dimensions.datetimeHour,
      value: number(row.sum?.egressBytes) ?? 0,
    }));
  });
}
export async function monitoring(): Promise<MonitoringReport> {
  const config = await integrations();
  const version = createHash("sha256")
    .update(JSON.stringify(config))
    .digest("hex")
    .slice(0, 16);
  const cached = (
    id: string,
    ttl: number,
    run: () => Promise<ProviderReport>,
  ) =>
    observation(`${id}#${version}`, ttl, run).catch(() => ({
      ...report(id, id, "https://console.aws.amazon.com/", ""),
      status: "unavailable" as const,
      message:
        "Monitoring is being refreshed or its cache is unavailable. Retry shortly.",
    }));
  const [aws, cost, supa, vercel, github, cloudflare] = await Promise.all([
    cached("aws", 300, awsRuntime),
    cached("aws-cost", 21600, awsCosts),
    observation(`supabase#${version}`, 300, () =>
      supabaseSources(config),
    ).catch(() => [
      {
        ...report(
          "supabase",
          "Supabase",
          `https://supabase.com/dashboard/project/${project}`,
          "Latest snapshot",
        ),
        status: "unavailable" as const,
        message: "Monitoring unavailable. Check cache and provider access.",
      },
    ]),
    cached("vercel", 21600, () => vercelCosts(config)),
    cached("github-cost", 21600, () => githubCosts(config)),
    cached("cloudflare", 300, () => cloudflareUsage(config)),
  ]);
  return {
    at: stamp(),
    sources: [
      aws,
      ...supa,
      cost,
      vercel,
      github,
      cloudflare,
      {
        ...report(
          "supabase-billing",
          "Supabase billing & allowances",
          "https://supabase.com/dashboard/org/_/usage",
          "Provider billing cycle · organization-wide",
        ),
        status: "partial",
        message:
          "Database and API telemetry above are live when connected. Plan allowances, egress, monthly active users, remaining quotas and upcoming invoice must be checked in Supabase Usage/Billing; no unsupported billing API or guessed free-tier values are used.",
      },
      {
        ...report(
          "ai-billing",
          "AI provider billing",
          "https://console.groq.com/settings/billing",
          "Provider billing cycle",
        ),
        status: "partial",
        message:
          "Supabase AI gateway request counts appear above. External model tokens, provider credits and spend limits are not exposed by a supported billing API configured here. Review the AI provider console; no invented token totals or dollar estimates.",
      },
    ],
  };
}
