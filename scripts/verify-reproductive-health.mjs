// Disposable synthetic accounts only; never edits an existing person's health data.
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { createServer } from "vite";
import { randomUUID, randomBytes } from "node:crypto";
import { indexedDB } from "fake-indexeddb";
import assert from "node:assert/strict";
config({ quiet: true });
globalThis.indexedDB = indexedDB;
const url = process.env.VITE_SUPABASE_URL;
assert.equal(new URL(url).hostname, "awijrkxrhlisixufiukw.supabase.co");
const opts = {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    fetch: (input, init) =>
      fetch(input, { ...init, signal: AbortSignal.timeout(20000) }),
  },
};
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, opts),
  users = [],
  clients = [];
const vite = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
});
const crypto = await vite.ssrLoadModule("/lib/vaultCrypto.ts"),
  runtime = await vite.ssrLoadModule("/lib/vaultRuntime.ts"),
  data = await vite.ssrLoadModule("/lib/privateData.ts");
const check = (r) => {
  if (r.error) throw new Error(r.error.message);
  return r.data;
};
const pass = (message) => console.log("PASS", message);
try {
  for (let i = 0; i < 3; i++) {
    const email = `twilight-health-qa-${randomUUID()}@example.invalid`,
      password = randomBytes(24).toString("base64url");
    const u = check(
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      }),
    ).user;
    users.push(u);
    const c = createClient(url, process.env.VITE_SUPABASE_ANON_KEY, opts);
    clients.push(c);
    check(await c.auth.signInWithPassword({ email, password }));
    check(
      await c.rpc("save_privacy_preferences", {
        p_age: "18+",
        p_core: true,
        p_health: i !== 2,
        p_share: i !== 2,
        p_ai: false,
        p_shopping: false,
      }),
    );
    const bundle = await crypto.createBundle(u.id, randomUUID());
    u.bundle = bundle;
    check(
      await c.from("account_vaults").insert({
        user_id: u.id,
        epoch: bundle.epoch,
        public_key: bundle.publicKey,
        backup: await crypto.backupBundle(
          bundle,
          "Synthetic-health-test-password",
        ),
      }),
    );
  }
  const couple = check(
    await admin
      .from("couples")
      .insert({
        partner_1_id: users[0].id,
        partner_2_id: users[1].id,
        partner_1_role: "menstruator",
        status: "active",
        share_enabled: true,
        pairing_code: randomBytes(6).toString("hex").toUpperCase(),
      })
      .select("id")
      .single(),
  );
  runtime.installVault(users[0].bundle);
  data.configurePrivateData(clients[0]);
  const entry = {
    id: randomUUID(),
    category: "intimacy",
    date: "2026-11-06",
    title: "Synthetic private QA entry",
    notes: "SYNTHETIC_HEALTH_SECRET_NEVER_REAL_DATA",
    values: { protection: "Condom or barrier" },
    shareWithPartner: false,
  };
  await data.savePrivateRow("reproductive_entries", entry.id, entry);
  let raw = check(
    await clients[0]
      .from("private_records")
      .select("*")
      .eq("kind", "reproductive_entries"),
  );
  assert.equal(raw.length, 1);
  assert.ok(!JSON.stringify(raw).includes(entry.notes));
  assert.deepEqual(await data.decryptRecord(raw[0]), entry);
  assert.equal(
    check(
      await clients[1]
        .from("private_records")
        .select("*")
        .eq("owner_id", users[0].id),
    ).length,
    0,
  );
  assert.equal(
    check(
      await clients[2]
        .from("private_records")
        .select("*")
        .eq("owner_id", users[0].id),
    ).length,
    0,
  );
  pass(
    "new sensitive entries are ciphertext-only and private even within an active couple",
  );
  await data.savePrivateRow("reproductive_entries", entry.id, {
    ...entry,
    shareWithPartner: true,
    shareCoupleId: couple.id,
  });
  raw = check(
    await clients[1]
      .from("private_records")
      .select("*")
      .eq("owner_id", users[0].id),
  );
  assert.equal(raw.length, 1);
  runtime.installVault(users[1].bundle);
  data.configurePrivateData(clients[1]);
  assert.equal((await data.decryptRecord(raw[0])).notes, entry.notes);
  pass("explicit per-entry grant decrypts on the intended partner device");
  runtime.installVault(users[0].bundle);
  data.configurePrivateData(clients[0]);
  await data.savePrivateRow("reproductive_entries", entry.id, {
    ...entry,
    shareWithPartner: true,
    shareCoupleId: randomUUID(),
  });
  await data.refreshPrivateShares();
  assert.equal(
    check(
      await clients[1]
        .from("private_records")
        .select("*")
        .eq("owner_id", users[0].id),
    ).length,
    0,
  );
  pass("a previous or different relationship cannot inherit an entry grant");
  const modeRecord = await data.preparePrivateRecord(
    "reproductive_settings",
    "reproductive_settings",
    { id: "reproductive_settings", mode: "pregnancy" },
    null,
  );
  const cycleRecord = await data.preparePrivateRecord(
    "health_settings",
    "health_settings",
    {
      avg_cycle_length: 28,
      avg_period_length: 5,
      calendar_estimates_paused: true,
    },
  );
  await data.savePrivateBatch([modeRecord, cycleRecord]);
  const partnerRows = check(
    await clients[1]
      .from("private_records")
      .select("*")
      .eq("owner_id", users[0].id),
  );
  assert.deepEqual(
    partnerRows.map((r) => r.kind),
    ["health_settings"],
  );
  runtime.installVault(users[1].bundle);
  data.configurePrivateData(clients[1]);
  assert.equal(
    (await data.decryptRecord(partnerRows[0])).calendar_estimates_paused,
    true,
  );
  pass(
    "pregnancy mode atomically pauses partner estimates without disclosing private pregnancy settings",
  );

  assert.ok(
    (await clients[2].rpc("save_private_records", { p_records: [raw[0]] }))
      .error,
  );
  runtime.installVault(users[2].bundle);
  data.configurePrivateData(clients[2]);
  const denied = await data.preparePrivateRecord(
    "reproductive_settings",
    "reproductive_settings",
    { id: "reproductive_settings", mode: "pregnancy" },
    null,
  );
  assert.ok(
    (await clients[2].rpc("save_private_records", { p_records: [denied] }))
      .error,
  );
  pass("cross-account writes and writes without health consent are rejected");
  check(
    await clients[0].rpc("save_privacy_preferences", {
      p_age: "18+",
      p_core: true,
      p_health: true,
      p_share: false,
      p_ai: false,
      p_shopping: false,
    }),
  );
  assert.equal(
    check(
      await clients[1]
        .from("private_records")
        .select("*")
        .eq("owner_id", users[0].id),
    ).length,
    0,
  );
  const revoked = check(
    await clients[0]
      .from("private_records")
      .select("*")
      .eq("kind", "reproductive_entries"),
  )[0];
  assert.equal(revoked.recipient_key, null);
  pass(
    "revoking broad health consent immediately removes reproductive entry envelopes",
  );
  runtime.installVault(users[0].bundle);
  data.configurePrivateData(clients[0]);
  await data.savePrivateRow("reproductive_settings", "reproductive_settings", {
    id: "reproductive_settings",
    mode: "cycle",
  });
  const stale = await data.preparePrivateRecord(
    "reproductive_settings",
    "reproductive_settings",
    { id: "reproductive_settings", mode: "postpartum" },
    null,
  );
  await data.savePrivateRow("reproductive_settings", "reproductive_settings", {
    id: "reproductive_settings",
    mode: "conceive",
  });
  assert.ok(
    (await clients[0].rpc("save_private_records", { p_records: [stale] }))
      .error,
  );
  data.invalidatePrivateRecords(users[0].id, "reproductive_settings");
  assert.equal(
    (await data.readPrivateRows(users[0].id, "reproductive_settings"))[0].mode,
    "conceive",
  );
  pass("stale offline revisions cannot overwrite changes from another device");
  const peerBefore = check(
    await clients[1].from("account_vaults").select("epoch"),
  )[0].epoch;
  check(
    await admin
      .from("couples")
      .update({ share_enabled: false })
      .eq("id", couple.id),
  );
  assert.equal(
    check(await clients[1].from("account_vaults").select("epoch"))[0].epoch,
    peerBefore,
  );
  pass("sharing changes preserve both personal vaults");
} catch (error) {
  console.error("Health QA failed:", error);
  throw error;
} finally {
  runtime.installVault(null);
  await vite.close();
  for (const c of clients) await c.auth.signOut();
  for (const u of users) {
    const couples = check(
      await admin
        .from("couples")
        .select("id")
        .or(`partner_1_id.eq.${u.id},partner_2_id.eq.${u.id}`),
    );
    for (const c of couples)
      check(
        await admin.rpc("unlink_relationship", {
          p_actor: u.id,
          p_couple: c.id,
        }),
      );
    check(await admin.from("profiles").delete().eq("id", u.id));
    check(await admin.auth.admin.deleteUser(u.id));
  }
  console.log("Synthetic health QA accounts cleaned up.");
}
