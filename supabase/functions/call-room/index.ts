import { adminClient, consumeBudget, corsHeaders, json, readBody, requireUser, RequestBodyError } from '../_shared/security.ts';
import { signCallRoomToken } from '../_shared/call-room-token.ts';
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const userId = await requireUser(req);
    if (!userId) return json({ error: 'Authentication required' }, 401);
    const body = await readBody(req), coupleId = body.coupleId;
    if (typeof coupleId !== 'string' || !/^[0-9a-f-]{36}$/i.test(coupleId)) return json({ error: 'Invalid relationship' }, 400);
    const { data, error } = await adminClient().from('couples').select('partner_1_id,partner_2_id,status').eq('id', coupleId).maybeSingle();
    if (error) throw error;
    if (!data || data.status !== 'active' || ![data.partner_1_id, data.partner_2_id].includes(userId)) return json({ error: 'Active relationship required' }, 403);
    const url = Deno.env.get('LIVEKIT_URL'), apiKey = Deno.env.get('LIVEKIT_API_KEY'), secret = Deno.env.get('LIVEKIT_API_SECRET');
    const configured = !!(url?.startsWith('wss://') && apiKey && secret);
    if (body.action === 'capabilities') return json({ configured }, 200);
    if (!configured) return json({ error: 'Native calling needs the self-hosted media server configuration.', code: 'SFU_NOT_CONFIGURED' }, 503);
    if (typeof body.callId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.callId)) return json({ error: 'Invalid call' }, 400);
    if (!(await consumeBudget(userId, 'call-room', 30))) return json({ error: 'Please wait before joining another call.' }, 429);
    const token = await signCallRoomToken(apiKey!, secret!, userId, `twilight-${coupleId}-${body.callId}`);
    return new Response(JSON.stringify({ url, token }), { headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof RequestBodyError) return json({ error: error.message }, error.status);
    return json({ error: 'Could not prepare the private media room.' }, 503);
  }
});
