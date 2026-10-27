// Live smoke check. Creates two isolated QA accounts and removes only those
// accounts in finally. It never runs reminder jobs or targets real recipients.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, randomBytes, webcrypto } from 'node:crypto';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { parseWellnessGuide, wellnessGuidePrompt } from '../lib/wellnessGuide.ts';
import { loadHealthHistory } from '../lib/healthHistory.ts';
config({ quiet: true });

const origin = process.env.VITE_SUPABASE_URL;
assert.equal(new URL(origin).hostname, 'awijrkxrhlisixufiukw.supabase.co', 'Confirm the intended Twilight backend');
assert.ok(process.env.SUPABASE_SERVICE_ROLE_KEY, 'A server-only service role key is required for QA account cleanup');
const anon = process.env.VITE_SUPABASE_ANON_KEY;
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(origin, process.env.SUPABASE_SERVICE_ROLE_KEY, options);
const users = [], clients = [], tokens = [], keys = [], results = [];
const storedObjects = [];
let coupleId;
const checked = result => { if (result.error) throw new Error(result.error.message); return result.data; };
globalThis.window = { crypto: webcrypto, atob, btoa };
const { generateKeyPair, encryptWithEphemeralKey, decryptWithEphemeralKey } = await import('../lib/encryption.ts');
async function probe(label, pathname, expected, { method = 'GET', token = anon, body } = {}) {
  const start = Date.now();
  try {
    const response = await fetch(new URL(pathname, origin), { method, headers: { apikey: anon, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body, signal: AbortSignal.timeout(30000) });
    const text = await response.text();
    const pass = (Array.isArray(expected) ? expected : [expected]).includes(response.status);
    results.push({ label, status: response.status, pass, ms: Date.now() - start });
    console.log(`${pass ? 'PASS' : 'FAIL'} ${label}: HTTP ${response.status}`);
    try { return JSON.parse(text); } catch { return text; }
  } catch (error) {
    results.push({ label, pass: false, error: error.name });
    console.log(`FAIL ${label}: ${error.name}`);
  }
}
try {
  const functions = ['ai-generate', 'call-credentials', 'push-notifications', 'push-notifications-', 'health-check', 'check-reminders', 'check-remainders'];
  for (const name of functions) {
    const route = `/functions/v1/${name}`;
    await probe(`${name} preflight`, route, 200, { method: 'OPTIONS' });
    await probe(`${name} method guard`, route, 405);
    await probe(`${name} anonymous guard`, route, 401, { method: 'POST', body: '{}' });
  }
  for (const partner of [false, true]) {
    const email = `twilight-api-qa-${randomUUID()}@example.invalid`, password = randomBytes(32).toString('base64url');
    const { user } = checked(await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: 'API QA', is_partner: partner } }));
    users.push({ id: user.id, email });
    const client = createClient(origin, anon, options); clients.push(client);
    tokens.push(checked(await client.auth.signInWithPassword({ email, password })).session.access_token);
    const key = await generateKeyPair(); key.device = randomUUID(); keys.push(key);
    checked(await client.from('user_keys').insert({ user_id: user.id, device_id: key.device, public_key: key.publicKey, device_name: 'Synthetic API QA' }));
  }
  const rpc = (name, params = {}, expected = 200) => probe(`RPC ${name}`, `/rest/v1/rpc/${name}`, expected, { method: 'POST', token: tokens[0], body: JSON.stringify(params) });
  await rpc('ensure_own_profile');
  await rpc('get_data_epoch');
  await rpc('get_chat_public_key', { p_user_id: users[0].id });
  await rpc('get_shared_card', { p_code: randomUUID() });
  await rpc('save_cycle_settings', { p_values: { avg_cycle_length: 28, avg_period_length: 5, last_period_start: '2026-01-01', onboarding_completed: true, irregular_cycle: false }, p_encrypted: null });
  await rpc('save_daily_log', { p_date: '2026-01-01', p_values: { flow: 'light', moods: [], symptoms: [], notes: 'Synthetic QA', energy_level: null, sleep_quality: null, sleep_hours: null }, p_period_start: true, p_encrypted: null });
  const code = randomBytes(3).toString('hex').toUpperCase();
  coupleId = checked(await clients[0].from('couples').insert({ partner_1_id: users[0].id, partner_1_role: 'menstruator', status: 'pending', pairing_code: code }).select('id').single()).id;
  checked(await clients[1].rpc('join_couple', { code_input: code }));
  checked(await clients[0].from('couples').update({ love_code: code }).eq('id', coupleId));
  checked(await clients[1].rpc('join_couple_love_lock', { code_input: code }));
  // More than 90 records must be visible to the explicitly linked partner.
  const historyRows = Array.from({length:125},(_,index)=>({user_id:users[0].id,date:new Date(Date.UTC(2025,0,1+index)).toISOString().slice(0,10),moods:[],symptoms:[],notes:'Synthetic shared-history QA'}));
  checked(await clients[0].from('daily_logs').insert(historyRows));
  const ownHistory = await loadHealthHistory(clients[0],users[0].id);
  const sharedHistory = await loadHealthHistory(clients[1],users[0].id);
  assert.equal(ownHistory.length,126);
  assert.deepEqual(sharedHistory.map(row=>row.date),ownHistory.map(row=>row.date));
  results.push({label:'full shared health history matches owner beyond 90 logs',pass:true});
  checked(await clients[0].from('couples').update({share_enabled:false}).eq('id',coupleId));
  assert.equal((await loadHealthHistory(clients[1],users[0].id)).length,0);
  checked(await clients[0].from('couples').update({share_enabled:true}).eq('id',coupleId));
  results.push({label:'sharing disabled denies partner history',pass:true});
  const avatarPath = `${users[0].id}/${randomUUID()}.png`;
  storedObjects.push({ bucket: 'avatars', path: avatarPath });
  checked(await clients[0].storage.from('avatars').upload(avatarPath, fs.readFileSync('public/twilight.png'), { contentType: 'image/png' }));
  const avatar = await fetch(clients[0].storage.from('avatars').getPublicUrl(avatarPath).data.publicUrl, { signal: AbortSignal.timeout(10000) });
  assert.equal(avatar.status, 200); await avatar.body?.cancel();
  results.push({ label: 'avatar upload and public download', pass: true });
  const mediaPath = `${coupleId}/${randomUUID()}.enc`;
  storedObjects.push({ bucket: 'chat-media', path: mediaPath });
  const mediaCipher = await encryptWithEphemeralKey('Synthetic attachment', keys[1].publicKey, keys[0].privateKey);
  checked(await clients[0].storage.from('chat-media').upload(mediaPath, Buffer.from(mediaCipher), { contentType: 'application/octet-stream' }));
  const signed = checked(await clients[1].storage.from('chat-media').createSignedUrl(mediaPath, 60));
  const attachment = await fetch(signed.signedUrl, { signal: AbortSignal.timeout(10000) });
  assert.equal(attachment.status, 200); assert.equal(await attachment.text(), mediaCipher);
  results.push({ label: 'private attachment upload and partner signed download', pass: true });
  for (const sender of [0, 1]) {
    const recipient = 1 - sender, plain = 'Synthetic encrypted API QA';
    const content = await encryptWithEphemeralKey(plain, keys[recipient].publicKey, keys[sender].privateKey);
    const note = checked(await clients[sender].rpc('send_chat_note', { p_id: randomUUID(), p_couple: coupleId, p_content: content, p_sender_key: keys[sender].publicKey, p_recipient_key: keys[recipient].publicKey, p_type: 'text', p_device: keys[sender].device }));
    const received = checked(await clients[recipient].from('shared_notes').select('content,sender_public_key').eq('id', note.id).single());
    assert.equal(await decryptWithEphemeralKey(received.content, keys[recipient].privateKey, received.sender_public_key), plain);
    results.push({ label: `encrypted message direction ${sender}`, pass: true });
    const ice = await probe(`call credentials role ${sender}`, '/functions/v1/call-credentials', 200, { method: 'POST', token: tokens[sender], body: JSON.stringify({ coupleId }) });
    assert.ok(ice?.iceServers?.length && ice.expiresAt > Date.now());
    // The test account has no push tokens: this must never address a real user.
    await probe(`push with synthetic recipient ${sender}`, '/functions/v1/push-notifications', 200, { method: 'POST', token: tokens[sender], body: JSON.stringify({ noteId: note.id }) });
  }
  for (const name of ['ai-generate', 'call-credentials', 'push-notifications', 'push-notifications-']) {
    for (const body of ['{', '[]']) await probe(`${name} invalid body ${body === '{' ? 'syntax' : 'shape'}`, `/functions/v1/${name}`, 400, { method: 'POST', token: tokens[0], body });
  }
  for (const partner of [false, true]) {
    const guidance = await probe(`AI illustrated ${partner ? 'partner care' : 'Wellness tips'}`, '/functions/v1/ai-generate', 200, { method: 'POST', token: tokens[0], body: JSON.stringify({ mood: 'raw', customPrompt: wellnessGuidePrompt({phase:'Menstrual',cycleDay:2,moods:['calm'],symptoms:['cramps'],sleepQuality:'fair',energyLevel:'low',logHistory:'Fictional test context only. Three daily check-ins with mixed energy and 6 to 8 hours sleep.'}, partner) }) });
    assert.ok(typeof guidance?.text === 'string' && guidance.text.length > 50 && !guidance.text.includes('<think>'), 'Wellness must receive a visible answer, not just provider reasoning tokens');
    const cards = parseWellnessGuide(guidance.text);
    assert.equal(cards.length, 3, 'Complete illustrated guide must have three valid cards');
    assert.equal(new Set(cards.map(card => card.illustrationId)).size, 3, 'Suggestions must have distinct relevant subjects');
  }
  await probe('product search', '/functions/v1/ai-generate', 200, { method: 'POST', token: tokens[0], body: JSON.stringify({ mood: 'search', search_query: 'hot water bottle India' }) });
  await probe('places search', '/functions/v1/ai-generate', 200, { method: 'POST', token: tokens[0], body: JSON.stringify({ mood: 'places', lat: 22.5726, lon: 88.3639 }) });
  // Discover every table referenced by the client, then exercise its read route.
  const sources = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? sources(path.join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(dir, e.name)] : []);
  const tables = new Set([...sources('contexts'), ...sources('lib'), ...sources('hooks'), ...sources('pages')].flatMap(file => [...fs.readFileSync(file, 'utf8').replace(/\.storage\.from\(['"][^'"]+['"]\)/g, '').matchAll(/\.from\(['"]([a-z_]+)['"]\)/g)].map(match => match[1])));
  for (const table of tables) await probe(`table ${table}`, `/rest/v1/${table}?select=*&limit=0`, [200, 401, 403], { token: tokens[0] });
  for (const name of fs.readdirSync('public/Games_data').filter(name => name.endsWith('.json'))) {
    const route = new URL(`/Games_data/${name}`, process.env.API_WEB_ORIGIN || 'http://127.0.0.1:3000');
    const response = await fetch(route, { signal: AbortSignal.timeout(10000) });
    assert.equal(response.status, 200); await response.json();
    results.push({ label: `game data ${name}`, pass: true });
  }
  const route = await fetch('https://router.project-osrm.org/route/v1/driving/88.3639,22.5726;88.3649,22.5736?overview=full&geometries=geojson', { signal: AbortSignal.timeout(15000) });
  assert.equal(route.status, 200); assert.equal((await route.json()).code, 'Ok');
  results.push({ label: 'OSRM route geometry', pass: true });
  if (process.env.VITE_GIPHY_API_KEY) {
    const gifs = await fetch(`https://api.giphy.com/v1/gifs/trending?api_key=${encodeURIComponent(process.env.VITE_GIPHY_API_KEY)}&limit=1&rating=pg-13`, { signal: AbortSignal.timeout(15000) });
    results.push({ label: 'GIPHY trending', status: gifs.status, pass: gifs.ok });
    await gifs.body?.cancel();
  }
} finally {
  await Promise.allSettled(clients.map(client => client.auth.signOut()));
  for (const object of storedObjects) checked(await admin.storage.from(object.bucket).remove([object.path]));
  if (coupleId) { checked(await admin.from('shared_notes').delete().eq('couple_id', coupleId)); checked(await admin.from('couples').delete().eq('id', coupleId)); }
  for (const user of users) {
    assert.match(user.email, /^twilight-api-qa-[0-9a-f-]+@example\.invalid$/);
    assert.equal(checked(await admin.auth.admin.getUserById(user.id)).user.email, user.email);
    checked(await admin.from('profiles').delete().eq('id', user.id));
    checked(await admin.auth.admin.deleteUser(user.id));
  }
  fs.mkdirSync('tmp', { recursive: true });
  fs.writeFileSync('tmp/api-smoke-results.json', JSON.stringify(results, null, 2));
  console.log(`Removed ${users.length} synthetic accounts; ${results.filter(result => result.pass).length}/${results.length} checks passed.`);
}
assert.ok(results.every(result => result.pass), 'Inspect tmp/api-smoke-results.json for endpoint failures');
