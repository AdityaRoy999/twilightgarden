// Uses only short-lived synthetic accounts. Does not read real users' content.
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { config } from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createBundle, backupBundle } from '../lib/vaultCrypto';
import { configurePrivateData, preparePrivateRecord, savePrivateBatch, readPrivateRows } from '../lib/privateData';
import { installVault } from '../lib/vaultRuntime';
config({quiet:true});
const url = process.env.VITE_SUPABASE_URL!;
assert.equal(new URL(url).hostname,'awijrkxrhlisixufiukw.supabase.co');
const options = {auth:{persistSession:false,autoRefreshToken:false}};
const admin = createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY!,options);
const people: Array<{id:string;client:SupabaseClient}> = [];
let coupleId: string | undefined;
const checked = (result: any) => { if (result.error) throw new Error(result.error.message); return result.data; };
try {
  for (let i=0;i<2;i++) {
    const email = `twilight-history-${randomUUID()}@example.invalid`, password=randomBytes(32).toString('base64url');
    const user=checked(await admin.auth.admin.createUser({email,password,email_confirm:true})).user;
    const client=createClient(url,process.env.VITE_SUPABASE_ANON_KEY!,options); people.push({id:user.id,client});
    checked(await client.auth.signInWithPassword({email,password}));
    checked(await client.rpc('save_privacy_preferences',{p_age:'18+',p_core:true,p_health:false,p_share:false,p_ai:false,p_shopping:false}));
  }
  const owner=people[0],other=people[1];
  coupleId=checked(await admin.from('couples').insert({partner_1_id:owner.id,partner_2_id:other.id,partner_1_role:'menstruator',pairing_code:randomBytes(3).toString('hex').toUpperCase(),status:'active'}).select('id').single()).id;
  const bundle=await createBundle(owner.id,randomUUID()), backup=await backupBundle(bundle,randomBytes(32).toString('base64url'));
  checked(await owner.client.from('account_vaults').insert({user_id:owner.id,epoch:bundle.epoch,public_key:bundle.publicKey,backup}));
  installVault(bundle); configurePrivateData(owner.client);
  const content={id:randomUUID(),coupleId,direction:'outgoing',video:true,startedAt:new Date().toISOString(),endedAt:new Date().toISOString(),outcome:'answered',durationSeconds:25};
  const record=await preparePrivateRecord('call_history',content.id,content,null); record.couple_id=coupleId!;
  await savePrivateBatch([record]);
  const raw=checked(await owner.client.from('private_records').select('*').eq('id',record.id).single());
  assert.equal(raw.recipient_key,null); assert.ok(!JSON.stringify(raw.ciphertext).includes('outgoing'));
  assert.deepEqual((await readPrivateRows(owner.id,'call_history'))[0],content);
  assert.equal(checked(await other.client.from('private_records').select('id').eq('id',record.id)).length,0);
  assert.ok((await other.client.rpc('save_private_records',{p_records:[record]})).error);
  const prefs=await preparePrivateRecord('chat_settings',coupleId!,{coupleId,theme:'mint',muted:false},null); prefs.couple_id=coupleId!; await savePrivateBatch([prefs]);
  console.log('PASS owner decrypts call history; partner cannot read or overwrite it; encrypted theme saves.');
  const configured = checked(await owner.client.functions.invoke('call-room',{body:{action:'capabilities',coupleId}})).configured;
  assert.equal(typeof configured,'boolean');
  if (process.env.EXPECT_LIVEKIT_CONFIGURED) assert.equal(configured,process.env.EXPECT_LIVEKIT_CONFIGURED === 'true');
  console.log(`LiveKit configured: ${configured}`);
  assert.equal((await other.client.functions.invoke('call-room',{body:{action:'capabilities',coupleId:randomUUID()}})).error?.context?.status,403);
  const anon=createClient(url,process.env.VITE_SUPABASE_ANON_KEY!,options);
  assert.equal((await anon.functions.invoke('call-room',{body:{action:'capabilities',coupleId}})).error?.context?.status,401);
  console.log('PASS media capability endpoint checks account, consent and active relationship.');
  checked(await admin.from('couples').update({status:'disconnected'}).eq('id',coupleId));
  assert.equal(checked(await admin.from('private_records').select('id').in('id',[record.id,prefs.id])).length,0);
  assert.equal(checked(await admin.from('couples').select('status').eq('id',coupleId).single()).status,'disconnected');
  console.log('PASS unlink removes both call history and chat settings without cancelling the relationship update.');
} finally {
  installVault(null);
  if (coupleId) checked(await admin.from('couples').delete().eq('id',coupleId));
  for (const person of people) { await person.client.auth.signOut(); checked(await admin.from('profiles').delete().eq('id',person.id)); checked(await admin.auth.admin.deleteUser(person.id)); }
  console.log('Removed synthetic verification accounts.');
}
