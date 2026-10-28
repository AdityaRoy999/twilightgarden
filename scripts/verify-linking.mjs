// Uses only disposable QA identities. Never targets an existing connection.
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {config} from 'dotenv';
import {createClient} from '@supabase/supabase-js';
config({quiet:true});
const url=process.env.VITE_SUPABASE_URL,anon=process.env.VITE_SUPABASE_ANON_KEY;
assert.equal(new URL(url).hostname,'awijrkxrhlisixufiukw.supabase.co');
const options={auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(url,init)=>fetch(url,{...init,signal:AbortSignal.timeout(30000)})}};
const db=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY,options),users=[],clients=[],tokens=[],relationships=[],channels=[],uploaded=[];
let checks=0;
const checked=r=>{if(r.error)throw new Error(r.error.message);return r.data;};
const pass=label=>{checks++;console.log('PASS',label);};
async function endpoint(index,body,status=200){const r=await fetch(url+'/functions/v1/couple-action',{method:'POST',headers:{apikey:anon,Authorization:'Bearer '+tokens[index],'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});const data=await r.json();assert.equal(r.status,status,JSON.stringify(data));return data;}
try{
 for(const role of ['user','partner','user']){
  const password=randomBytes(32).toString('hex'),email='twilight-link-qa-'+randomUUID()+'@example.invalid';
  const {user}=checked(await db.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:'Link QA',is_partner:role==='partner'}}));users.push(user);
  const client=createClient(url,anon,options);clients.push(client);tokens.push(checked(await client.auth.signInWithPassword({email,password})).session.access_token);
 }
 const pending=checked(await clients[0].rpc('generate_pairing_code'));relationships.push(pending.id);
 assert.equal(checked(await clients[0].rpc('generate_pairing_code')).id,pending.id);pass('Generate reuses an unexpired code');
 const own=checked(await clients[1].rpc('generate_pairing_code'));relationships.push(own.id);
 assert.ok((await clients[1].rpc('join_couple',{code_input:'XXXXXX'})).error);
 assert.equal(checked(await db.from('couples').select('id').eq('id',own.id).single()).id,own.id);pass('Invalid code preserves the existing pending connection');
 assert.ok((await clients[0].rpc('join_couple',{code_input:pending.pairing_code})).error);pass('Cannot join your own code');
 assert.ok((await clients[2].rpc('join_couple',{code_input:pending.pairing_code})).error);pass('Same-role pairing rejected');
 const couple=checked(await clients[1].rpc('join_couple',{code_input:pending.pairing_code.toLowerCase()}));assert.equal(couple.id,pending.id);assert.equal(couple.partner_2_id,users[1].id);pass('Opposite roles link with a normalized code');
 assert.equal(checked(await db.from('couples').select('id').eq('id',own.id)).length,0);pass('Successful join removes the joining account’s pending code');
 assert.ok((await clients[0].rpc('generate_pairing_code')).error);pass('Active membership prevents a second connection');
 await endpoint(2,{action:'unlink',coupleId:couple.id,actor:users[0].id},403);pass('Outsider cannot unlink or spoof an actor');
 assert.ok((await clients[0].rpc('unlink_relationship',{p_couple:couple.id,p_actor:users[0].id})).error);pass('Privileged unlink RPC inaccessible to browser roles');
 assert.equal(checked(await clients[0].from('couples').delete().eq('id',couple.id).select()).length,0);pass('Direct browser delete cannot bypass cleanup');
 const noteIds=[randomUUID(),randomUUID()];
 checked(await db.from('shared_notes').insert(noteIds.map((id,i)=>({id,couple_id:couple.id,sender_id:users[i].id,content:randomBytes(64).toString('base64'),type:'text'}))));
 const media=[couple.id+'/'+randomUUID()+'.enc',couple.id+'/legacy/'+randomUUID()+'.enc'];
 for(let i=0;i<2;i++){checked(await clients[i].storage.from('chat-media').upload(media[i],randomBytes(80),{contentType:'application/octet-stream'}));uploaded.push(media[i]);}
 const signed=checked(await clients[0].storage.from('chat-media').createSignedUrl(media[0],60)).signedUrl;
 const game=checked(await clients[0].functions.invoke('game-action',{body:{kind:'open',game:'tictactoe',couple:couple.id}}));assert.ok(game.session.id);
 const events=clients.slice(0,2).map((client,i)=>new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('Unlink event missing for member '+i)),15000);
  const channel=client.channel('couple_account_'+users[i].id,{config:{private:true}}).on('broadcast',{event:'relationship:deleted'},({payload})=>{clearTimeout(timer);resolve(payload.couple_id);}).subscribe();channels.push(channel);
 }));
 await Promise.all(channels.map(channel=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>{clearInterval(poll);reject(Error('Account subscription unavailable'));},8000);const poll=setInterval(()=>{if(channel.state==='joined'){clearTimeout(timer);clearInterval(poll);resolve();}},100);})));
 const result=await endpoint(0,{action:'unlink',coupleId:couple.id});assert.equal(result.mediaDeleted,true);pass('Unlink removes the connection and completes media deletion');
 assert.deepEqual(await Promise.all(events),[couple.id,couple.id]);pass('Both members receive unlink events after relationship deletion');
 for(const [table,column,value] of [['couples','id',couple.id],['shared_notes','couple_id',couple.id],['game_sessions','couple_id',couple.id]]){assert.equal(checked(await db.from(table).select('id').eq(column,value)).length,0);pass(table+' deleted for both parties');}
 assert.equal(checked(await db.storage.from('chat-media').list(couple.id)).length,0);assert.equal((await fetch(signed)).ok,false);pass('Both senders’ media and nested legacy media removed; old URL fails');
 assert.equal(checked(await db.from('notifications').select('id').eq('data->>roomId',game.session.id)).length,0);pass('Stale game invitation deleted');
 assert.equal((await endpoint(1,{action:'unlink',coupleId:couple.id})).mediaDeleted,true);pass('Other member can safely retry an already completed unlink');
 await endpoint(2,{action:'unlink',coupleId:couple.id},403);pass('Completed cleanup does not grant outsider access');
 const fresh=checked(await clients[0].rpc('generate_pairing_code'));relationships.push(fresh.id);assert.notEqual(fresh.id,couple.id);
 checked(await clients[1].rpc('join_couple',{code_input:fresh.pairing_code}));assert.equal(checked(await clients[1].from('shared_notes').select('id').eq('couple_id',fresh.id)).length,0);pass('Reconnect creates a fresh conversation without old messages');
 for(const body of [{mood:'places',lat:22.5726,lon:88.3639},{mood:'places',search_query:'Salt Lake, Kolkata'}]){
  const r=await fetch(url+'/functions/v1/ai-generate',{method:'POST',headers:{apikey:anon,Authorization:'Bearer '+tokens[0],'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(35000)});const data=await r.json();assert.equal(r.status,200,JSON.stringify(data));assert.ok(Array.isArray(data.origin));assert.ok(data.places.length>0);pass('Live nearby search returns stores and an origin: '+(body.search_query||'coordinates'));
 }
 console.log('Completed '+checks+' live checks.');
}finally{
 if(uploaded.length)checked(await db.storage.from('chat-media').remove(uploaded));
 for(let i=0;i<channels.length;i++)await clients[Math.min(i,1)].removeChannel(channels[i]);
 for(const id of relationships){checked(await db.from('shared_notes').delete().eq('couple_id',id));checked(await db.from('couples').delete().eq('id',id));checked(await db.from('chat_cleanup_jobs').delete().eq('couple_id',id));}
 for(const user of users){assert.match(user.email,/^twilight-link-qa-[0-9a-f-]+@example\.invalid$/);assert.equal(checked(await db.auth.admin.getUserById(user.id)).user.email,user.email);checked(await db.from('profiles').delete().eq('id',user.id));checked(await db.auth.admin.deleteUser(user.id));}
 console.log('Removed disposable QA accounts and relationship fixtures.');
}
