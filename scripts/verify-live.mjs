// Creates isolated synthetic accounts; never targets or prints existing user data.
// Run explicitly: node scripts/verify-live.mjs (requires local server-only admin key).
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { randomUUID, randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
config({ quiet: true });
const url = 'https://awijrkxrhlisixufiukw.supabase.co';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
if (!key || !anonKey) throw Error('Local Supabase credentials are required.');
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, key, options);
const anonymous = createClient(url, anonKey, options);
const accounts = [], clients = [], objects = [];
let coupleId;
const pass = name => console.log('PASS ' + name);
function check(result) { if (result.error) throw Error(result.error.message); return result.data; }
try {
  for (const role of ['admin', 'partner', 'user']) {
    const email = `twilight-qa-${randomUUID()}@example.invalid`;
    const password = randomBytes(32).toString('base64url');
    const user = check(await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { role, full_name: 'Temporary QA account' } })).user;
    accounts.push(user.id);
    const client = createClient(url, anonKey, options);
    check(await client.auth.signInWithPassword({ email, password }));
    clients.push(client);
  }
  const [a,b,c] = clients, [aid,bid,cid] = accounts;
  assert.equal(check(await a.from('profiles').select('role').eq('id',aid).single()).role,'user');
  assert.ok((await a.from('profiles').update({role:'admin'}).eq('id',aid)).error);
  pass('Signup metadata and profile updates cannot grant administrator access');
  check(await a.from('user_settings').upsert({user_id:aid,last_period_start:'2026-10-01',avg_cycle_length:28,avg_period_length:5,onboarding_completed:true}));
  check(await a.from('daily_logs').upsert({user_id:aid,date:'2026-10-25',notes:'Synthetic regression record',sleep_hours:0},{onConflict:'user_id,date'}));
  assert.equal(check(await a.from('daily_logs').select('sleep_hours').eq('user_id',aid).eq('date','2026-10-25').single()).sleep_hours,0);
  assert.equal(check(await c.from('daily_logs').select('id').eq('user_id',aid)).length,0);
  assert.ok((await c.from('daily_logs').insert({user_id:aid,date:'2026-10-24'})).error);
  pass('Log persistence, zero-valued fields and account isolation');
  assert.ok((await c.from('user_fcm_tokens').insert({user_id:aid,token:'synthetic-qa-token',device_type:'web'})).error);
  assert.equal(check(await c.from('user_fcm_tokens').select('id').eq('user_id',aid)).length,0);
  assert.ok((await c.from('notifications').insert({user_id:aid,type:'chat',message:'Synthetic unauthorized request'})).error);
  pass('Token ownership and notification recipient restrictions');
  const pairing = randomBytes(3).toString('hex').toUpperCase();
  const couple = check(await a.from('couples').insert({partner_1_id:aid,partner_1_role:'menstruator',pairing_code:pairing,status:'pending'}).select().single());
  coupleId = couple.id;
  assert.equal(check(await c.from('couples').select('id').eq('id',coupleId)).length,0);
  assert.equal(check(await c.from('couples').update({partner_2_id:cid,status:'active'}).eq('id',coupleId).select('id')).length,0);
  assert.ok((await c.rpc('join_couple',{code_input:pairing})).error);
  const joined = check(await b.rpc('join_couple',{code_input:pairing}));
  assert.equal(joined.partner_2_id,bid);
  check(await a.from('couples').update({share_enabled:true}).eq('id',coupleId));
  assert.equal(check(await b.from('daily_logs').select('id').eq('user_id',aid)).length,1);
  check(await a.from('couples').update({share_enabled:false}).eq('id',coupleId));
  assert.equal(check(await b.from('daily_logs').select('id').eq('user_id',aid)).length,0);
  assert.ok((await b.from('couples').update({share_enabled:true}).eq('id',coupleId)).error);
  pass('Pairing RPC, role compatibility and sharing/ghost mode');
  const path = `${coupleId}/qa-${randomUUID()}.enc`;
  check(await a.storage.from('chat-media').upload(path,new Uint8Array([1,2,3]),{contentType:'application/octet-stream'})); objects.push(['chat-media',path]);
  const signed = check(await b.storage.from('chat-media').createSignedUrl(path,30));
  assert.equal((await fetch(signed.signedUrl)).status,200);
  assert.ok((await c.storage.from('chat-media').createSignedUrl(path,30)).error);
  assert.ok((await a.storage.from('avatars').upload(`${cid}/qa-${randomUUID()}.png`,new Uint8Array([1]),{contentType:'image/png'})).error);
  pass('Private attachment access and avatar folder ownership');
  const shareCode = randomUUID().replaceAll('-','');
  check(await a.from('shared_cards').upsert({user_id:aid,share_code:shareCode,card_data:{synthetic:true},expires_at:new Date(Date.now()+60000).toISOString()},{onConflict:'user_id'}));
  assert.equal(check(await anonymous.from('shared_cards').select('id')).length,0);
  assert.deepEqual(check(await anonymous.rpc('get_shared_card',{p_code:shareCode})),{synthetic:true});
  check(await a.from('shared_cards').update({expires_at:new Date(Date.now()-60000).toISOString()}).eq('user_id',aid));
  assert.equal(check(await anonymous.rpc('get_shared_card',{p_code:shareCode})),null);
  pass('Share links are non-enumerable and enforce expiration');
  for(const slug of ['ai-generate','push-notifications','push-notifications-','check-reminders','check-remainders','health-check']){
    const response=await fetch(`${url}/functions/v1/${slug}`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
    assert.equal(response.status,401,slug);
  }
  pass('All privileged Edge Function entrypoints reject anonymous requests');
  const channels=[];
  const join=client=>new Promise(resolve=>{
    const channel=client.channel(`call:${coupleId}`,{config:{private:true}});channels.push([client,channel]);
    const timer=setTimeout(()=>resolve('TIMED_OUT'),8000);
    channel.subscribe(status=>{if(['SUBSCRIBED','CHANNEL_ERROR','TIMED_OUT'].includes(status)){clearTimeout(timer);resolve(status);}});
  });
  const states=await Promise.all([join(a),join(b),join(c)]);
  await Promise.all(channels.map(([client,channel])=>client.removeChannel(channel)));
  assert.equal(states[0],'SUBSCRIBED');assert.equal(states[1],'SUBSCRIBED');assert.notEqual(states[2],'SUBSCRIBED');
  pass('Private call channels admit partners and reject unrelated users');
} finally {
  for(const [bucket,path] of objects) check(await admin.storage.from(bucket).remove([path]));
  if(coupleId) check(await admin.from('couples').delete().eq('id',coupleId));
  for(const id of accounts) {
    check(await admin.from('profiles').delete().eq('id',id));
    check(await admin.auth.admin.deleteUser(id));
  }
  for(const client of clients) await client.removeAllChannels();
  console.log('Temporary accounts and test objects removed.');
}
