import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.98.0';
import { adminClient, consumeBudget, corsHeaders, json, readBody, requireUser, RequestBodyError } from '../_shared/security.ts';
import { resetVaultData } from '../_shared/vaultReset.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const actor = await requireUser(req, null);
    if (!actor) return json({ error: 'Sign in again before recovering your account.' }, 401);
    const body = await readBody(req);
    if (!['send-code', 'reset'].includes(String(body.action)) || typeof body.epoch !== 'string' || !/^[a-f0-9-]{36}$/i.test(body.epoch)) return json({ error: 'Invalid recovery request.' }, 400);
    const db = adminClient();
    const { data: vault, error: vaultError } = await db.from('account_vaults').select('epoch').eq('user_id', actor).maybeSingle();
    if (vaultError) throw vaultError;
    if (vault?.epoch !== body.epoch) return json({ error: 'Your vault changed. Start recovery again.' }, 409);
    // Never accept a caller-supplied email, user ID, session ID or reset grant.
    const { data: { user }, error } = await db.auth.admin.getUserById(actor);
    if (error || !user?.email) return json({ error: 'A verified account email is required.' }, 403);
    const auth = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
    if (body.action === 'send-code') {
      if (!await consumeBudget(actor, 'vault-reset-email', 3)) return json({ error: 'Please wait before requesting another email.' }, 429);
      const sent = await auth.auth.signInWithOtp({ email: user.email, options: { shouldCreateUser: false } });
      if (sent.error) return json({ error: 'The verification email could not be sent. Please retry later.' }, 503);
      return json({ sent: true });
    }
    if (typeof body.code !== 'string' || !/^\d{6,8}$/.test(body.code)) return json({ error: 'Enter the verification code from your email.' }, 400);
    if (!await consumeBudget(actor, 'vault-reset-verify', 5)) return json({ error: 'Too many attempts. Please wait before trying again.' }, 429);
    const verified = await auth.auth.verifyOtp({ email: user.email, token: body.code, type: 'email' });
    if (verified.error || verified.data.user?.id !== actor || !verified.data.session) return json({ error: 'That email code is incorrect or expired.' }, 403);
    const sessionId = JSON.parse(atob(verified.data.session.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).session_id;
    const prepare = await db.rpc('prepare_vault_reset', { p_actor: actor, p_epoch: body.epoch, p_verified_session: sessionId });
    if (prepare.error) {
      await auth.auth.signOut();
      return json({ error: 'Your vault changed or reset is unavailable. Start recovery again.' }, 409);
    }
    const work = await db.rpc('pending_vault_resets');
    try {
      if (work.error) throw work.error;
      const job = work.data?.find((row: { user_id: string }) => row.user_id === actor);
      if (!job) throw new Error('Reset work unavailable');
      await resetVaultData(actor, job.couple_ids, db);
      return json({ reset: true });
    } catch {
      console.error('Encrypted data reset queued for retry');
      return json({ queued: true }, 202);
    }
  } catch (error) {
    return json({ error: error instanceof RequestBodyError ? error.message : 'Recovery is temporarily unavailable. Please retry.' }, error instanceof RequestBodyError ? error.status : 503);
  }
});
