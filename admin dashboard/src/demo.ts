import type {
  Audit,
  Metrics,
  Platform,
  Run,
  RunDetail,
  Snapshot,
} from "../shared/types";
const now = Date.now();
let runs: Run[] = Array.from({ length: 18 }, (_, i) => ({
  id: 1842 - i,
  name:
    i % 3 === 0
      ? "Build unsigned iOS app"
      : i % 3 === 1
        ? "Build Android test APK"
        : "Verify",
  title: [
    "Polish cycle profile marker",
    "Improve game response timing",
    "Refine privacy onboarding",
  ][i % 3],
  platform: (["ios", "android", "ci"] as const)[i % 3],
  status: "completed",
  conclusion: i === 7 ? "failure" : "success",
  branch: "main",
  sha: ["dd341379ce357b12", "0d67c81d695f4846", "2e08b63f18ab20c3"][i % 3],
  createdAt: new Date(now - (i * 4 + 1) * 3600000).toISOString(),
  updatedAt: new Date(
    now - (i * 4 + 1) * 3600000 + ((i % 3) + 3) * 60000,
  ).toISOString(),
  duration: ((i % 3) + 3) * 60 + i * 8,
  url: "https://github.com/AdityaRoy999/twilightgarden/actions",
}));
let paused = false;
let audit: Audit[] = [
  {
    id: "demo-init",
    at: new Date(now - 900000).toISOString(),
    actor: "You",
    action: "build.request",
    detail: "Android · main · demonstration",
    outcome: "accepted",
  },
  {
    id: "demo-publish",
    at: new Date(now - 4800000).toISOString(),
    actor: "You",
    action: "deployment.request",
    detail: "Latest main · demonstration",
    outcome: "accepted",
  },
];
export function demoSnapshot(): Snapshot {
  return structuredClone({
    runs,
    audit,
    paused,
    repository: "AdityaRoy999/twilightgarden",
    region: "ap-south-1",
    deployEnabled: true,
    productionUrl: "https://twilight-mocha.vercel.app/",
    fetchedAt: new Date().toISOString(),
    releases: [],
  });
}
export function demoMetrics(): Metrics {
  const series = Array.from({ length: 24 }, (_, i) => ({
    at: new Date(now - (23 - i) * 3600000).toISOString(),
    requests: [
      12, 8, 4, 3, 2, 5, 16, 32, 24, 40, 36, 51, 43, 28, 49, 64, 55, 38, 41, 30,
      26, 38, 23, 18,
    ][i],
    errors: i === 9 ? 1 : 0,
    ms: 90 + ((i * 17) % 90),
  }));
  return {
    at: new Date().toISOString(),
    requests: series.reduce((a, v) => a + v.requests, 0),
    errors: 1,
    averageMs: 134,
    series,
  };
}
export function demoDetail(id: number): RunDetail {
  const run = runs.find((r) => r.id === id)!;
  return {
    run,
    artifacts:
      run.conclusion === "success" && run.platform !== "ci"
        ? [
            {
              id,
              name:
                run.platform === "ios"
                  ? "TwilightGarden-unsigned-iOS"
                  : "TwilightGarden-Android-APK",
              size: 38400000,
              expired: false,
              expiresAt: new Date(now + 7 * 86400000).toISOString(),
            },
          ]
        : [],
    jobs: [
      {
        id,
        name: run.name,
        status: run.status,
        conclusion: run.conclusion,
        steps: [
          "Checkout source",
          "Install dependencies",
          "Build application",
          "Upload artifact",
        ].map((name) => ({
          name,
          status: run.status,
          conclusion: run.conclusion,
        })),
      },
    ],
  };
}
export function demoAction(
  action: string,
  detail: string,
  platform?: Platform,
) {
  if (action === "build.request" && paused)
    throw new Error("New builds are paused. Resume them in Settings.");
  if (action === "build.request" && platform) {
    const base = runs[0];
    runs = [
      {
        ...base,
        id: base.id + 1,
        platform,
        name:
          platform === "ios"
            ? "Build unsigned iOS app"
            : platform === "dmg"
              ? "Build macOS test DMG"
              : "Build Android test APK",
        title: "Manual demonstration build",
        status: "queued",
        conclusion: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        duration: 0,
      },
      ...runs,
    ];
  }
  if (action === "release.request") {
    const base = runs[0];
    runs = [{...base,id:base.id+1,platform:"release",name:"Build and ship native release",title:"Native release " + detail,status:"queued",conclusion:null,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),duration:0},...runs];
  }
  if (action === "builds.pause") paused = detail === "true";
  if (action === "build.cancel")
    runs = runs.map((r) =>
      String(r.id) === detail
        ? { ...r, status: "completed", conclusion: "cancelled" }
        : r,
    );
  audit.unshift({
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    actor: "You · demo",
    action,
    detail,
    outcome: "accepted",
  });
}
