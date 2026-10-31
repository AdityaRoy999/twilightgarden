import { createSign } from "node:crypto";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import { HttpError } from "./domain";
const sm = new SecretsManagerClient({});
type Integration = {
  githubToken?: string;
  appId?: string;
  installationId?: string;
  privateKey?: string;
  vercelDeployHook?: string;
};
let secretCache: { data: Integration; until: number } | undefined;
let installationCache: { token: string; until: number } | undefined;
export async function integrations(): Promise<Integration> {
  if (secretCache && secretCache.until > Date.now()) return secretCache.data;
  const result = await sm.send(
    new GetSecretValueCommand({ SecretId: process.env.INTEGRATION_SECRET_ARN }),
  );
  if (!result.SecretString)
    throw new HttpError(503, "Integration credentials are not configured.");
  let data: Integration;
  try {
    data = JSON.parse(result.SecretString);
  } catch {
    throw new HttpError(503, "The integration secret must contain valid JSON.");
  }
  secretCache = { data, until: Date.now() + 60000 };
  return data;
}
async function githubToken() {
  const config = await integrations();
  if (config.githubToken && config.githubToken !== "REPLACE_ME")
    return config.githubToken;
  if (!config.appId || !config.installationId || !config.privateKey)
    throw new HttpError(
      503,
      "Connect GitHub in AWS Secrets Manager, then retry in one minute.",
    );
  if (!/^\d+$/.test(config.installationId))
    throw new HttpError(503, "Invalid GitHub installation configuration.");
  if (installationCache && installationCache.until > Date.now())
    return installationCache.token;
  const now = Math.floor(Date.now() / 1000);
  const head = Buffer.from(
    JSON.stringify({ alg: "RS256", typ: "JWT" }),
  ).toString("base64url");
  const body = Buffer.from(
    JSON.stringify({ iat: now - 60, exp: now + 540, iss: config.appId }),
  ).toString("base64url");
  const unsigned = `${head}.${body}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const jwt = `${unsigned}.${signer.sign(config.privateKey.replace(/\\n/g, "\n"), "base64url")}`;
  const response = await fetch(
    `https://api.github.com/app/installations/${config.installationId}/access_tokens`,
    {
      method: "POST",
      headers: headers(jwt),
      body: JSON.stringify({
        repositories: [process.env.GITHUB_REPO!.split("/")[1]],
        permissions: { actions: "write", contents: "read" },
      }),
      signal: AbortSignal.timeout(8000),
    },
  );
  if (!response.ok)
    throw new HttpError(
      503,
      "GitHub App authorization failed. Check the installation and permissions.",
    );
  const data = (await response.json()) as { token: string; expires_at: string };
  installationCache = {
    token: data.token,
    until: Date.parse(data.expires_at) - 60000,
  };
  return data.token;
}
function headers(auth: string) {
  return {
    Authorization: `Bearer ${auth}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2026-03-10",
    "Content-Type": "application/json",
    "User-Agent": "Twilight-Control",
  };
}
export async function github(
  path: string,
  method = "GET",
  body?: unknown,
  manualRedirect = false,
): Promise<any> {
  const auth = await githubToken();
  const response = await fetch(
    `https://api.github.com/repos/${process.env.GITHUB_REPO}${path}`,
    {
      method,
      headers: headers(auth),
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: manualRedirect ? "manual" : "follow",
      signal: AbortSignal.timeout(8000),
    },
  );
  if (manualRedirect && response.status === 302)
    return response.headers.get("location");
  if (!response.ok) {
    if (response.status === 404)
      throw new HttpError(
        404,
        "The GitHub resource was not found or is no longer available.",
      );
    if ([403, 429].includes(response.status))
      throw new HttpError(
        503,
        "GitHub access is restricted or rate limited. Check permissions and try later.",
      );
    throw new HttpError(
      502,
      `GitHub could not complete this action (${response.status}). Check Actions before retrying a build.`,
    );
  }
  return response.status === 204 ? null : response.json();
}
