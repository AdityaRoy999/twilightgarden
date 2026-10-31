import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { createHash } from "node:crypto";
import {
  buildInput,
  buildWorkflow,
  deployInput,
  HttpError,
  mapRun,
  parseBody,
  positiveId,
  requireAdmin,
  safeDownloadUrl,
  settingsInput,
  releaseInput,
  workflows,
} from "./domain";
import { github, integrations } from "./github";
import { audit, auditList, command, pause, settings } from "./store";
import { metrics } from "./metrics";
const json = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  },
  body: JSON.stringify(body),
});
let snapshotCache:
  | { until: number; runs: unknown[]; releases: unknown[] }
  | undefined;
let metricsCache: { until: number; data: unknown } | undefined;
async function allowedRun(id: number) {
  const run = await github(`/actions/runs/${id}`);
  if (!buildWorkflow(run, process.env.BUILD_BRANCH!))
    throw new HttpError(
      403,
      "Only configured main-branch mobile workflows can be controlled.",
    );
  return run;
}
export async function handler(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const requestId = event.requestContext.requestId;
  try {
    const actor = requireAdmin(event.requestContext.authorizer?.jwt?.claims);
    const method = event.requestContext.http.method;
    const path = event.rawPath;
    const origin = event.headers.origin;
    if (origin && origin !== process.env.SITE_ORIGIN)
      throw new HttpError(403, "This origin is not permitted.");
    if (event.isBase64Encoded)
      throw new HttpError(400, "Only plain JSON requests are supported.");
    if (method === "GET" && path === "/snapshot") {
      const [config, events, secret] = await Promise.all([
        settings(),
        auditList(),
        integrations(),
      ]);
      if (!snapshotCache || snapshotCache.until < Date.now()) {
        const [result, releases] = await Promise.all([
          github(
            `/actions/runs?per_page=100&branch=${encodeURIComponent(process.env.BUILD_BRANCH!)}`,
          ),
          github("/releases?per_page=10"),
        ]);
        snapshotCache = {
          runs: result.workflow_runs.map(mapRun),
          releases: releases.map((r: any) => ({
            id: r.id,
            name: r.name,
            tag: r.tag_name,
            notes: r.body || "",
            draft: r.draft,
            at: r.published_at || r.created_at,
            url: r.html_url,
            assets: r.assets.length,
          })),
          until: Date.now() + 10000,
        };
      }
      return json(200, {
        runs: snapshotCache.runs,
        releases: snapshotCache.releases,
        audit: events,
        paused: config.paused === true,
        repository: process.env.GITHUB_REPO,
        region: process.env.AWS_REGION,
        deployEnabled: !!secret.vercelDeployHook,
        productionUrl: process.env.PRODUCTION_URL,
        fetchedAt: new Date().toISOString(),
      });
    }
    if (method === "GET" && path === "/metrics") {
      if (!metricsCache || metricsCache.until < Date.now())
        metricsCache = { data: await metrics(), until: Date.now() + 60000 };
      return json(200, metricsCache.data);
    }
    if (method === "POST" && path === "/builds") {
      const input = parseBody(event.body, buildInput);
      const result = await command(
        actor,
        input.requestId,
        "build",
        input.platform,
        () =>
          github(
            `/actions/workflows/${workflows[input.platform]}/dispatches`,
            "POST",
            { ref: process.env.BUILD_BRANCH },
          ),
        true,
      );
      snapshotCache = undefined;
      return json(202, result);
    }
    if (method === "POST" && path === "/releases") {
      const input = parseBody(event.body, releaseInput);
      const detail = JSON.stringify({
        version: input.version,
        platforms: input.platforms,
        publish: input.publish,
        notesHash: createHash("sha256").update(input.notes).digest("hex"),
      });
      const result = await command(
        actor,
        input.requestId,
        "release",
        detail,
        () =>
          github("/actions/workflows/native-release.yml/dispatches", "POST", {
            ref: process.env.BUILD_BRANCH,
            inputs: {
              version: input.version,
              platforms: JSON.stringify(input.platforms),
              release_notes: input.notes,
              publish: input.publish,
            },
          }),
        true,
      );
      snapshotCache = undefined;
      return json(202, result);
    }
    if (method === "POST" && path === "/settings") {
      const input = parseBody(event.body, settingsInput);
      await pause(actor, input.paused);
      return json(200, { paused: input.paused });
    }
    if (method === "POST" && path === "/deployments") {
      const input = parseBody(event.body, deployInput);
      const hook = (await integrations()).vercelDeployHook;
      if (!hook)
        throw new HttpError(409, "Production deploy hook is not configured.");
      const url = new URL(hook);
      if (
        url.protocol !== "https:" ||
        url.hostname !== "api.vercel.com" ||
        !url.pathname.startsWith("/v1/integrations/deploy/")
      )
        throw new HttpError(
          503,
          "The production deploy hook configuration is invalid.",
        );
      const result = await command(
        actor,
        input.requestId,
        "deployment",
        "latest configured main",
        async () => {
          const response = await fetch(url, {
            method: "POST",
            redirect: "error",
            signal: AbortSignal.timeout(8000),
          });
          if (!response.ok)
            throw new HttpError(502, "Vercel could not accept the deployment.");
          return { requested: true };
        },
      );
      return json(202, result);
    }
    const runMatch = path.match(/^\/runs\/(\d+)$/);
    if (method === "GET" && runMatch) {
      const id = positiveId(runMatch[1]);
      const run = await github(`/actions/runs/${id}`);
      // Read CI details too; mutations and artifacts remain mobile-workflow-only.
      if (run.head_branch !== process.env.BUILD_BRANCH)
        throw new HttpError(403, "This run is outside the configured branch.");
      const [jobs, artifacts] = await Promise.all([
        github(`/actions/runs/${id}/jobs?per_page=100`),
        github(`/actions/runs/${id}/artifacts?per_page=100`),
      ]);
      return json(200, {
        run: mapRun(run),
        jobs: jobs.jobs.map((j: any) => ({
          id: j.id,
          name: j.name,
          status: j.status,
          conclusion: j.conclusion,
          steps: (j.steps || []).map((s: any) => ({
            name: s.name,
            status: s.status,
            conclusion: s.conclusion,
          })),
        })),
        artifacts: buildWorkflow(run, process.env.BUILD_BRANCH!)
          ? artifacts.artifacts.map((a: any) => ({
              id: a.id,
              name: a.name,
              size: a.size_in_bytes,
              expired: a.expired,
              expiresAt: a.expires_at,
            }))
          : [],
      });
    }
    const cancelMatch = path.match(/^\/runs\/(\d+)\/cancel$/);
    if (method === "POST" && cancelMatch) {
      const id = positiveId(cancelMatch[1]);
      await allowedRun(id);
      await audit(actor, "build.cancel.requested", String(id));
      await github(`/actions/runs/${id}/cancel`, "POST");
      snapshotCache = undefined;
      return json(202, { accepted: true });
    }
    const artifactMatch = path.match(/^\/artifacts\/(\d+)\/download$/);
    if (method === "GET" && artifactMatch) {
      const id = positiveId(artifactMatch[1]);
      const a = await github(`/actions/artifacts/${id}`);
      if (a.expired)
        throw new HttpError(
          410,
          "This build artifact has expired. Start a new build.",
        );
      await allowedRun(a.workflow_run.id);
      const raw = await github(
        `/actions/artifacts/${id}/zip`,
        "GET",
        undefined,
        true,
      );
      if (typeof raw !== "string")
        throw new HttpError(502, "Download URL is unavailable.");
      const url = safeDownloadUrl(raw);
      await audit(actor, "artifact.download", `${a.name} · ${id}`);
      return json(200, { url });
    }
    return json(404, { error: "This admin endpoint does not exist." });
  } catch (error) {
    const known = error instanceof HttpError;
    // Never log headers, tokens, secret values, hook URLs, or signed download URLs.
    console.error(
      JSON.stringify({
        requestId,
        error: known ? "request_rejected" : (error as Error).name,
        status: known ? error.status : 500,
      }),
    );
    return json(known ? error.status : 500, {
      error: known
        ? error.message
        : "Operation could not be confirmed. Refresh and check upstream status before retrying.",
      requestId,
    });
  }
}
