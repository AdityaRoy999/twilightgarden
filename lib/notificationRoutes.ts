/** Notification data is untrusted. Keep navigation inside this application. */
export function notificationPath(
  raw: unknown,
  fallback = "/dashboard",
  role?: string,
  origin = globalThis.location?.origin || "https://twilight-mocha.vercel.app",
) {
  if (typeof raw !== "string" || !raw.trim()) return fallback;
  try {
    const url = new URL(raw, origin);
    if (url.origin !== origin) return fallback;
    const path = url.hash ? url.hash.slice(1) : url.pathname + url.search;
    if (
      !path.startsWith("/") ||
      path.startsWith("//") ||
      /[\x00-\x1f\\]/.test(path)
    )
      return fallback;
    if (!role) return path;
    const local = path.replace(/^\/(partner|admin)(?=\/|$)/, "");
    const prefix =
      role === "partner" ? "/partner" : role === "admin" ? "/admin" : "";
    return /^\/(notes|games|dashboard|calendar|insights|wellness)(?:\/|$|\?)/.test(
      local,
    )
      ? prefix + local
      : path;
  } catch {
    return fallback;
  }
}
