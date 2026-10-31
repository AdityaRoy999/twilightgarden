import type { Config } from "../shared/types";
const TOKEN = "twilight-control-session";
type Tokens = { access_token: string; expires_at: number };
export function token() {
  try {
    const t = JSON.parse(
      sessionStorage.getItem(TOKEN) || "null",
    ) as Tokens | null;
    return t && t.expires_at > Date.now() + 15000 ? t.access_token : null;
  } catch {
    return null;
  }
}
export function clearSession() {
  sessionStorage.removeItem(TOKEN);
}
function base64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
export function validateConfig(c: Config): Config {
  if (c.mode !== "live") throw new Error("Invalid live configuration.");
  for (const key of ["apiUrl", "authDomain"] as const) {
    const u = new URL(c[key] || "");
    if (u.protocol !== "https:")
      throw new Error("Live endpoints must use HTTPS.");
  }
  if (!c.clientId) throw new Error("Missing Cognito client ID.");
  return c;
}
export async function signIn(c: Config) {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(48)));
  const state = base64url(crypto.getRandomValues(new Uint8Array(24)));
  sessionStorage.setItem("oauth", JSON.stringify({ verifier, state }));
  const challenge = base64url(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
    ),
  );
  const url = new URL("/oauth2/authorize", c.authDomain);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: c.clientId!,
    redirect_uri: location.origin + "/",
    scope: "openid email twilight-admin/control",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();
  location.assign(url);
}
export async function finishSignIn(c: Config) {
  const params = new URLSearchParams(location.search);
  if (!params.has("code") && !params.has("error")) return;
  const saved = sessionStorage.getItem("oauth");
  sessionStorage.removeItem("oauth");
  history.replaceState({}, "", location.pathname);
  if (params.has("error"))
    throw new Error("Sign-in was not completed. Please try again.");
  const pending = saved ? JSON.parse(saved) : null;
  if (!pending?.verifier || pending.state !== params.get("state"))
    throw new Error("Sign-in state expired. Please sign in again.");
  const response = await fetch(new URL("/oauth2/token", c.authDomain), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: c.clientId!,
      redirect_uri: location.origin + "/",
      code: params.get("code")!,
      code_verifier: pending.verifier,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new Error("Could not exchange your sign-in code. Please retry.");
  const data = await response.json();
  if (!data.access_token || !Number.isFinite(data.expires_in))
    throw new Error("Invalid sign-in response.");
  sessionStorage.setItem(
    TOKEN,
    JSON.stringify({
      access_token: data.access_token,
      expires_at: Date.now() + data.expires_in * 1000,
    }),
  );
}
export function signOut(c: Config) {
  clearSession();
  const url = new URL("/logout", c.authDomain);
  url.search = new URLSearchParams({
    client_id: c.clientId!,
    logout_uri: location.origin + "/",
  }).toString();
  location.assign(url);
}
