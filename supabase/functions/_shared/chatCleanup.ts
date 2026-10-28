import {adminClient} from './security.ts';

/** Use Storage's API: deleting storage.objects rows alone leaves physical files. */
export async function cleanChatMedia(coupleId:string,db=adminClient()) {
  const bucket=db.storage.from('chat-media');
  const removeFolder=async(prefix:string):Promise<void>=>{
    // Remove each batch before fetching the first page again (no shifted offsets).
    for(let batch=0;batch<100;batch++) {
      const {data,error}=await bucket.list(prefix,{limit:100,sortBy:{column:'name',order:'asc'}});
      if(error)throw error;
      if(!data?.length)return;
      const objects:string[]=[];
      for(const item of data) {
        const path=prefix+'/'+item.name;
        if(item.id)objects.push(path);else await removeFolder(path);
      }
      if(objects.length){const {error}=await bucket.remove(objects);if(error)throw error;}
    }
    throw new Error('Media cleanup needs another pass');
  };
  await removeFolder(coupleId);
  const {error}=await db.from('chat_cleanup_jobs').update({cleaned_at:new Date().toISOString()}).eq('couple_id',coupleId);
  if(error)throw error;
}

export async function retryChatCleanup(db=adminClient()) {
  // Recheck recent completed jobs too, covering an upload already in flight at unlink.
  const since=new Date(Date.now()-86400000).toISOString();
  const {data,error}=await db.from('chat_cleanup_jobs').select('couple_id').or(`cleaned_at.is.null,requested_at.gt.${since}`).order('cleaned_at',{ascending:true,nullsFirst:true}).limit(25);
  if(error)throw error;
  for(const job of data||[])try{await cleanChatMedia(job.couple_id,db);}catch{console.error('Chat media cleanup will retry',job.couple_id);}
}
