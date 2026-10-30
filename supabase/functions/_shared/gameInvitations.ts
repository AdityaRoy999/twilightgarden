import { adminClient } from './security.ts';
import { games, type GameType } from './gameEngine.ts';

/** Stable ID makes automatic open/reconnect/manual invite one durable event. */
export async function gameInvitationId(room: string, actor: string) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${room}:${actor}:invite`)));
  const hex = Array.from(digest.slice(0,16),x=>x.toString(16).padStart(2,'0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
export async function inviteToGame(db: ReturnType<typeof adminClient>, req: Request, actor: string, room: {id:string;game_type:GameType}, couple: {partner_1_id:string;partner_2_id:string|null}) {
  const recipient = actor === couple.partner_1_id ? couple.partner_2_id : couple.partner_1_id;
  if (!recipient || recipient === actor) return false;
  const {data:permissions,error:privacyError}=await db.rpc('privacy_permissions',{p_actor:recipient});
  if(privacyError)throw new Error('Recipient preferences unavailable');
  if(!permissions?.core)return false;
  const id = await gameInvitationId(room.id,actor);
  const url = `/games/${games[room.game_type][1]}`;
  const {data,error} = await db.from('notifications').upsert({id,user_id:recipient,type:'game',message:`Your partner invited you to ${games[room.game_type][0]}.`,is_read:false,data:{url,gameName:games[room.game_type][0],roomId:room.id}},{onConflict:'id',ignoreDuplicates:true}).select('id').maybeSingle();
  if (error) throw new Error('Invitation could not be saved');
  if (data) {
    const delivery = fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/push-notifications`,{method:'POST',headers:{Authorization:req.headers.get('Authorization')!,'Content-Type':'application/json',apikey:Deno.env.get('SUPABASE_ANON_KEY')!},body:JSON.stringify({userId:recipient,url}),signal:AbortSignal.timeout(3000)}).then(response=>response.body?.cancel()).catch(()=>{});
    // Push is best-effort; persisting the in-app invitation above is awaited.
    const runtime = (globalThis as unknown as {EdgeRuntime?:{waitUntil:(task:Promise<unknown>)=>void}}).EdgeRuntime;
    if (runtime) runtime.waitUntil(delivery); else await delivery;
  }
  return true;
}
