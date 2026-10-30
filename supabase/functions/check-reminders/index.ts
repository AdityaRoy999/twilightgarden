import {retryAccountDeletions} from '../_shared/accountDeletion.ts';
import { GoogleAuth } from 'npm:google-auth-library@9.4.1';
import { adminClient, corsHeaders, isInternal, json } from '../_shared/security.ts';
import {retryChatCleanup} from '../_shared/chatCleanup.ts';

const SITE='https://twilight-mocha.vercel.app';
Deno.serve(async (req: Request) => {
  if (req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders});
  if (req.method!=='POST') return json({error:'Method not allowed'},405);
  if (!await isInternal(req)) return json({error:'Internal authentication required'},401);
  const db=adminClient();
  try {
    await retryAccountDeletions(db);
    await retryChatCleanup(db);
    const {data:tokens,error:tokensError}=await db.from('user_fcm_tokens').select('id,user_id,token,device_type');
    if(tokensError)throw tokensError;
    const tokenUsers=[...new Set((tokens||[]).map(t=>t.user_id))];
    if(!tokenUsers.length)return json({success:true,accepted:0});
    const {data:consents,error:consentError}=await db.from('privacy_preferences').select('user_id').in('user_id',tokenUsers).eq('age_band','18+').eq('core_consent',true).eq('health_consent',true).eq('deleting',false).eq('notice_version','2026-10-30');
    if(consentError)throw consentError;
    const userIds=(consents||[]).map(p=>p.user_id);
    if(!userIds.length)return json({success:true,accepted:0});
    const {data:settings,error}=await db.from('user_settings').select('user_id,last_period_start,avg_cycle_length,irregular_cycle,notifications_enabled,period_notifications,reminder_notifications,time_zone').in('user_id',userIds);
    if(error)throw error;
    const accountJson=Deno.env.get('FCM_SERVICE_ACCOUNT');
    if(!accountJson)return json({error:'Push delivery is not configured'},503);
    const account=JSON.parse(accountJson);
    let accessToken: string | null | undefined;
    let accepted=0,failed=0;
    for(const setting of settings||[]){
      if(setting.notifications_enabled===false)continue;
      let zone=setting.time_zone||'Asia/Kolkata';
      try{new Intl.DateTimeFormat('en',{timeZone:zone}).format();}catch{zone='Asia/Kolkata';}
      const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
      const part=(name:string)=>parts.find(p=>p.type===name)?.value||'';
      const day=`${part('year')}-${part('month')}-${part('day')}`;
      const hour=Number(part('hour'));
      let kind='',message='',type='reminder';
      if(hour===20&&setting.reminder_notifications!==false){
        const {data:log,error:logError}=await db.from('daily_logs').select('id').eq('user_id',setting.user_id).eq('date',day).maybeSingle();
        if(logError)throw logError;
        if(!log){kind='daily';message='A gentle reminder to log how you felt today.';}
      }
      if(hour===13&&!setting.irregular_cycle&&setting.period_notifications!==false&&setting.last_period_start){
        const expected=Date.parse(setting.last_period_start+'T00:00:00Z')+(setting.avg_cycle_length||28)*86400000;
        const days=Math.round((expected-Date.parse(day+'T00:00:00Z'))/86400000);
        if(days>=1&&days<=3){kind=`period-${days}`;type='period_start';message=`Your next period is estimated in ${days} day${days===1?'':'s'}.`;}
      }
      if(!kind)continue;
      const {data:claimed,error:claimError}=await db.rpc('claim_reminder_delivery',{p_user_id:setting.user_id,p_local_date:day,p_kind:kind});
      if(claimError)throw claimError;
      if(!claimed)continue;
      const {error:saveError}=await db.from('notifications').upsert({user_id:setting.user_id,type,message,dedupe_key:`${day}:${kind}`},{onConflict:'user_id,dedupe_key'});
      if(saveError)throw saveError;
      if(!accessToken){
        const auth=new GoogleAuth({credentials:account,scopes:['https://www.googleapis.com/auth/firebase.messaging']});
        accessToken=(await(await auth.getClient()).getAccessToken()).token;
        if(!accessToken)throw new Error('Push authentication failed');
      }
      let userAccepted=0;
      for(const entry of (tokens||[]).filter(t=>t.user_id===setting.user_id)){
        const payload:Record<string,unknown>={token:entry.token,notification:{title:'Twilight Garden',body:'You have a private reminder. Open the app to view it.'},data:{url:'/dashboard',type}};
        if(entry.device_type==='android')payload.android={priority:'high',notification:{sound:'default',channel_id:'PushNotifications'}};
        else if(entry.device_type==='web')payload.webpush={notification:{icon:SITE+'/twilight.png'},fcm_options:{link:SITE+'/#/dashboard'}};
        try{
          const response=await fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`,{method:'POST',headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},body:JSON.stringify({message:payload}),signal:AbortSignal.timeout(15000)});
          if(response.ok){accepted++;userAccepted++;}else{
            failed++;const error=await response.json();
            if(error?.error?.details?.some((d:{errorCode?:string})=>d.errorCode==='UNREGISTERED'))await db.from('user_fcm_tokens').delete().eq('id',entry.id);
          }
        }catch{failed++;}
      }
      if(userAccepted)await db.rpc('complete_reminder_delivery',{p_user_id:setting.user_id,p_local_date:day,p_kind:kind});
    }
    return json({success:failed===0,accepted,failed},failed>0&&accepted===0?502:200);
  }catch(error){console.error('Reminder job failed',error instanceof Error?error.name:'UnknownError');return json({error:'Reminder processing failed'},500);}
});
