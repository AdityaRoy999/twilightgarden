import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.98.0';
import {verifiedUser} from './authRetry.ts';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-twilight-webhook',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control':'no-store' } });
}
export function adminClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function requireUser(req: Request, purpose: 'core' | 'ai' | 'shopping' | null = 'core'): Promise<string | null> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
  const actor = await verifiedUser(()=>client.auth.getUser(token));
  if (!actor) return null;
  let sessionId: string;
  try { sessionId=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).session_id; } catch { return null; }
  if (!sessionId || !/^[a-f0-9-]{36}$/i.test(sessionId)) return null;
  const db=adminClient();
  const {data:active,error:sessionError}=await db.rpc('session_is_active',{p_actor:actor,p_session:sessionId});
  if(sessionError) throw new Error('Session verification unavailable');
  if(!active) return null;
  if(purpose) await requirePurpose(actor,purpose,db);
  return actor;
}
export async function requirePurpose(actor:string,purpose:'core'|'ai'|'shopping',db=adminClient()) {
  const {data,error}=await db.rpc('privacy_permissions',{p_actor:actor});
  if(error) throw new Error('Privacy preferences unavailable');
  if(!data?.[purpose]) throw new RequestBodyError('Review your privacy choices in Account → Privacy before using this feature.',403);
}
/** A caregiver's choice cannot authorize sending the other member's health
 * context to an AI/search provider. Check the data owner's choices separately. */
export async function requireHealthPurpose(actor:string,purpose:'ai'|'shopping',db=adminClient()){
 const {data:profile,error:profileError}=await db.from('profiles').select('role').eq('id',actor).single();
 if(profileError)throw new Error('Privacy preferences unavailable');
 if(profile.role!=='partner'){
  if(purpose==='ai') {const {data,error}=await db.rpc('privacy_permissions',{p_actor:actor});if(error)throw error;if(!data?.health)throw new RequestBodyError('Health consent is required for a personalized guide.',403);}
  return;
 }
 const {data:couple,error:coupleError}=await db.from('couples').select('partner_1_id,partner_2_id,share_enabled').eq('status','active').or(`partner_1_id.eq.${actor},partner_2_id.eq.${actor}`).maybeSingle();
 if(coupleError)throw coupleError;
 if(!couple?.share_enabled)throw new RequestBodyError('Your partner must choose health sharing before personalized suggestions can be generated.',403);
 const owner=couple.partner_1_id===actor?couple.partner_2_id:couple.partner_1_id;
 const {data:preferences,error}=await db.from('privacy_preferences').select('age_band,core_consent,health_consent,share_health,ai_consent,shopping_consent,deleting,notice_version').eq('user_id',owner).maybeSingle();
 if(error)throw error;
 if(!preferences||preferences.age_band!=='18+'||!preferences.core_consent||!preferences.health_consent||!preferences.share_health||preferences.deleting||preferences.notice_version!=='2026-10-30'||!(purpose==='ai'?preferences.ai_consent:preferences.shopping_consent))throw new RequestBodyError('Your partner has not permitted this use of their health context. They can review it in Privacy & safety.',403);
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
