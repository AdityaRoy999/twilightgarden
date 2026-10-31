import {
  CloudWatchClient,
  GetMetricDataCommand,
} from "@aws-sdk/client-cloudwatch";
import type { Metrics } from "../shared/types";
const cw = new CloudWatchClient({});
export async function metrics(): Promise<Metrics> {
  const end = new Date();
  end.setUTCMinutes(0, 0, 0);
  const start = new Date(end.getTime() - 24 * 3600000);
  const result = await cw.send(
    new GetMetricDataCommand({
      StartTime: start,
      EndTime: end,
      ScanBy: "TimestampAscending",
      MetricDataQueries: [
        ["requests", "Invocations", "Sum"],
        ["errors", "Errors", "Sum"],
        ["duration", "Duration", "Sum"],
      ].map(([Id, MetricName, Stat]) => ({
        Id,
        MetricStat: {
          Metric: {
            Namespace: "AWS/Lambda",
            MetricName,
            Dimensions: [
              {
                Name: "FunctionName",
                Value: process.env.AWS_LAMBDA_FUNCTION_NAME!,
              },
            ],
          },
          Period: 3600,
          Stat,
        },
        ReturnData: true,
      })),
    }),
  );
  const maps = Object.fromEntries(
    (result.MetricDataResults || []).map((m) => [
      m.Id,
      new Map(
        (m.Timestamps || []).map((t, i) => [
          t.toISOString(),
          m.Values?.[i] || 0,
        ]),
      ),
    ]),
  );
  const series = Array.from({ length: 24 }, (_, i) => {
    const at = new Date(start.getTime() + i * 3600000).toISOString();
    const requests = maps.requests?.get(at) || 0;
    return {
      at,
      requests,
      errors: maps.errors?.get(at) || 0,
      ms: requests ? (maps.duration?.get(at) || 0) / requests : 0,
    };
  });
  const requests = series.reduce((n, s) => n + s.requests, 0);
  return {
    at: new Date().toISOString(),
    requests,
    errors: series.reduce((n, s) => n + s.errors, 0),
    averageMs: requests
      ? series.reduce((n, s) => n + s.ms * s.requests, 0) / requests
      : 0,
    series,
  };
}
