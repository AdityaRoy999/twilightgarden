export type Platform = "ios" | "android" | "dmg";
export type Run = {
  id: number;
  name: string;
  title: string;
  platform: Platform | "ci" | "release";
  status: string;
  conclusion: string | null;
  branch: string;
  sha: string;
  createdAt: string;
  updatedAt: string;
  url: string;
  duration: number;
};
export type Audit = {
  id: string;
  at: string;
  actor: string;
  action: string;
  detail: string;
  outcome: "accepted" | "failed";
};
export type Artifact = {
  id: number;
  name: string;
  size: number;
  expired: boolean;
  expiresAt: string;
};
export type RunDetail = {
  run: Run;
  artifacts: Artifact[];
  jobs: {
    id: number;
    name: string;
    status: string;
    conclusion: string | null;
    steps: { name: string; status: string; conclusion: string | null }[];
  }[];
};
export type Metrics = {
  at: string;
  requests: number;
  errors: number;
  averageMs: number;
  series: { at: string; requests: number; errors: number; ms: number }[];
};
export type Snapshot = {
  runs: Run[];
  audit: Audit[];
  paused: boolean;
  repository: string;
  region: string;
  deployEnabled: boolean;
  productionUrl: string;
  fetchedAt: string;
  releases: NativeRelease[];
};
export type NativeRelease = {
  id: number;
  name: string;
  tag: string;
  notes: string;
  draft: boolean;
  at: string;
  url: string;
  assets: number;
};
export type ReleaseRequest = {
  version: string;
  notes: string;
  platforms: Platform[];
  publish: boolean;
  requestId: string;
};
export type Config = {
  mode: "demo" | "live";
  apiUrl?: string;
  authDomain?: string;
  clientId?: string;
  region?: string;
};

export type Page =
  | "Overview"
  | "Builds"
  | "Releases"
  | "Metrics"
  | "Activity"
  | "Settings";
