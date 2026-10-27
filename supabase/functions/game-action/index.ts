import {
  adminClient,
  consumeBudget,
  corsHeaders,
  json,
  readBody,
  requireUser,
  RequestBodyError,
} from "../_shared/security.ts";
import {
  games,
  initialGame,
  needsPrompts,
  play,
  type GameType,
  type Player,
} from "../_shared/gameEngine.ts";
import { generateGamePrompts } from "../_shared/gamePrompts.ts";
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let actor: string | null;
  try {
    actor = await requireUser(req);
  } catch {
    return json({ error: "Session verification unavailable" }, 503);
  }
  if (!actor) return json({ error: "Authentication required" }, 401);
  try {
    const body = await readBody(req);
    const db = adminClient();
    if (!(await consumeBudget(actor, "game-move", 100)))
      return json({ error: "Please slow down" }, 429);
    if (body.kind === "open") {
      if (
        typeof body.game !== "string" ||
        !Object.hasOwn(games, body.game) ||
        typeof body.couple !== "string" ||
        !/^[a-f0-9-]{36}$/i.test(body.couple)
      )
        return json({ error: "Invalid room" }, 400);
      const initial = initialGame(body.game as GameType);
      const { data, error } = await db.rpc("open_game_room", {
        p_actor: actor,
        p_couple: body.couple,
        p_type: body.game,
        p_state: initial.state,
        p_secret: initial.secret,
      });
      if (error)
        return json(
          { error: "Could not join this active relationship’s game" },
          403,
        );
      return json({ session: data });
    }
    if (
      typeof body.id !== "string" ||
      !/^[a-f0-9-]{36}$/i.test(body.id) ||
      !Number.isInteger(body.revision) ||
      !body.action ||
      typeof body.action !== "object"
    )
      return json({ error: "Invalid action" }, 400);
    const { data: room, error } = await db
      .from("game_sessions")
      .select("*")
      .eq("id", body.id)
      .eq("engine_version", 2)
      .single();
    if (error || !room || ![room.player_x, room.player_o].includes(actor))
      return json({ error: "Room unavailable" }, 403);
    const { data: couple } = await db
      .from("couples")
      .select("partner_1_id,partner_2_id,status")
      .eq("id", room.couple_id)
      .single();
    if (
      !couple ||
      couple.status !== "active" ||
      ![couple.partner_1_id, couple.partner_2_id].includes(actor)
    )
      return json({ error: "Relationship is not active" }, 403);
    if (room.revision !== body.revision)
      return json(
        {
          error: "Your partner just updated the game. Try again.",
          session: room,
        },
        409,
      );
    const action = body.action as Record<string, unknown>,
      type = room.game_type as GameType;
    if (action.kind === "invite") {
      const recipient =
        actor === couple.partner_1_id
          ? couple.partner_2_id
          : couple.partner_1_id;
      const digest = new Uint8Array(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(`${room.id}:${actor}:invite`),
        ),
      );
      const hex = Array.from(digest.slice(0, 16), (x) =>
        x.toString(16).padStart(2, "0"),
      ).join("");
      const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
      const { data: previous } = await db
        .from("notifications")
        .select("id")
        .eq("id", id)
        .maybeSingle();
      if (!previous) {
        const { error: failure } = await db
          .from("notifications")
          .upsert(
            {
              id,
              user_id: recipient,
              type: "game",
              message: `Your partner invited you to ${games[type][0]}.`,
              is_read: false,
              data: {
                url: `/games/${games[type][1]}`,
                gameName: games[type][0],
              },
            },
            { onConflict: "id", ignoreDuplicates: true },
          );
        if (failure) throw new Error("Invitation could not be saved");
        // Best-effort push; the in-app notification is durable even without a token.
        try {
          await fetch(
            `${Deno.env.get("SUPABASE_URL")}/functions/v1/push-notifications`,
            {
              method: "POST",
              headers: {
                Authorization: req.headers.get("Authorization")!,
                "Content-Type": "application/json",
                apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
              },
              body: JSON.stringify({
                userId: recipient,
                url: `/games/${games[type][1]}`,
              }),
              signal: AbortSignal.timeout(3000),
            },
          );
        } catch {
          /* In-app delivery succeeded. */
        }
      }
      return json({ session: room, invited: true });
    }
    const { data: privateRow } = await db
      .from("game_room_secrets")
      .select("payload")
      .eq("session_id", body.id)
      .single();
    if (!privateRow) return json({ error: "Room unavailable" }, 404);
    let state = room.board_state,
      secret = privateRow.payload;
    if (action.kind === "prefetch") {
      if (!needsPrompts(type)) return json({ session: room });
      if (secret.prompts.length >= 3) return json({ session: room });
      if (!(await consumeBudget(actor, "game-ai", 4)))
        return json(
          { error: "Please wait before generating more questions" },
          429,
        );
      secret.prompts.push(...(await generateGamePrompts(type, state.level)));
    } else if (action.kind !== "leave") {
      const output = play(
        type,
        state,
        secret,
        room.player_x === actor ? "X" : ("O" as Player),
        action,
      );
      state = output.state;
      secret = output.secret;
    }
    state.promptCount = secret.prompts.length;
    const { data, error: commitError } = await db.rpc("commit_game_action", {
      p_actor: actor,
      p_id: room.id,
      p_revision: body.revision,
      p_state: state,
      p_secret: secret,
      p_leave: action.kind === "leave",
    });
    if (commitError)
      return json(
        {
          error: commitError.message.includes("STALE_ROOM")
            ? "Your partner just updated the game. Try again."
            : "Move could not be saved. Refresh the game.",
        },
        409,
      );
    return json({ session: data, promptCount: secret.prompts.length });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Game unavailable" },
      error instanceof RequestBodyError ? error.status : 400,
    );
  }
});
