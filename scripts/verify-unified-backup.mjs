// Only synthetic accounts are created and deleted. Existing accounts are read-only.
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { createServer } from "vite";
import { indexedDB } from "fake-indexeddb";
import { randomUUID, randomBytes } from "node:crypto";
import assert from "node:assert/strict";
config({ quiet: true });
globalThis.indexedDB = indexedDB;
const url = process.env.VITE_SUPABASE_URL;
assert.equal(new URL(url).hostname, "awijrkxrhlisixufiukw.supabase.co");
const options = {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    fetch: (input, init) =>
      fetch(input, { ...init, signal: AbortSignal.timeout(20000) }),
  },
};
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, options),
  clients = [],
  users = [],
  bundles = [];
const vite = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
});
const crypto = await vite.ssrLoadModule("/lib/vaultCrypto.ts"),
  runtime = await vite.ssrLoadModule("/lib/vaultRuntime.ts");
const { resolveVaultChatIdentity } = await vite.ssrLoadModule(
  "/lib/vaultChatIdentity.ts",
);
const { SecurePreferences: secrets } = await vite.ssrLoadModule(
  "/lib/securePreferences.ts",
);
const chat = await vite.ssrLoadModule("/lib/encryption.ts");
const { privateClient } = await vite.ssrLoadModule("/lib/privateQueries.ts");
const check = (r) => {
  if (r.error) throw Error(r.error.message);
  return r.data;
};
let couple;
const memoryStorage = new Map();
const previousWindow = globalThis.window;
globalThis.window = {
  crypto: globalThis.crypto,
  atob,
  btoa,
  dispatchEvent: () => true,
  localStorage: {
    getItem: (key) => memoryStorage.get(key) ?? null,
    setItem: (key, value) => memoryStorage.set(key, value),
    removeItem: (key) => memoryStorage.delete(key),
  },
};
const password = "synthetic unified backup password",
  newPassword = "synthetic changed backup password";
const activate = (i) => {
  runtime.installVault(bundles[i]);
  return privateClient(clients[i]);
};
const identity = async (i) => {
  activate(i);
  const state = check(await clients[i].rpc("get_own_chat_identity_state"));
  return resolveVaultChatIdentity(
    clients[i],
    users[i].id,
    state.public_key,
    state.generation,
    randomUUID(),
  );
};
const connect = async () => {
  const pending = check(await clients[1].rpc("generate_pairing_code"));
  couple = check(
    await clients[0].rpc("join_couple", { code_input: pending.pairing_code }),
  );
};
try {
  for (let i = 0; i < 3; i++) {
    const email = `twilight-vault-qa-${randomUUID()}@example.invalid`,
      login = randomBytes(24).toString("base64url");
    const user = check(
      await admin.auth.admin.createUser({
        email,
        password: login,
        email_confirm: true,
      }),
    ).user;
    users.push(user);
    const client = createClient(
      url,
      process.env.VITE_SUPABASE_ANON_KEY,
      options,
    );
    clients.push(client);
    check(await client.auth.signInWithPassword({ email, password: login }));
    check(
      await client.rpc("save_privacy_preferences", {
        p_age: "18+",
        p_core: true,
        p_health: true,
        p_share: false,
        p_ai: false,
        p_shopping: false,
      }),
    );
    if (i === 1)
      check(
        await client.rpc("choose_initial_account_role", { p_role: "partner" }),
      );
    const bundle = await crypto.createBundle(user.id, randomUUID());
    bundles.push(bundle);
    check(
      await client
        .from("account_vaults")
        .insert({
          user_id: user.id,
          epoch: bundle.epoch,
          public_key: bundle.publicKey,
          backup: await crypto.backupBundle(bundle, password),
        }),
    );
  }
  await connect();
  // Reproduce stale local counters left by the previous dataset, on the carer side.
  await secrets.set({
    key: users[1].id + "_chat_identity_generation",
    value: "99",
  });
  const owner = await identity(0),
    carer = await identity(1);
  assert.equal(carer.needsRestore, false);
  assert.equal(owner.needsRestore, false);
  console.log(
    "PASS first carer connection creates a vault-protected chat identity despite a retired local counter",
  );
  const stored = check(
    await clients[1]
      .from("vault_chat_backups")
      .select("*")
      .eq("user_id", users[1].id)
      .single(),
  );
  const privateKey = (await secrets.get({ key: users[1].id + "_private_key" }))
    .value;
  assert.ok(!JSON.stringify(stored).includes(privateKey));
  assert.equal(
    check(
      await clients[0]
        .from("vault_chat_backups")
        .select("*")
        .eq("user_id", users[1].id),
    ).length,
    0,
  );
  assert.equal(
    check(
      await clients[2]
        .from("vault_chat_backups")
        .select("*")
        .eq("user_id", users[1].id),
    ).length,
    0,
  );
  assert.equal(
    check(await clients[1].from("identity_backups").select("*")).length,
    0,
  );
  console.log(
    "PASS chat recovery ciphertext is owner-only and there is no separate chat password backup",
  );
  activate(0);
  chat.setCachedPrivateKey(
    (await secrets.get({ key: users[0].id + "_private_key" })).value,
  );
  const message = await chat.encryptMessage(
    "Synthetic private chat",
    carer.publicKey,
    "unified-test",
  );
  await secrets.remove({ key: users[1].id + "_private_key" });
  await secrets.remove({ key: users[1].id + "_public_key" });
  chat.clearEncryptionCache();
  const vaultRow = check(
    await clients[1].from("account_vaults").select("*").single(),
  );
  bundles[1] = await crypto.restoreBundle(
    vaultRow.backup,
    password,
    users[1].id,
    vaultRow.epoch,
  );
  const restored = await identity(1);
  assert.equal(restored.publicKey, carer.publicKey);
  assert.equal(
    await chat.decryptMessage(
      message,
      owner.publicKey,
      users[1].id,
      "unified-test",
    ),
    "Synthetic private chat",
  );
  console.log(
    "PASS a new carer device recovers its existing chat with only the account backup password",
  );
  const changed = await crypto.backupBundle(bundles[1], newPassword);
  check(
    await clients[1].rpc("change_vault_backup", {
      p_epoch: vaultRow.epoch,
      p_backup: changed,
      p_previous: vaultRow.backup,
    }),
  );
  assert.ok(
    (
      await clients[1].rpc("change_vault_backup", {
        p_epoch: vaultRow.epoch,
        p_backup: vaultRow.backup,
        p_previous: vaultRow.backup,
      })
    ).error,
  );
  await assert.rejects(
    crypto.restoreBundle(changed, password, users[1].id, vaultRow.epoch),
  );
  bundles[1] = await crypto.restoreBundle(
    changed,
    newPassword,
    users[1].id,
    vaultRow.epoch,
  );
  assert.equal((await identity(1)).publicKey, carer.publicKey);
  console.log(
    "PASS changing the single backup password preserves chat keys and rejects a stale password update",
  );
  const personal = activate(0);
  check(
    await personal
      .from("profiles")
      .upsert({ id: users[0].id, full_name: "Synthetic encrypted profile" }),
  );
  let before = carer.publicKey;
  for (let round = 0; round < 2; round++) {
    check(
      await admin.rpc("unlink_relationship", {
        p_couple: couple.id,
        p_actor: users[1].id,
      }),
    );
    couple = null;
    assert.equal(
      check(
        await admin
          .from("vault_chat_backups")
          .select("user_id")
          .in(
            "user_id",
            users.slice(0, 2).map((u) => u.id),
          ),
      ).length,
      0,
    );
    assert.equal(
      check(await clients[0].from("account_vaults").select("user_id")).length,
      1,
    );
    assert.ok(
      (
        await clients[1].rpc("register_vault_chat_identity", {
          p_epoch: stored.epoch,
          p_generation: 0,
          p_public_key: stored.public_key,
          p_ciphertext: stored.ciphertext,
          p_device: randomUUID(),
          p_device_name: "Stale synthetic device",
        })
      ).error,
    );
    await connect();
    await identity(0);
    const fresh = await identity(1);
    assert.equal(fresh.needsRestore, false);
    assert.notEqual(fresh.publicKey, before);
    before = fresh.publicKey;
    console.log(
      `PASS carer unlink/relink round ${round + 1} uses fresh chat keys and the existing account password`,
    );
  }
  const profile = check(
    await activate(0)
      .from("profiles")
      .select("*")
      .eq("id", users[0].id)
      .single(),
  );
  assert.equal(profile.full_name, "Synthetic encrypted profile");
  console.log(
    "PASS two carer-initiated unlink/relink cycles rotate chat keys without a second password; personal records survive",
  );
} finally {
  if (couple)
    await admin.rpc("unlink_relationship", {
      p_actor: users[1]?.id,
      p_couple: couple.id,
    });
  runtime.installVault(null);
  globalThis.window = previousWindow;
  for (const user of users) {
    await admin.from("profiles").delete().eq("id", user.id);
    const result = await admin.auth.admin.deleteUser(user.id);
    if (result.error) console.error("Synthetic cleanup needs retry");
  }
  for (const client of clients) await client.removeAllChannels();
  await vite.close();
}
