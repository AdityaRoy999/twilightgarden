// Synthetic accounts only. Never sends email or resets an existing user's data.
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { createServer } from 'vite';
import { randomUUID, randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
config({ quiet: true });
const url = process.env.VITE_SUPABASE_URL, anon = process.env.VITE_SUPABASE_ANON_KEY;
assert.equal(new URL(url).hostname, 'awijrkxrhlisixufiukw.supabase.co');
const options = { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(25000) }) } };
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, options);
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const crypto = await vite.ssrLoadModule('/lib/vaultCrypto.ts');
const transfer = await vite.ssrLoadModule('/lib/vaultTransfer.ts');
const users = [], clients = [];
const check = result => { if (result.error) throw new Error(result.error.message); return result.data; };
const pass = message => console.log('PASS', message);
try {
  for (let i = 0; i < 2; i++) {
    const email = `twilight-recovery-qa-${randomUUID()}@example.invalid`, password = randomBytes(24).toString('base64url');
    const user = check(await admin.auth.admin.createUser({ email, password, email_confirm: true })).user;
    users.push({ ...user, password });
    const client = createClient(url, anon, options); clients.push(client);
    check(await client.auth.signInWithPassword({ email, password }));
    check(await client.rpc('save_privacy_preferences', { p_age: '18+', p_core: true, p_health: true, p_share: false, p_ai: false, p_shopping: false }));
  }
  const owner = users[0], oldDevice = clients[0], stranger = clients[1];
  const newDevice = createClient(url, anon, options); clients.push(newDevice);
  check(await newDevice.auth.signInWithPassword({ email: owner.email, password: owner.password }));
  const bundle = await crypto.createBundle(owner.id, randomUUID());
  const backup = await crypto.backupBundle(bundle, 'synthetic-old-vault-password');
  check(await oldDevice.from('account_vaults').insert({ user_id: owner.id, epoch: bundle.epoch, public_key: bundle.publicKey, backup }));
  const secondBundle = await crypto.createBundle(users[1].id, randomUUID());
  check(await stranger.from('account_vaults').insert({ user_id: users[1].id, epoch: secondBundle.epoch, public_key: secondBundle.publicKey, backup: await crypto.backupBundle(secondBundle, 'synthetic-peer-vault-password') }));
  const id = randomUUID(), secret = await transfer.newDeviceSecret(), hash = await transfer.deviceCodeHash(secret.code);
  check(await newDevice.rpc('request_vault_device', { p_id: id, p_epoch: bundle.epoch, p_hash: hash, p_key: secret.publicKey, p_name: 'Synthetic new device' }));
  assert.equal(check(await stranger.from('vault_device_requests').select('*').eq('id', id)).length, 0);
  const ciphertext = await transfer.approveVaultTransfer(bundle, id, secret.publicKey, secret.code);
  assert.ok((await stranger.rpc('approve_vault_device', { p_id: id, p_hash: hash, p_ciphertext: ciphertext })).error);
  assert.ok((await newDevice.rpc('approve_vault_device', { p_id: id, p_hash: hash, p_ciphertext: ciphertext })).error);
  assert.ok((await newDevice.rpc('prepare_vault_reset', { p_actor: owner.id, p_epoch: bundle.epoch, p_verified_session: randomUUID() })).error);
  pass('cross-account reads/approval, self-approval and direct reset are rejected');
  check(await oldDevice.rpc('approve_vault_device', { p_id: id, p_hash: hash, p_ciphertext: ciphertext }));
  assert.equal(check(await oldDevice.rpc('consume_vault_device', { p_id: id })), null);
  const result = check(await newDevice.rpc('consume_vault_device', { p_id: id }));
  assert.deepEqual(await transfer.receiveVaultTransfer(secret.privateKey, bundle.publicKey, secret.code, owner.id, bundle.epoch, id, result.ciphertext), bundle);
  assert.equal(check(await newDevice.rpc('consume_vault_device', { p_id: id })), null);
  pass('approved vault opens only on requesting session and can be consumed once');
  const expired = randomUUID();
  check(await newDevice.rpc('request_vault_device', { p_id: expired, p_epoch: bundle.epoch, p_hash: await transfer.deviceCodeHash((await transfer.newDeviceSecret()).code), p_key: secret.publicKey, p_name: 'Expiry test' }));
  check(await newDevice.rpc('cancel_vault_device', { p_id: expired }));
  assert.equal(check(await oldDevice.from('vault_device_requests').select('*').eq('id', expired)).length, 0);
  assert.ok((await oldDevice.rpc('approve_vault_device', { p_id: expired, p_hash: hash, p_ciphertext: ciphertext })).error);
  pass('cancelled/expired codes cannot be read or approved');
  const nextBackup = await crypto.backupBundle(bundle, 'synthetic-replacement-password');
  check(await newDevice.rpc('change_vault_backup', { p_epoch: bundle.epoch, p_previous: backup, p_backup: nextBackup }));
  const row = check(await oldDevice.from('account_vaults').select('backup').eq('user_id', owner.id).single());
  await assert.rejects(crypto.restoreBundle(row.backup, 'synthetic-old-vault-password', owner.id, bundle.epoch));
  assert.deepEqual(await crypto.restoreBundle(row.backup, 'synthetic-replacement-password', owner.id, bundle.epoch), bundle);
  pass('unlocked-device password replacement preserves keys and invalidates old backup password');
  // Add personal ciphertext and a connected peer to exercise reset scope.
  check(await oldDevice.rpc('save_private_records', { p_records: [{ id: await crypto.privateRecordId(bundle, 'daily_logs', '2026-11-01'), owner_id: owner.id, epoch: bundle.epoch, kind: 'daily_logs', ciphertext: await crypto.seal(await crypto.aes(bundle.master), { date: '2026-11-01', mood: 'Calm' }, 'synthetic'), owner_key: await crypto.seal(await crypto.aes(bundle.master), 'test', 'synthetic-key'), revision: 0 }] }));
  const couple = check(await admin.from('couples').insert({ partner_1_id: owner.id, partner_2_id: users[1].id, partner_1_role: 'menstruator', pairing_code: randomBytes(3).toString('hex').toUpperCase(), status: 'active' }).select('id').single());
  const upload = `${owner.id}/${randomUUID()}.bin`;
  check(await oldDevice.storage.from('private-media').upload(upload, new Uint8Array([1, 2, 3]), { contentType: 'application/octet-stream' }));
  const anonymous = await fetch(`${url}/functions/v1/vault-recovery`, { method: 'POST', headers: { apikey: anon, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reset', epoch: bundle.epoch, code: '000000' }) });
  assert.equal(anonymous.status, 401);
  const token = check(await oldDevice.auth.getSession()).session.access_token;
  const invalid = await fetch(`${url}/functions/v1/vault-recovery`, { method: 'POST', headers: { apikey: anon, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reset', epoch: bundle.epoch, code: '000000' }) });
  assert.equal(invalid.status, 403);
  pass('reset endpoint rejects anonymous calls and invalid email proof');
  // generateLink returns a synthetic OTP without sending an email.
  const link = check(await admin.auth.admin.generateLink({ type: 'magiclink', email: owner.email }));
  const response = await fetch(`${url}/functions/v1/vault-recovery`, { method: 'POST', headers: { apikey: anon, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reset', epoch: bundle.epoch, code: link.properties.email_otp }) });
  assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
  assert.equal((await response.json()).reset, true);
  assert.equal(check(await admin.from('account_vaults').select('*').eq('user_id', owner.id)).length, 0);
  assert.equal(check(await admin.from('private_records').select('*').eq('owner_id', owner.id)).length, 0);
  assert.equal(check(await admin.from('couples').select('id').eq('id', couple.id)).length, 0);
  assert.equal(check(await admin.rpc('account_storage_objects', { p_actor: owner.id })).length, 0);
  assert.ok(check(await admin.auth.admin.getUserById(owner.id)).user);
  assert.equal(check(await admin.from('account_vaults').select('*').eq('user_id', users[1].id)).length, 1);
  const oldSession = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).session_id;
  assert.equal(check(await admin.rpc('session_is_active', { p_actor: owner.id, p_session: oldSession })), false);
  assert.equal(check(await newDevice.from('account_vaults').select('*')).length, 0);
  pass('email-verified reset deletes own encrypted records/media, unlinks peer, revokes sessions and preserves login and peer vault');
  check(await newDevice.auth.signInWithPassword({ email: owner.email, password: owner.password }));
  const fresh = await crypto.createBundle(owner.id, randomUUID());
  check(await newDevice.from('account_vaults').insert({ user_id: owner.id, epoch: fresh.epoch, public_key: fresh.publicKey, backup: await crypto.backupBundle(fresh, 'brand-new-backup-password') }));
  assert.ok((await newDevice.rpc('request_vault_device', { p_id: randomUUID(), p_epoch: bundle.epoch, p_hash: hash, p_key: secret.publicKey, p_name: 'Stale device' })).error);
  pass('fresh login can create a new vault; old-epoch device requests fail');
} finally {
  for (const client of clients) await client.removeAllChannels();
  for (const user of users) {
    const couples = check(await admin.from('couples').select('id').or(`partner_1_id.eq.${user.id},partner_2_id.eq.${user.id}`));
    for (const couple of couples) check(await admin.rpc('unlink_relationship', { p_actor: user.id, p_couple: couple.id }));
    const objects = check(await admin.rpc('account_storage_objects', { p_actor: user.id }));
    for (const bucket of new Set(objects.map(o => o.bucket_id))) check(await admin.storage.from(bucket).remove(objects.filter(o => o.bucket_id === bucket).map(o => o.name)));
    check(await admin.from('profiles').delete().eq('id', user.id));
    check(await admin.auth.admin.deleteUser(user.id));
  }
  await vite.close();
}
