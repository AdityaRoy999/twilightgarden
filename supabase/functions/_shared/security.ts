import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.98.0';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-twilight-webhook',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
export function adminClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function requireUser(req: Request): Promise<string | null> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.getUser(token);
  return error ? null : data.user?.id ?? null;
}
async function sameSecret(actual: string | null, expected: string | undefined): Promise<boolean> {
  if (!actual || !expected) return false;
  const hash = async (value: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  const [a,b] = await Promise.all([hash(actual),hash(expected)]);
  let diff = 0; for (let i=0;i<a.length;i++) diff |= a[i]^b[i];
  return diff === 0;
}
export async function isInternal(req: Request): Promise<boolean> {
  return await sameSecret(req.headers.get('x-twilight-webhook'), Deno.env.get('TWILIGHT_WEBHOOK_SECRET')) ||
    await sameSecret(req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
}
export async function consumeBudget(userId: string, action: string, limit: number): Promise<boolean> {
  const { data, error } = await adminClient().rpc('consume_request_budget', { p_user_id: userId, p_action: action, p_limit: limit });
  if (error) throw new Error('Request budget is unavailable');
  return data === true;
}
export class RequestBodyError extends Error {
  constructor(message: string, public status = 400) { super(message); this.name = 'RequestBodyError'; }
}
export async function readBody(req: Request): Promise<Record<string, unknown>> {
  if (Number(req.headers.get('content-length') || 0) > 20000) throw new RequestBodyError('Request is too large', 413);
  const text = await req.text();
  if (text.length > 20000) throw new RequestBodyError('Request is too large', 413);
  let data;
  try { data = JSON.parse(text); } catch { throw new RequestBodyError('Invalid JSON body'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new RequestBodyError('Invalid request body');
  return data;
}
