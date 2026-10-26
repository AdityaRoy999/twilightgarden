import {
  adminClient,
  consumeBudget,
  corsHeaders,
  json,
  readBody,
  requireUser,
  RequestBodyError,
} from "../_shared/security.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const userId = await requireUser(req);
    if (!userId) return json({ error: "Authentication required" }, 401);
    const body = await readBody(req),
      coupleId = body.coupleId;
    if (typeof coupleId !== "string" || !/^[0-9a-f-]{36}$/i.test(coupleId))
      return json({ error: "Invalid relationship" }, 400);
    const { data: couple, error } = await adminClient()
      .from("couples")
      .select("partner_1_id,partner_2_id,status")
      .eq("id", coupleId)
      .maybeSingle();
    if (error) throw error;
    if (
      !couple ||
      couple.status !== "active" ||
      ![couple.partner_1_id, couple.partner_2_id].includes(userId)
    )
      return json({ error: "Active relationship required" }, 403);
    const keyId = Deno.env.get("CLOUDFLARE_TURN_KEY_ID"),
      token = Deno.env.get("CLOUDFLARE_TURN_API_TOKEN");
    if (!keyId || !token)
      return json(
        {
          error: "Relay calling has not been configured.",
          code: "TURN_NOT_CONFIGURED",
        },
        503,
      );
    if (!(await consumeBudget(userId, "turn-credentials", 30)))
      return json({ error: "Too many call attempts. Please wait." }, 429);
    const configured = Number(Deno.env.get("CLOUDFLARE_TURN_TTL") || 3600);
    const ttl = Number.isFinite(configured)
      ? Math.max(600, Math.min(86400, Math.floor(configured)))
      : 3600;
    const upstream = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(keyId)}/credentials/generate-ice-servers`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ttl }),
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!upstream.ok)
      return json(
        {
          error: "Relay calling is temporarily unavailable.",
          code: "TURN_UPSTREAM_FAILED",
        },
        502,
      );
    const payload = await upstream.json();
    if (!Array.isArray(payload.iceServers) || !payload.iceServers.length)
      throw new Error("Invalid relay response");
    return new Response(
      JSON.stringify({
        iceServers: payload.iceServers,
        expiresAt: Date.now() + ttl * 1000,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    if (error instanceof RequestBodyError) return json({ error: error.message }, error.status);
    return json(
      { error: "Could not prepare the private call connection." },
      500,
    );
  }
});
