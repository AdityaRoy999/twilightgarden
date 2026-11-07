// Runs only against disposable accounts; never reads real users' content.
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {config} from 'dotenv';
import {chromium,expect,type Browser,type BrowserContext} from '@playwright/test';
import {createClient,type SupabaseClient} from '@supabase/supabase-js';
config({quiet:true});
const url=process.env.VITE_SUPABASE_URL!;
assert.equal(new URL(url).hostname,'awijrkxrhlisixufiukw.supabase.co');
const options={auth:{persistSession:false,autoRefreshToken:false}};
const admin=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY!,options);
const people:Array<{id:string;client:SupabaseClient}>=[];
const contexts:BrowserContext[]=[];
let coupleId:string|undefined,browser:Browser|undefined;
const checked=(result:any)=>{if(result.error) throw new Error(result.error.message);return result.data;};
try {
  for(let i=0;i<2;i++) {
    const email=`twilight-media-${randomUUID()}@example.invalid`,password=randomBytes(32).toString('base64url');
    const user=checked(await admin.auth.admin.createUser({email,password,email_confirm:true})).user;
    const client=createClient(url,process.env.VITE_SUPABASE_ANON_KEY!,options);people.push({id:user.id,client});
    checked(await client.auth.signInWithPassword({email,password}));
    checked(await client.rpc('save_privacy_preferences',{p_age:'18+',p_core:true,p_health:false,p_share:false,p_ai:false,p_shopping:false}));
  }
  coupleId=checked(await admin.from('couples').insert({partner_1_id:people[0].id,partner_2_id:people[1].id,partner_1_role:'menstruator',pairing_code:randomBytes(3).toString('hex').toUpperCase(),status:'active'}).select('id').single()).id;
  const capability=checked(await people[0].client.functions.invoke('call-room',{body:{action:'capabilities',coupleId}}));
  assert.equal(capability.configured,true,'LiveKit secrets are not configured on this project.');
  console.log('PASS authenticated endpoint recognizes the LiveKit configuration.');
  assert.equal(checked(await admin.rpc('consume_request_budget',{p_user_id:people[0].id,p_action:'call-room',p_limit:30})),true,'Media-room budget must admit valid joins.');
  assert.equal(checked(await admin.rpc('consume_request_budget',{p_user_id:people[0].id,p_action:'unknown-call-action',p_limit:30})),false,'Unknown budget actions must remain blocked.');
  assert.equal(checked(await admin.rpc('consume_request_budget',{p_user_id:people[0].id,p_action:'call-room',p_limit:0})),false,'Invalid budget limits must remain blocked.');
  const callId=randomUUID(),key=randomBytes(32).toString('base64');
  const credentials=await Promise.all(people.map(async person=>checked(await person.client.functions.invoke('call-room',{body:{coupleId,callId}}))));
  assert.equal(new URL(credentials[0].url).protocol,'wss:');
  browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required']});
  const pages=[];
  for(const item of credentials) {
    const context=await browser.newContext({permissions:['camera','microphone']});contexts.push(context);
    // Only short-lived membership tokens enter these isolated browser contexts.
    await context.addInitScript(value=>{(window as any).__twilightCloudMedia=value;},{url:item.url,token:item.token,key});
    const page=await context.newPage();await page.goto('http://127.0.0.1:3000/tests/browser/sfu.html?cloud=1');pages.push(page);
  }
  await pages[0].getByRole('button',{name:'Join',exact:true}).click();
  await expect(pages[0].locator('#status')).toHaveText('Connected',{timeout:45000});
  await pages[1].getByRole('button',{name:'Join',exact:true}).click();
  for(const page of pages) {
    await expect(page.locator('#status')).toHaveText('Partner connected',{timeout:45000});
    await expect.poll(()=>page.locator('video').evaluate((video:HTMLVideoElement)=>video.getVideoPlaybackQuality().totalVideoFrames),{timeout:30000}).toBeGreaterThan(5);
    await expect.poll(()=>page.evaluate(()=>(window as any).decodedAudio()),{timeout:15000}).toBeGreaterThan(.000001);
  }
  console.log('PASS two real browser clients decoded encrypted video and audio through the configured cloud server.');
  await pages[1].getByRole('button',{name:'Leave',exact:true}).click();await expect(pages[1].locator('#status')).toHaveText('Ended');
  console.log('PASS media disconnect.');
} finally {
  for(const context of contexts) await context.close();await browser?.close();
  if(coupleId) checked(await admin.from('couples').delete().eq('id',coupleId));
  for(const person of people) {await person.client.auth.signOut();checked(await admin.from('profiles').delete().eq('id',person.id));checked(await admin.auth.admin.deleteUser(person.id));}
  console.log('Removed synthetic media accounts and relationship.');
}
