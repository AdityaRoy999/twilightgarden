import {adminClient} from './security.ts';
import {cleanChatMedia} from './chatCleanup.ts';

export async function deleteAccountData(actor:string,db=adminClient()) {
 const {data:couples,error:failure}=await db.from('couples').select('id').or(`partner_1_id.eq.${actor},partner_2_id.eq.${actor}`);
 if(failure)throw failure;
 for(const couple of couples||[]){
  const {error}=await db.rpc('unlink_relationship',{p_actor:actor,p_couple:couple.id});if(error)throw error;
  await cleanChatMedia(couple.id,db);
 }
 // Use Storage API for physical deletion, not SQL DELETE on storage.objects.
 for(let page=0;page<100;page++){
  const {data:objects,error}=await db.rpc('account_storage_objects',{p_actor:actor});if(error)throw error;
  if(!objects?.length)break;
  for(const bucket of [...new Set<string>(objects.map((o:{bucket_id:string})=>o.bucket_id))]){
   const {error:removeError}=await db.storage.from(bucket).remove(objects.filter((o:{bucket_id:string})=>o.bucket_id===bucket).map((o:{name:string})=>o.name));
   if(removeError)throw removeError;
  }
  if(page===99)throw new Error('More deletion work remains');
 }
 const {error:cleanError}=await db.rpc('delete_owned_account_rows',{p_actor:actor});if(cleanError)throw cleanError;
 const {error:authError}=await db.auth.admin.deleteUser(actor);
 if(authError && authError.status!==404)throw authError;
 const {error:finishError}=await db.rpc('complete_account_deletion',{p_actor:actor});if(finishError)throw finishError;
}
export async function retryAccountDeletions(db=adminClient()){
 const {data,error}=await db.rpc('pending_account_deletions');if(error)throw error;
 for(const row of data||[])try{await deleteAccountData(row.user_id,db);}catch{console.error('Account deletion queued for retry');}
}
