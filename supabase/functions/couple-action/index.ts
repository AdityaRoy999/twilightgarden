import {adminClient,consumeBudget,corsHeaders,json,readBody,requireUser,RequestBodyError} from '../_shared/security.ts';
import {cleanChatMedia} from '../_shared/chatCleanup.ts';

Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 try {
  const actor=await requireUser(req,null);if(!actor)return json({error:'Authentication required'},401);
  const body=await readBody(req);
  if(body.action!=='unlink'||typeof body.coupleId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.coupleId))return json({error:'Invalid connection request'},400);
  if(!await consumeBudget(actor,'unlink',12))return json({error:'Please wait before retrying.'},429);
  const db=adminClient();
  const {error}=await db.rpc('unlink_relationship',{p_couple:body.coupleId,p_actor:actor});
  if(error)return json({error:'Connection unavailable'},error.code==='42501'?403:500);
  try {await cleanChatMedia(body.coupleId,db);return json({unlinked:true,mediaDeleted:true});}
  catch {return json({unlinked:true,mediaDeleted:false,message:'Connection removed. Attachment cleanup will retry automatically.'},202);}
 }catch(error){return json({error:error instanceof RequestBodyError?error.message:'Unable to unlink. Please retry.'},error instanceof RequestBodyError?error.status:503);}
});
