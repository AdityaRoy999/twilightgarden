import type {
  Config,
  Metrics,
  Platform,
  RunDetail,
  Snapshot,
  ReleaseRequest,
} from "../shared/types";
import { clearSession, token } from "./auth";
import { demoAction, demoDetail, demoMetrics, demoSnapshot } from "./demo";
export class AdminApi {
  constructor(readonly config: Config) {}
  async request<T>(path: string, body?: unknown): Promise<T> {
    const auth = token();
    if (!auth) throw new Error("Your admin session expired. Sign in again.");
    const response = await fetch(`${this.config.apiUrl}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Authorization: `Bearer ${auth}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(25000),
      cache: "no-store",
    });
    if (response.status === 401) {
      clearSession();
      throw new Error("Your admin session expired. Sign in again.");
    }
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error || `Request failed (${response.status}).`);
    return data;
  }
  snapshot(): Promise<Snapshot> {
    return this.config.mode === "demo"
      ? Promise.resolve(demoSnapshot())
      : this.request("/snapshot");
  }
  metrics(): Promise<Metrics> {
    return this.config.mode === "demo"
      ? Promise.resolve(demoMetrics())
      : this.request("/metrics");
  }
  detail(id: number): Promise<RunDetail> {
    return this.config.mode === "demo"
      ? Promise.resolve(demoDetail(id))
      : this.request(`/runs/${id}`);
  }
  async build(platform: Platform, requestId: string) {
    if (this.config.mode === "demo")
      return demoAction("build.request", platform + " · main", platform);
    await this.request("/builds", { platform, requestId });
  }
  async pause(paused: boolean) {
    if (this.config.mode === "demo")
      return demoAction("builds.pause", String(paused));
    await this.request("/settings", { paused });
  }
  async release(input: ReleaseRequest) {
    if (this.config.mode === "demo")
      return demoAction(
        "release.request",
        `${input.version} · ${input.platforms.join(", ")} · ${input.publish ? "publish" : "draft"}`,
      );
    await this.request("/releases", input);
  }
  async cancel(id: number) {
    if (this.config.mode === "demo")
      return demoAction("build.cancel", String(id));
    await this.request(`/runs/${id}/cancel`, {});
  }
  async deploy(requestId: string) {
    if (this.config.mode === "demo")
      return demoAction("deployment.request", "Latest main · demonstration");
    await this.request("/deployments", { requestId });
  }
  async download(id: number) {
    if (this.config.mode === "demo")
      throw new Error(
        "Demo artifacts are illustrative. Connect AWS to download real builds.",
      );
    return this.request<{ url: string }>(`/artifacts/${id}/download`);
  }
}
