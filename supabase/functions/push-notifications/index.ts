import { GoogleAuth } from 'npm:google-auth-library@9.4.1';
import { adminClient, consumeBudget, corsHeaders, isInternal, json, readBody, requireUser, RequestBodyError } from '../_shared/security.ts';

const SITE = 'https://twilight-mocha.vercel.app';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const internal = await isInternal(req);
  let actorId: string | null;
  try { actorId = internal ? null : await requireUser(req); } catch { return json({error:'Sign-in verification is temporarily unavailable. Please retry.',code:'AUTH_UNAVAILABLE'},503); }
  if (!internal && !actorId) return json({ error: 'Authentication required' }, 401);
  try {
    const body = await readBody(req);
    const db = adminClient();
    let senderId = actorId;
    let targetId: string | null = null;
    let chat = false;
    const record = body.record && typeof body.record === 'object' ? body.record as Record<string, unknown> : undefined;
    const noteId = body.noteId || (internal ? record?.id : undefined);
    if (noteId) {
      if (typeof noteId !== 'string' || !/^[0-9a-f-]{36}$/i.test(noteId)) return json({ error: 'Invalid message identifier' }, 400);
      const { data: note, error } = await db.from('shared_notes').select('id,sender_id,couple_id').eq('id', noteId).single();
      if (error || !note) return json({ error: 'Message not found' }, 404);
      if (!internal && actorId !== note.sender_id) return json({ error: 'Forbidden' }, 403);
      const { data: couple } = await db.from('couples').select('partner_1_id,partner_2_id,status').eq('id', note.couple_id).single();
      if (!couple || couple.status !== 'active') return json({ error: 'Relationship is not active' }, 403);
      senderId = note.sender_id;
      targetId = couple.partner_1_id === senderId ? couple.partner_2_id : couple.partner_2_id === senderId ? couple.partner_1_id : null;
      chat = true;
    } else {
      // Browser requests may only notify the verified caller's active partner.
      if (!actorId || typeof body.userId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.userId)) return json({ error: 'A partner recipient is required' }, 400);
      const { data: couple } = await db.from('couples').select('partner_1_id,partner_2_id')
        .eq('status','active').or(`partner_1_id.eq.${actorId},partner_2_id.eq.${actorId}`).maybeSingle();
      const partnerId = couple?.partner_1_id === actorId ? couple.partner_2_id : couple?.partner_1_id;
      if (partnerId !== body.userId) return json({ error: 'Forbidden' }, 403);
      targetId = partnerId;
    }
    if (!senderId || !targetId) return json({ error: 'Recipient unavailable' }, 400);
    if (!await consumeBudget(senderId, 'push', 30)) return json({ error: 'Too many notification requests' }, 429);
    const { data: profile } = await db.from('profiles').select('role').eq('id',targetId).single();
    const prefix = profile?.role === 'partner' ? '/partner' : profile?.role === 'admin' ? '/admin' : '';
    const requestedRoute = typeof body.url === 'string' ? body.url.replace(/^\/(partner|admin)/,'') : '/games';
    const route = chat ? `${prefix}/notes` : /^\/games(?:\/[a-z0-9-]+)?$/.test(requestedRoute) ? prefix+requestedRoute : `${prefix}/games`;
    const { data: tokens, error: tokenError } = await db.from('user_fcm_tokens').select('id,token,device_type').eq('user_id', targetId);
    if (tokenError) throw tokenError;
    if (!tokens?.length) return json({ success: true, accepted: 0, failed: 0 });
    const credentials = Deno.env.get('FCM_SERVICE_ACCOUNT');
    if (!credentials) return json({ error: 'Push delivery is not configured' }, 503);
    const account = JSON.parse(credentials);
    const auth = new GoogleAuth({ credentials: account, scopes: ['https://www.googleapis.com/auth/firebase.messaging'] });
    const accessToken = (await (await auth.getClient()).getAccessToken()).token;
    if (!accessToken) throw new Error('Push authentication failed');
    const results = await Promise.all(tokens.map(async entry => {
      const message: Record<string, unknown> = {
        token: entry.token,
        notification: { title:'Twilight Garden', body:chat ? 'Your partner sent a private message.' : 'Your partner shared a game update.' },
        data: { url:route, type:chat?'chat':'game', noteId:typeof noteId==='string'?noteId:'' },
      };
      if (entry.device_type === 'android') message.android = { priority:'high', notification:{ sound:'default', channel_id:'PushNotifications' } };
      else if (entry.device_type === 'web') message.webpush = { notification:{ icon:SITE+'/twilight.png',badge:SITE+'/twilight.png' },fcm_options:{link:SITE+'/#'+route} };
      try {
        const response = await fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
          method:'POST', headers:{ Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json' },
          body:JSON.stringify({message}), signal:AbortSignal.timeout(15000),
        });
        if (!response.ok) {
          const error = await response.json();
          if (error?.error?.details?.some((d: {errorCode?:string})=>d.errorCode==='UNREGISTERED')) await db.from('user_fcm_tokens').delete().eq('id',entry.id);
          return false;
        }
        return true;
      } catch { return false; }
    }));
    const accepted = results.filter(Boolean).length;
    // FCM acceptance is not device delivery. Receipts are acknowledged by clients.
    return json({success:accepted>0,accepted,failed:results.length-accepted},accepted>0?200:502);
  } catch (err) {
    if (err instanceof RequestBodyError) return json({ error: err.message }, err.status);
    console.error('Push request failed',err instanceof Error?err.name:'UnknownError');
    return json({error:err instanceof SyntaxError?'Invalid JSON body':'Push delivery failed'},err instanceof SyntaxError?400:502);
  }
});
