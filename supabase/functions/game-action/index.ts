import {adminClient,consumeBudget,corsHeaders,json,readBody,requireUser,RequestBodyError,requirePurpose} from '../_shared/security.ts';
import {generateGamePrompts} from '../_shared/gamePrompts.ts';
import {inviteToGame} from '../_shared/gameInvitations.ts';
import {type GameType,needsPrompts} from '../_shared/gameEngine.ts';
Deno.serve(async(req:Request)=>{
 const start=performance.now();const result=await handle(req);result.headers.set('Server-Timing',`game;dur=${(performance.now()-start).toFixed(1)}`);return result;
});
async function handle(req:Request):Promise<Response>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 try{
  const actor=await requireUser(req);if(!actor)return json({error:'Authentication required'},401);
  const body=await readBody(req),db=adminClient();
  if(!['prompts','invite-private'].includes(String(body.kind)))return json({error:'Update Twilight to use encrypted games.',code:'CLIENT_UPDATE_REQUIRED'},426);
  if(typeof body.id!=='string'||!/^[a-f0-9-]{36}$/i.test(body.id))return json({error:'Invalid room'},400);
  const {data:room,error}=await db.from('game_sessions').select('id,game_type,player_x,player_o,couples!inner(partner_1_id,partner_2_id,status)').eq('id',body.id).eq('engine_version',3).single();
  const couple=Array.isArray(room?.couples)?room?.couples[0]:room?.couples;
  if(error||!room||!couple||couple.status!=='active'||![room.player_x,room.player_o].includes(actor))return json({error:'Game unavailable'},403);
  if(body.kind==='invite-private'){
   if(!await consumeBudget(actor,'game-move',100))return json({error:'Please slow down'},429);
   return json({invited:await inviteToGame(db,req,actor,{id:room.id,game_type:room.game_type as GameType},couple)});
  }
  if(room.player_x!==actor||!needsPrompts(room.game_type as GameType)||!['gentle','playful','bold'].includes(String(body.level)))return json({error:'Invalid question request'},400);
  await requirePurpose(actor,'ai',db);
  if(!await consumeBudget(actor,'game-ai',4))return json({error:'Please wait before generating more questions'},429);
  // AI is the explicitly consented external exception. Prompts exist only for
  // this response; clients encrypt them before persistence in an opaque room.
  const prompts=await generateGamePrompts(room.game_type as GameType,body.level as 'gentle'|'playful'|'bold');
  return json({prompts});
 }catch(error){return json({error:error instanceof Error?error.message:'Game unavailable'},error instanceof RequestBodyError?error.status:503);}
}
