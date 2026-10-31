import { z } from "zod";
import type { Run } from "../shared/types";
export const buildInput = z
  .object({ platform: z.enum(["ios", "android", "dmg"]), requestId: z.uuid() })
  .strict();
export const deployInput = z.object({ requestId: z.uuid() }).strict();
export const settingsInput = z.object({ paused: z.boolean() }).strict();
export const releaseInput = z
  .object({
    version: z
      .string()
      .regex(/^(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})$/)
      .refine((v) => v !== "0.0.0"),
    notes: z.string().trim().min(5).max(10000),
    platforms: z
      .array(z.enum(["ios", "android", "dmg"]))
      .min(1)
      .max(3)
      .refine((v) => new Set(v).size === v.length),
    publish: z.boolean(),
    requestId: z.uuid(),
  })
  .strict();
export const workflows = {
  ios: "ios-unsigned.yml",
  android: "android-apk.yml",
  dmg: "macos-dmg.yml",
} as const;
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
export function requireAdmin(claims: Record<string, unknown> | undefined) {
  const groups = claims?.["cognito:groups"];
  // API Gateway represents groups either as an array or a comma-delimited string.
  const list = Array.isArray(groups)
    ? groups
    : typeof groups === "string"
      ? groups
          .replace(/[\[\]"]/g, "")
          .split(",")
          .map((v) => v.trim())
      : [];
  if (
    !claims?.sub ||
    claims.token_use !== "access" ||
    !list.includes("admins") ||
    !String(claims.scope || "")
      .split(" ")
      .includes("twilight-admin/control")
  )
    throw new HttpError(403, "An invited administrator account is required.");
  return String(claims.sub);
}
export function parseBody<T>(raw: string | undefined, schema: z.ZodType<T>): T {
  if (!raw || raw.length > 14000)
    throw new HttpError(400, "A small JSON request body is required.");
  try {
    return schema.parse(JSON.parse(raw));
  } catch {
    throw new HttpError(
      400,
      "Invalid request. Check the selected options and retry.",
    );
  }
}
export function positiveId(raw: string) {
  if (
    !/^\d{1,16}$/.test(raw) ||
    !Number.isSafeInteger(Number(raw)) ||
    Number(raw) < 1
  )
    throw new HttpError(400, "Invalid identifier.");
  return Number(raw);
}
export function mapRun(r: any): Run {
  const path = String(r.path || "");
  const duration =
    r.status === "completed" && r.run_started_at
      ? Math.max(
          0,
          (Date.parse(r.updated_at) - Date.parse(r.run_started_at)) / 1000,
        )
      : 0;
  return {
    id: r.id,
    name: r.name || "Workflow",
    title: r.display_title || r.name,
    platform: path.includes(workflows.ios)
      ? "ios"
      : path.includes(workflows.android)
        ? "android"
        : path.includes(workflows.dmg)
          ? "dmg"
          : path.includes("native-release.yml")
            ? "release"
            : "ci",
    status: r.status,
    conclusion: r.conclusion,
    branch: r.head_branch,
    sha: r.head_sha,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    url: r.html_url,
    duration,
  };
}
export function buildWorkflow(run: any, branch: string) {
  return (
    run.head_branch === branch &&
    [...Object.values(workflows), "native-release.yml"].some(
      (name) => String(run.path).split("@")[0] === `.github/workflows/${name}`,
    )
  );
}
export function safeDownloadUrl(raw: string) {
  const url = new URL(raw);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    ![".githubusercontent.com", ".blob.core.windows.net", ".github.com"].some(
      (s) => url.hostname.endsWith(s),
    )
  )
    throw new HttpError(
      502,
      "The artifact provider returned an unexpected download URL.",
    );
  return url.toString();
}
