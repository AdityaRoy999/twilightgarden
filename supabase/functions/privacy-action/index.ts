import {adminClient,consumeBudget,corsHeaders,json,readBody,requireUser,RequestBodyError} from '../_shared/security.ts';
import {deleteAccountData} from '../_shared/accountDeletion.ts';
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 try{
  const actor=await requireUser(req,null);if(!actor)return json({error:'Sign in again to manage your data'},401);
  const body=await readBody(req);if(body.action!=='delete-account')return json({error:'Unknown action'},400);
  if(!await consumeBudget(actor,'account-delete',3))return json({error:'Please wait before retrying'},429);
  const token=req.headers.get('authorization')!.replace(/^Bearer\s+/i,'');
  const session=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).session_id;
  const db=adminClient();
  const {error}=await db.rpc('prepare_account_deletion',{p_actor:actor,p_session:session});
  if(error)return json({error:'For your security, sign out and sign in again, then delete within 10 minutes.'},403);
  // Sessions are revoked and all API access is denied before external cleanup.
  try{await deleteAccountData(actor,db);return json({deleted:true});}
  catch{console.error('Account deletion needs a retry');return json({deletionQueued:true,message:'Your account is disabled. Remaining deletion will retry automatically.'},202);}
 }catch(error){return json({error:error instanceof RequestBodyError?error.message:'Unable to manage your account. Please retry.'},error instanceof RequestBodyError?error.status:503);}
});
