import {retryAccountDeletions} from '../_shared/accountDeletion.ts';
import { adminClient, corsHeaders, isInternal, json } from '../_shared/security.ts';
import {retryChatCleanup} from '../_shared/chatCleanup.ts';

Deno.serve(async (req: Request) => {
  if (req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders});
  if (req.method!=='POST') return json({error:'Method not allowed'},405);
  if (!await isInternal(req)) return json({error:'Internal authentication required'},401);
  const db=adminClient();
  try {
    await retryAccountDeletions(db);
    await retryChatCleanup(db);
    // Health dates and preferences are E2EE. Scheduling happens on the owner's
    // device; the service must never decrypt or infer a personal period reminder.
    return json({success:true,healthReminders:'device-only',accepted:0});
  }catch(error){console.error('Reminder job failed',error instanceof Error?error.name:'UnknownError');return json({error:'Reminder processing failed'},500);}
});
