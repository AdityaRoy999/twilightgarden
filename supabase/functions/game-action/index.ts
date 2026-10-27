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
import { inviteToGame } from "../_shared/gameInvitations.ts";
import { generateGamePrompts } from "../_shared/gamePrompts.ts";
Deno.serve(async (req: Request) => {
  const started = performance.now();
  const response = await handleGameRequest(req);
  response.headers.set('Server-Timing',`game;dur=${(performance.now()-started).toFixed(1)}`);
  return response;
});
async function handleGameRequest(req: Request): Promise<Response> {
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
    if (body.kind === "open") {
      if (
        typeof body.game !== "string" ||
        !Object.hasOwn(games, body.game) ||
        typeof body.couple !== "string" ||
        !/^[a-f0-9-]{36}$/i.test(body.couple)
      )
        return json({ error: "Invalid room" }, 400);
      if (!(await consumeBudget(actor, "game-move", 100))) return json({error:"Please slow down"},429);
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
      let invited = false;
      let invitationError: string | undefined;
      if (data.player_x === actor) {
        const {data:relationship} = await db.from('couples').select('partner_1_id,partner_2_id').eq('id',body.couple).single();
        if (relationship) {
          try { invited = await inviteToGame(db,req,actor,data,relationship); }
          catch { invitationError = 'The game is ready, but the invitation could not be sent. Tap Notify my partner to retry.'; }
        }
      }
      return json({ session: data, invited, invitationError });
    }
    if (
      typeof body.id !== "string" ||
      !/^[a-f0-9-]{36}$/i.test(body.id) ||
      !Number.isInteger(body.revision) ||
      !body.action ||
      typeof body.action !== "object"
    )
      return json({ error: "Invalid action" }, 400);
    // Fetch all context in one indexed join, concurrently with the request budget.
    // Nested secrets are stripped before any public room response is returned.
    const [allowed,context] = await Promise.all([
      consumeBudget(actor,"game-move",100),
      db.from('game_sessions').select('*,couples!inner(partner_1_id,partner_2_id,status),game_room_secrets(payload)').eq('id',body.id).eq('engine_version',2).single(),
    ]);
    if (!allowed) return json({error:'Please slow down'},429);
    if (context.error || !context.data) return json({error:'Room unavailable'},403);
    const {couples:relationship,game_room_secrets:privateData,...room} = context.data;
    const couple = Array.isArray(relationship) ? relationship[0] : relationship;
    const privateRow = Array.isArray(privateData) ? privateData[0] : privateData;
    if (![room.player_x,room.player_o].includes(actor)) return json({error:'Room unavailable'},403);
    if (!couple || couple.status !== 'active' || ![couple.partner_1_id,couple.partner_2_id].includes(actor)) return json({error:'Relationship is not active'},403);
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
    if (action.kind === 'invite') {
      const invited = await inviteToGame(db,req,actor,{id:room.id,game_type:type},couple);
      return json({session:room,invited});
    }
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
}
