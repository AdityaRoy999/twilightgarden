// Explicit integration run: node --experimental-strip-types tests/live-sync.mjs [--keep]
// Creates only synthetic accounts. --keep retains them briefly for browser verification.
import fs from "node:fs";
import { randomUUID, randomBytes, webcrypto } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import assert from "node:assert/strict";
globalThis.window = { crypto: webcrypto, atob, btoa };
const {
  generateKeyPair,
  encryptMessage,
  encryptIdentityWithPin,
  decryptWithEphemeralKey,
  setCachedPrivateKey,
  derivePublicKeyFromPrivate,
} = await import("../lib/encryption.ts");
config({ quiet: true });
const url = "https://awijrkxrhlisixufiukw.supabase.co";
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, options),
  clients = [],
  users = [],
  keys = [];
const passphrase = "Synthetic-recovery-" + randomBytes(10).toString("hex");
let relationship;
let success = false;
const checked = (result) => {
  if (result.error) throw Error(result.error.message);
  return result.data;
};
const pass = (message) => console.log("PASS " + message);
const latency = [],
  starts = new Map(),
  received = new Map();
try {
  for (const role of ["user", "partner", "user"]) {
    const email = "twilight-sync-qa-" + randomUUID() + "@example.invalid",
      password = randomBytes(32).toString("base64url");
    const user = checked(
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: "Sync QA", is_partner: role === "partner" },
      }),
    ).user;
    users.push({ id: user.id, email, password });
    const client = createClient(
      url,
      process.env.VITE_SUPABASE_ANON_KEY,
      options,
    );
    checked(await client.auth.signInWithPassword({ email, password }));
    clients.push(client);
    const key = await generateKeyPair();
    keys.push(key);
    checked(
      await client
        .from("user_keys")
        .insert({
          user_id: user.id,
          device_id: randomUUID(),
          public_key: key.publicKey,
          device_name: "Synthetic QA",
        }),
    );
    const backup = await encryptIdentityWithPin(key.privateKey, passphrase);
    checked(
      await client
        .from("identity_backups")
        .insert({
          user_id: user.id,
          public_key: key.publicKey,
          backup_identity: backup.ciphertext,
          backup_salt: backup.salt,
        }),
    );
  }
  const [a, b, c] = clients,
    [aid, bid] = users.map((u) => u.id),
    pairing = randomBytes(3).toString("hex").toUpperCase();
  relationship = checked(
    await a
      .from("couples")
      .insert({
        partner_1_id: aid,
        partner_1_role: "menstruator",
        status: "pending",
        pairing_code: pairing,
      })
      .select()
      .single(),
  );
  // A creator must be able to subscribe while still pending and observe the join.
  let joinedEvent = false;
  const creator = a
    .channel("couple_main_" + relationship.id, { config: { private: true } })
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "couples",
        filter: "id=eq." + relationship.id,
      },
      () => {
        joinedEvent = true;
      },
    );
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(Error("Pending creator subscription timeout")),
      10000,
    );
    creator.subscribe((state) => {
      if (state === "SUBSCRIBED") {
        clearTimeout(timer);
        resolve();
      }
      if (state === "CHANNEL_ERROR") {
        clearTimeout(timer);
        reject(Error("Pending creator denied"));
      }
    });
  });
  checked(await b.rpc("join_couple", { code_input: pairing }));
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(Error("Join not delivered to creator")),
      5000,
    );
    const tick = setInterval(() => {
      if (joinedEvent) {
        clearInterval(tick);
        clearTimeout(timer);
        resolve();
      }
    }, 25);
  });
  pass("Pending creator receives pairing completion without refresh");
  const changed = await generateKeyPair();
  assert.ok(
    (
      await a
        .from("user_keys")
        .insert({
          user_id: aid,
          device_id: randomUUID(),
          public_key: changed.publicKey,
        })
    ).error,
  );
  assert.ok(
    (
      await a
        .from("identity_backups")
        .update({ public_key: changed.publicKey })
        .eq("user_id", aid)
    ).error,
  );
  checked(
    await a
      .from("user_keys")
      .insert({
        user_id: aid,
        device_id: randomUUID(),
        public_key: derivePublicKeyFromPrivate(keys[0].privateKey),
      }),
  );
  pass(
    "New device cannot replace the canonical identity; recovered identity registers",
  );
  let updatedRead = false;
  const receiver = b
    .channel("couple_main_" + relationship.id, { config: { private: true } })
    .on("broadcast", { event: "note:created" }, async ({ payload }) => {
      try {
        assert.notEqual(payload.content, "Synthetic latency probe");
        const plain = await decryptWithEphemeralKey(
          payload.content,
          keys[1].privateKey,
          payload.sender_public_key,
        );
        assert.equal(plain, "Synthetic latency probe");
        received.set(payload.id, true);
        if (starts.has(payload.id))
          latency.push(performance.now() - starts.get(payload.id));
      } catch (error) {
        console.error("Encrypted receive failed:", error.message);
      }
    })
    .on("broadcast", { event: "note:updated" }, ({ payload }) => {
      if (payload.status === "read") updatedRead = true;
    });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(Error("Private chat subscription timeout")),
      10000,
    );
    receiver.subscribe((state) => {
      if (state === "SUBSCRIBED") {
        clearTimeout(timer);
        resolve();
      }
      if (state === "CHANNEL_ERROR") {
        clearTimeout(timer);
        reject(Error("Receiver denied"));
      }
    });
  });
  let last;
  for (let i = 0; i < 20; i++) {
    setCachedPrivateKey(keys[0].privateKey);
    const encrypted = await encryptMessage(
      "Synthetic latency probe",
      keys[1].publicKey,
    );
    const params = {
      p_id: randomUUID(),
      p_couple: relationship.id,
      p_content: encrypted,
      p_sender_key: keys[0].publicKey,
      p_recipient_key: keys[1].publicKey,
      p_type: "text",
      p_device: randomUUID(),
    };
    starts.set(params.p_id, performance.now());
    last = checked(await a.rpc("send_chat_note", params));
    if (i === 0) {
      checked(await a.rpc("send_chat_note", params));
      assert.equal(
        checked(await a.from("shared_notes").select("id").eq("id", params.p_id))
          .length,
        1,
      );
    }
  }
  const deadline = Date.now() + 8000;
  while (received.size < 20 && Date.now() < deadline)
    await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(received.size, 20);
  pass(
    "Encrypted broadcasts deliver 20 messages and retries create no duplicates",
  );
  assert.ok(
    (await a.from("shared_notes").update({ status: "read" }).eq("id", last.id))
      .error,
  );
  checked(
    await b.from("shared_notes").update({ status: "read" }).eq("id", last.id),
  );
  checked(
    await b
      .from("shared_notes")
      .update({ status: "delivered" })
      .eq("id", last.id),
  );
  assert.equal(
    checked(
      await a.from("shared_notes").select("status").eq("id", last.id).single(),
    ).status,
    "read",
  );
  assert.equal(
    checked(
      await c
        .from("shared_notes")
        .select("id")
        .eq("couple_id", relationship.id),
    ).length,
    0,
  );
  assert.ok((await c.rpc("get_chat_public_key", { p_user_id: aid })).error);
  pass(
    "Only the recipient acknowledges messages; read receipts never regress; outsiders are denied",
  );
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  checked(
    await a.rpc("save_cycle_settings", {
      p_values: {
        avg_cycle_length: 28,
        avg_period_length: 5,
        last_period_start: "2026-10-01",
        onboarding_completed: true,
        irregular_cycle: false,
      },
    }),
  );
  const result = checked(
    await a.rpc("save_daily_log", {
      p_date: today,
      p_values: {
        flow: "medium",
        moods: ["calm"],
        symptoms: [],
        notes: "Synthetic cycle sync record",
        sleep_hours: 0,
      },
      p_period_start: true,
    }),
  );
  assert.equal(result.settings.last_period_start, today);
  assert.equal(result.log.sleep_hours, 0);
  checked(
    await a
      .from("couples")
      .update({ share_enabled: true })
      .eq("id", relationship.id),
  );
  assert.equal(
    checked(
      await b
        .from("user_settings")
        .select("last_period_start")
        .eq("user_id", aid)
        .single(),
    ).last_period_start,
    today,
  );
  checked(
    await a.rpc("save_daily_log", {
      p_date: today,
      p_values: {
        flow: null,
        moods: [],
        symptoms: [],
        notes: "Edited without a flow intensity",
        sleep_hours: 0,
      },
      p_period_start: true,
    }),
  );
  checked(
    await a
      .from("couples")
      .update({ share_enabled: false })
      .eq("id", relationship.id),
  );
  assert.equal(
    checked(await b.from("daily_logs").select("id").eq("user_id", aid)).length,
    0,
  );
  assert.ok(
    (
      await b
        .from("couples")
        .update({ share_enabled: true })
        .eq("id", relationship.id)
    ).error,
  );
  pass(
    "Period start/log commit atomically; zero sleep survives; partner dates match; ghost mode enforces consent",
  );
  const samples = [...latency].sort((a, b) => a - b),
    median = samples[Math.floor(samples.length / 2)],
    p95 = samples[Math.ceil(samples.length * 0.95) - 1];
  const metrics = {
    samples: samples.length,
    medianMs: Math.round(median),
    p95Ms: Math.round(p95),
    maxMs: Math.round(samples.at(-1)),
  };
  fs.writeFileSync("tmp/chat-latency.json", JSON.stringify(metrics, null, 2));
  console.log("Observed encrypted message latency " + JSON.stringify(metrics));
  fs.writeFileSync(
    "tmp/chat-qa.json",
    JSON.stringify({ users, passphrase, coupleId: relationship.id }, null, 2),
  );
  success = true;
} finally {
  await Promise.all(clients.map((client) => client.removeAllChannels()));
  if (!process.argv.includes("--keep") || !success) {
    if (relationship) {
      checked(
        await admin
          .from("shared_notes")
          .delete()
          .eq("couple_id", relationship.id),
      );
      checked(await admin.from("couples").delete().eq("id", relationship.id));
    }
    for (const { id } of users) {
      checked(await admin.from("profiles").delete().eq("id", id));
      checked(await admin.auth.admin.deleteUser(id));
    }
    console.log("Synthetic integration accounts removed.");
  }
}
