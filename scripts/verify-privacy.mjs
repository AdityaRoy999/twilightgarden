// Synthetic production tests only. Never selects real users' health/message data.
import {config} from 'dotenv';import {createClient} from '@supabase/supabase-js';
import {randomUUID,randomBytes} from 'node:crypto';import assert from 'node:assert/strict';import fs from 'node:fs';
config({quiet:true});
const url=process.env.VITE_SUPABASE_URL,anon=process.env.VITE_SUPABASE_ANON_KEY;
assert.equal(new URL(url).hostname,'awijrkxrhlisixufiukw.supabase.co');
const opts={auth:{persistSession:false,autoRefreshToken:false}};
const admin=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY,opts),users=[],clients=[],tokens=[],results=[],uploads=[];let couple;
function check(r){if(r.error)throw Error(r.error.message);return r.data;}
async function prefs(i,more={}){return clients[i].rpc('save_privacy_preferences',{p_age:'18+',p_core:true,p_health:true,p_share:false,p_ai:false,p_shopping:false,...more});}
async function endpoint(i,name,body){const start=performance.now();const response=await fetch(`${url}/functions/v1/${name}`,{method:'POST',headers:{Authorization:`Bearer ${tokens[i]||anon}`,apikey:anon,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});const data=await response.json();return {status:response.status,data,ms:Math.round(performance.now()-start)};}
const pass=(name,extra={})=>{results.push({name,pass:true,...extra});console.log('PASS',name,JSON.stringify(extra));};
try{
 for(let i=0;i<3;i++){
  const email=`twilight-privacy-qa-${randomUUID()}@example.invalid`,password=randomBytes(24).toString('base64url');
  const user=check(await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:'Privacy QA',is_partner:i===1}})).user;
  users.push(user);const client=createClient(url,anon,opts);clients.push(client);tokens.push(check(await client.auth.signInWithPassword({email,password})).session.access_token);
 }
 const log={user_id:users[0].id,date:'2026-10-20',moods:['calm'],symptoms:[]};
 assert.ok((await clients[0].from('daily_logs').insert(log)).error);pass('health writes denied before consent');
 check(await prefs(2,{p_age:'13-17'}));
 const minor=check(await clients[2].from('privacy_preferences').select('*').single());assert.equal(minor.core_consent,false);
 assert.ok((await prefs(2)).error);assert.equal((await endpoint(2,'ai-generate',{mood:'morning'})).status,403);pass('teen sensitive access blocked and age cannot self-upgrade');
 check(await prefs(0));check(await prefs(1));
 check(await clients[1].rpc('choose_initial_account_role',{p_role:'partner'}));
 const deniedAI=await endpoint(0,'ai-generate',{mood:'morning'});assert.equal(deniedAI.status,403,JSON.stringify(deniedAI.data));
 const deniedSearch=await endpoint(0,'ai-generate',{mood:'search',search_query:'mug'});assert.equal(deniedSearch.status,403,JSON.stringify(deniedSearch.data));pass('AI and shopping have independent backend consent gates');
 check(await clients[0].from('daily_logs').insert(log));
 couple=check(await clients[0].from('couples').insert({partner_1_id:users[0].id,partner_1_role:'menstruator',status:'pending',pairing_code:randomBytes(3).toString('hex').toUpperCase()}).select('*').single());
 check(await clients[1].rpc('join_couple',{code_input:couple.pairing_code}));
 const avatar=`${users[0].id}/${randomUUID()}.png`,attachment=`${couple.id}/${randomUUID()}.enc`;
 check(await clients[0].storage.from('avatars').upload(avatar,Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j8ZkAAAAASUVORK5CYII=','base64'),{contentType:'image/png'}));
 uploads.push(['avatars',avatar]);
 check(await clients[0].storage.from('chat-media').upload(attachment,randomBytes(32),{contentType:'application/octet-stream'}));
 uploads.push(['chat-media',attachment]);
 assert.equal(check(await clients[1].from('daily_logs').select('id').eq('user_id',users[0].id)).length,0);pass('linking alone does not disclose health history');
 check(await prefs(0,{p_share:true}));assert.equal(check(await clients[1].from('daily_logs').select('id').eq('user_id',users[0].id)).length,1);
 check(await prefs(0));assert.equal(check(await clients[1].from('daily_logs').select('id').eq('user_id',users[0].id)).length,0);pass('partner grant and immediate withdrawal enforced by RLS');
 const forbidden=await clients[1].from('privacy_preferences').update({ai_consent:true}).eq('user_id',users[0].id);assert.ok(forbidden.error);pass('direct/cross-account consent tampering denied');
 const shared=await clients[0].rpc('get_shared_card',{p_code:'not-a-real-public-health-link'});assert.ok(shared.error);pass('public health bearer links disabled');
 const ticket=check(await clients[0].from('privacy_requests').insert({user_id:users[0].id,kind:'access',description:'Synthetic QA access request; no real personal information.'}).select('id').single());
 assert.equal(check(await clients[1].from('privacy_requests').select('id').eq('id',ticket.id)).length,0);pass('request receipts private to submitter');
 check(await prefs(0,{p_ai:true}));
 check(await prefs(1,{p_ai:true,p_shopping:true}));
 const deniedGuide=await endpoint(1,'ai-generate',{mood:'raw',purpose:'wellness',customPrompt:'Give a general wellness suggestion.'});assert.equal(deniedGuide.status,403,JSON.stringify(deniedGuide.data));
 check(await prefs(0,{p_share:true,p_ai:false}));
 assert.equal((await endpoint(1,'ai-generate',{mood:'raw',purpose:'wellness',customPrompt:'Give a general wellness suggestion.'})).status,403);
 assert.equal((await endpoint(1,'ai-generate',{mood:'search',search_query:'comfort mug'})).status,403);
 pass('caregiver cannot authorize AI/search use of the other member’s health context');
 check(await prefs(0,{p_ai:true}));
 const opened=await endpoint(0,'game-action',{kind:'open',game:'truth_dare',couple:couple.id});assert.equal(opened.status,200,JSON.stringify(opened.data));
 const joined=await endpoint(1,'game-action',{kind:'open',game:'truth_dare',couple:couple.id});assert.equal(joined.status,200,JSON.stringify(joined.data));
 const room=joined.data.session;
 const prefetch=endpoint(0,'game-action',{id:room.id,revision:room.revision,action:{kind:'prefetch'}});
 await new Promise(r=>setTimeout(r,500));
 const ready=await endpoint(1,'game-action',{id:room.id,revision:room.revision,action:{kind:'ready'}});
 assert.equal(ready.status,200,JSON.stringify(ready.data));
 const generated=await prefetch;assert.equal(generated.status,200,JSON.stringify(generated.data));
 assert.ok(generated.data.session.board_state.promptCount>=3);assert.ok(generated.data.session.board_state.ready.includes('O'));
 pass('live AI questions survive a concurrent partner Ready', {ms:generated.ms,prompts:generated.data.session.board_state.promptCount});
 const deletion=await endpoint(0,'privacy-action',{action:'delete-account'});assert.equal(deletion.status,200,JSON.stringify(deletion.data));
 assert.equal((await admin.auth.admin.getUserById(users[0].id)).data?.user,null);
 assert.equal(check(await admin.from('daily_logs').select('id').eq('user_id',users[0].id)).length,0);
 assert.equal(check(await admin.from('couples').select('id').eq('id',couple.id)).length,0);pass('recent-session account deletion removes login, health and connection');
 assert.ok((await admin.storage.from('avatars').download(avatar)).error);assert.ok((await admin.storage.from('chat-media').download(attachment)).error);pass('owned avatar and shared attachment physically removed');
 const revoked=await endpoint(0,'game-action',{kind:'open',game:'tictactoe',couple:couple.id});assert.equal(revoked.status,401);pass('already-issued token denied after deletion');
}finally{
 for(const [bucket,path] of uploads)await admin.storage.from(bucket).remove([path]);
 for(const u of users){const {data:relations}=await admin.from('couples').select('id').or(`partner_1_id.eq.${u.id},partner_2_id.eq.${u.id}`);for(const c of relations||[])await admin.rpc('unlink_relationship',{p_actor:u.id,p_couple:c.id});await admin.from('privacy_requests').delete().eq('user_id',u.id);await admin.from('profiles').delete().eq('id',u.id);await admin.auth.admin.deleteUser(u.id);}
 fs.mkdirSync('tmp/verification',{recursive:true});fs.writeFileSync('tmp/verification/privacy-live.json',JSON.stringify({timestamp:new Date().toISOString(),results},null,2));
}
