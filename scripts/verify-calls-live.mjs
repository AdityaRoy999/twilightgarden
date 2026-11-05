// Isolated call-backend smoke test. Never contacts an existing user or prints credentials.
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
config({ quiet: true });
const url = process.env.VITE_SUPABASE_URL;
assert.equal(new URL(url).hostname, 'awijrkxrhlisixufiukw.supabase.co');
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, options);
const clients = [], users = [], channels = [];
let couple;
function checked(result) { if (result.error) throw Error(result.error.message); return result.data; }
try {
  for (let index = 0; index < 3; index++) {
    const email = `twilight-call-check-${randomUUID()}@example.invalid`, password = randomBytes(32).toString('base64url');
    const user = checked(await admin.auth.admin.createUser({ email, password, email_confirm: true })).user;
    users.push(user.id);
    const client = createClient(url, process.env.VITE_SUPABASE_ANON_KEY, options);
    checked(await client.auth.signInWithPassword({ email, password })); clients.push(client);
    checked(await client.rpc('save_privacy_preferences', { p_age: '18+', p_core: true, p_health: false, p_share: false, p_ai: false, p_shopping: false }));
  }
  couple = checked(await admin.from('couples').insert({ partner_1_id: users[0], partner_2_id: users[1], partner_1_role: 'menstruator', pairing_code: randomBytes(3).toString('hex').toUpperCase(), status: 'active' }).select('id').single()).id;
  for (const client of clients.slice(0, 2)) {
    const start = performance.now();
    const ice = checked(await client.functions.invoke('call-credentials', { body: { coupleId: couple }, timeout: 15000 }));
    assert.ok(ice.expiresAt > Date.now());
    assert.ok(ice.iceServers.some(server => (Array.isArray(server.urls) ? server.urls : [server.urls]).some(value => /^turns?:/.test(value)) && server.username && server.credential));
    console.log(`PASS linked partner receives fresh TURN credentials (${Math.round(performance.now() - start)} ms)`);
  }
  const outsider = await clients[2].functions.invoke('call-credentials', { body: { coupleId: couple } });
  assert.equal(outsider.error?.context?.status, 403);
  const anonymous = createClient(url, process.env.VITE_SUPABASE_ANON_KEY, options);
  assert.equal((await anonymous.functions.invoke('call-credentials', { body: { coupleId: couple } })).error?.context?.status, 401);
  console.log('PASS unrelated and anonymous callers denied relay credentials');
  checked(await clients[0].rpc('save_privacy_preferences', { p_age: '18+', p_core: false, p_health: false, p_share: false, p_ai: false, p_shopping: false }));
  const noConsent = await clients[0].functions.invoke('call-credentials', { body: { coupleId: couple } });
  assert.equal(noConsent.error?.context?.status, 403, 'Consent denial must not be mislabeled as an authentication outage');
  checked(await clients[0].rpc('save_privacy_preferences', { p_age: '18+', p_core: true, p_health: false, p_share: false, p_ai: false, p_shopping: false }));
  console.log('PASS withdrawn calling consent returns 403 rather than a temporary outage');
  const join = client => new Promise(resolve => {
    const channel = client.channel(`call:${couple}`, { config: { private: true } }); channels.push([client, channel]);
    const timer = setTimeout(() => resolve('TIMED_OUT'), 10000);
    channel.subscribe(state => { if (['SUBSCRIBED', 'CHANNEL_ERROR', 'TIMED_OUT'].includes(state)) { clearTimeout(timer); resolve(state); } });
  });
  const states = await Promise.all(clients.map(join));
  assert.equal(states[0], 'SUBSCRIBED'); assert.equal(states[1], 'SUBSCRIBED'); assert.notEqual(states[2], 'SUBSCRIBED');
  console.log('PASS private call signaling admits both partners and rejects outsiders');
} finally {
  await Promise.allSettled(channels.map(([client, channel]) => client.removeChannel(channel)));
  await Promise.allSettled(clients.map(client => client.auth.signOut()));
  if (couple) checked(await admin.from('couples').delete().eq('id', couple));
  for (const id of users) { checked(await admin.from('profiles').delete().eq('id', id)); checked(await admin.auth.admin.deleteUser(id)); }
  console.log('Removed only the synthetic call-check accounts and relationship.');
}
