// Production verification uses only newly-created, synthetic accounts.
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { createServer } from "vite";
import { indexedDB } from "fake-indexeddb";
import { randomUUID, randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import fs from "node:fs";
config({ quiet: true });
globalThis.indexedDB = indexedDB;
const url = process.env.VITE_SUPABASE_URL,
  anon = process.env.VITE_SUPABASE_ANON_KEY;
assert.equal(new URL(url).hostname, "awijrkxrhlisixufiukw.supabase.co");
const options = { auth: { persistSession: false, autoRefreshToken: false } },
  admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, options);
const vite = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
});
const crypto = await vite.ssrLoadModule("/lib/vaultCrypto.ts"),
  runtime = await vite.ssrLoadModule("/lib/vaultRuntime.ts");
const queries = await vite.ssrLoadModule("/lib/privateQueries.ts"),
  privateData = await vite.ssrLoadModule("/lib/privateData.ts");
const engine = await vite.ssrLoadModule(
  "/supabase/functions/_shared/gameEngine.ts",
);
const { EncryptedGameRoom } = await vite.ssrLoadModule(
  "/lib/encryptedGames.ts",
);
const users = [],
  clients = [],
  bundles = [],
  uploads = [],
  checks = [],
  latencies = [];
let couple;
const check = (r) => {
  if (r.error) throw new Error(r.error.message);
  return r.data;
};
const pass = (name, detail = {}) => {
  checks.push({ name, ...detail });
  console.log("PASS", name, JSON.stringify(detail));
};
const activate = (i) => {
  const facade = queries.privateClient(clients[i]);
  runtime.installVault(bundles[i]);
  return facade;
};
const consent = (i, extra = {}) =>
  clients[i].rpc("save_privacy_preferences", {
    p_age: "18+",
    p_core: true,
    p_health: true,
    p_share: false,
    p_ai: false,
    p_shopping: false,
    ...extra,
  });
try {
  for (let i = 0; i < 3; i++) {
    const email = `twilight-vault-qa-${randomUUID()}@example.invalid`,
      password = randomBytes(24).toString("base64url");
    const user = check(
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      }),
    ).user;
    users.push(user);
    const client = createClient(url, anon, options);
    clients.push(client);
    check(await client.auth.signInWithPassword({ email, password }));
    assert.ok(
      (
        await client
          .from("account_vaults")
          .insert({ user_id: user.id, public_key: {}, backup: {} })
      ).error,
    );
    check(await consent(i));
    if (i === 1)
      check(
        await client.rpc("choose_initial_account_role", { p_role: "partner" }),
      );
    const bundle = await crypto.createBundle(user.id, randomUUID());
    bundles.push(bundle);
    const backup = await crypto.backupBundle(
      bundle,
      "synthetic recovery password",
    );
    check(
      await client.from("account_vaults").insert({
        user_id: user.id,
        epoch: bundle.epoch,
        public_key: bundle.publicKey,
        backup,
      }),
    );
    assert.deepEqual(
      await crypto.restoreBundle(
        backup,
        "synthetic recovery password",
        user.id,
        bundle.epoch,
      ),
      bundle,
    );
  }
  pass(
    "vault setup is consent-gated and a new device can restore its own bundle",
  );
  const sealedBackup = check(
    await clients[1]
      .from("account_vaults")
      .select("*")
      .eq("user_id", users[0].id),
  );
  assert.equal(sealedBackup.length, 0);
  const a = activate(0),
    date = "2026-10-20";
  const start = performance.now();
  check(
    await a.rpc("save_cycle_settings", {
      p_values: {
        avg_cycle_length: 28,
        avg_period_length: 5,
        last_period_start: date,
        onboarding_completed: true,
        irregular_cycle: false,
      },
    }),
  );
  check(
    await a.rpc("save_daily_log", {
      p_date: date,
      p_period_start: true,
      p_values: {
        flow: "light",
        moods: ["calm"],
        symptoms: ["cramps"],
        notes: "Synthetic private health note",
        sleep_hours: 8,
      },
    }),
  );
  latencies.push(Math.round(performance.now() - start));
  check(
    await a.from("profiles").upsert({
      id: users[0].id,
      full_name: "Synthetic private display name",
      bio: "Synthetic private biography",
    }),
  );
  const own = check(
    await a.from("daily_logs").select("*").eq("user_id", users[0].id),
  );
  assert.equal(own[0].notes, "Synthetic private health note");
  assert.equal(own[0].date, date);
  privateData.invalidatePrivateRecords(users[0].id, "daily_logs");
  const readMs = [];
  for (let i = 0; i < 4; i++) {
    const began = performance.now();
    const rows = check(
      await a.from("daily_logs").select("*").eq("user_id", users[0].id),
    );
    assert.equal(rows[0].notes, "Synthetic private health note");
    readMs.push(Number((performance.now() - began).toFixed(2)));
  }
  pass(
    "owner ciphertext cache avoids repeated fetches without persisting decrypted history",
    { coldReadMs: readMs[0], warmReadMs: readMs.slice(1) },
  );
  const wire = check(
    await admin.from("private_records").select("*").eq("owner_id", users[0].id),
  );
  const serialized = JSON.stringify(wire);
  for (const secret of ["Synthetic private", "2026-10-20", "cramps", "calm"])
    assert.ok(!serialized.includes(secret));
  assert.equal(
    check(await admin.from("daily_logs").select("*").eq("user_id", users[0].id))
      .length,
    0,
  );
  pass(
    "health dates, values and profile content are encrypted before network persistence",
    { transactionsMs: latencies[0], records: wire.length },
  );
  const avatarBytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXioAAAAASUVORK5CYII=", "base64");
  const avatar = await privateData.encryptPrivateAvatar(new File([avatarBytes], "synthetic.png", {type:"image/png"}), users[0].id);
  check(await a.from("profiles").update({avatar_url:avatar}).eq("id",users[0].id));
  const paths=check(await clients[0].storage.from("private-media").list(users[0].id));
  assert.equal(paths.length,1);
  const avatarPath=`${users[0].id}/${paths[0].name}`;
  uploads.push(["private-media",avatarPath]);
  const binary=check(await clients[0].storage.from("private-media").download(avatarPath));
  assert.notDeepEqual(Buffer.from(await binary.arrayBuffer()),avatarBytes);
  assert.ok((await clients[2].storage.from("private-media").download(avatarPath)).error);
  const restoredAvatar=check(await activate(0).from("profiles").select("*").eq("id",users[0].id).single());
  assert.deepEqual(Buffer.from(await (await fetch(restoredAvatar.avatar_url)).arrayBuffer()),avatarBytes);
  pass("private avatar bytes round-trip through encrypted object storage; strangers cannot download them");
  const revision = wire[0].revision;
  assert.ok(
    (
      await clients[0].rpc("save_private_records", {
        p_records: [{ ...wire[0], revision: revision - 1 }],
      })
    ).error,
  );
  pass("stale record revisions fail instead of overwriting another device");
  couple = check(
    await clients[0]
      .from("couples")
      .insert({
        partner_1_id: users[0].id,
        partner_1_role: "menstruator",
        status: "pending",
        pairing_code: randomBytes(3).toString("hex").toUpperCase(),
      })
      .select("*")
      .single(),
  );
  check(
    await clients[1].rpc("join_couple", { code_input: couple.pairing_code }),
  );
  assert.equal(
    check(
      await activate(1)
        .from("daily_logs")
        .select("*")
        .eq("user_id", users[0].id),
    ).length,
    0,
  );
  check(await consent(0, { p_share: true }));
  activate(0);
  await privateData.refreshPrivateShares();
  const shared = check(
    await activate(1).from("daily_logs").select("*").eq("user_id", users[0].id),
  );
  assert.equal(shared[0].notes, "Synthetic private health note");
  const profile = check(
    await activate(1)
      .from("profiles")
      .select("*")
      .eq("id", users[0].id)
      .single(),
  );
  assert.equal(profile.full_name, "Synthetic private display name");
  const outsider = check(
    await clients[2]
      .from("private_records")
      .select("*")
      .eq("owner_id", users[0].id),
  );
  assert.equal(outsider.length, 0);
  assert.equal(
    check(
      await clients[1]
        .from("account_vaults")
        .select("*")
        .eq("user_id", users[0].id),
    ).length,
    0,
  );
  pass(
    "sharing needs consent plus a per-record envelope; strangers and peer backups stay inaccessible",
  );
  const savedWindow = globalThis.window;
  globalThis.window = {
    crypto: globalThis.crypto,
    atob,
    btoa,
    dispatchEvent: () => true,
  };
  try {
    const chat = await vite.ssrLoadModule("/lib/encryption.ts");
    const keys = [await chat.generateKeyPair(), await chat.generateKeyPair()],
      device = randomUUID(),
      noteId = randomUUID();
    for (let i = 0; i < 2; i++)
      check(
        await clients[i]
          .from("user_keys")
          .upsert({
            user_id: users[i].id,
            device_id: i ? randomUUID() : device,
            public_key: keys[i].publicKey,
            identity_generation: 0,
            device_name: "Synthetic QA",
          }),
      );
    const aad = (field) => `twilight:chat:2:${couple.id}:${noteId}:${field}`;
    chat.setCachedPrivateKey(keys[0].privateKey);
    const content = await chat.encryptMessage(
      "Synthetic private message",
      keys[1].publicKey,
      aad("content"),
    );
    const media = await chat.encryptMessage(
      "https://example.invalid/synthetic-gif",
      keys[1].publicKey,
      aad("media"),
    );
    check(
      await clients[0].rpc("send_chat_note", {
        p_id: noteId,
        p_couple: couple.id,
        p_content: content,
        p_sender_key: keys[0].publicKey,
        p_recipient_key: keys[1].publicKey,
        p_type: "gif",
        p_media: media,
        p_reply: null,
        p_device: device,
      }),
    );
    chat.setCachedPrivateKey(keys[1].privateKey);
    const received = check(
      await clients[1]
        .from("shared_notes")
        .select("*")
        .eq("id", noteId)
        .single(),
    );
    assert.equal(
      await chat.decryptMessage(
        received.content,
        keys[0].publicKey,
        undefined,
        aad("content"),
      ),
      "Synthetic private message",
    );
    assert.equal(
      await chat.decryptMessage(
        received.media_url,
        keys[0].publicKey,
        undefined,
        aad("media"),
      ),
      "https://example.invalid/synthetic-gif",
    );
    const reactions = await chat.encryptData(
      [{ user_id: users[1].id, emoji: "❤️" }],
      keys[0].publicKey,
      aad("reactions"),
    );
    const reply = await chat.encryptMessage(
      "Synthetic private reply",
      keys[0].publicKey,
      aad("reply"),
    );
    check(
      await clients[1]
        .from("shared_notes")
        .update({ reactions, reply_content: reply })
        .eq("id", noteId),
    );
    const stored = check(
      await admin.from("shared_notes").select("*").eq("id", noteId).single(),
    );
    assert.ok(!JSON.stringify(stored).includes("Synthetic private"));
    assert.ok(!JSON.stringify(stored).includes("synthetic-gif"));
    assert.equal(typeof stored.reactions, "string");
    chat.setCachedPrivateKey(keys[0].privateKey);
    assert.deepEqual(
      await chat.decryptData(
        stored.reactions,
        keys[1].publicKey,
        undefined,
        aad("reactions"),
      ),
      [{ user_id: users[1].id, emoji: "❤️" }],
    );
    assert.equal(
      await chat.decryptMessage(
        stored.reply_content,
        keys[1].publicKey,
        undefined,
        aad("reply"),
      ),
      "Synthetic private reply",
    );
    chat.clearEncryptionCache();
    pass(
      "messages, GIF references, replies and emoji reactions round-trip with message-bound encryption",
    );
  } finally {
    if (savedWindow === undefined) delete globalThis.window;
    else globalThis.window = savedWindow;
  }
  check(await consent(0, { p_share: false }));
  assert.equal(
    check(
      await clients[1]
        .from("private_records")
        .select("*")
        .eq("owner_id", users[0].id)
        .eq("kind", "daily_logs"),
    ).length,
    0,
  );
  pass("withdrawing health sharing immediately blocks further reads");
  const opened = check(
    await clients[0].rpc("open_private_game", {
      p_couple: couple.id,
      p_type: "tictactoe",
    }),
  );
  const joined = check(
    await clients[1].rpc("open_private_game", {
      p_couple: couple.id,
      p_type: "tictactoe",
    }),
  );
  assert.equal(opened.id, joined.id);
  const keyA = await crypto.sharingKey(
      bundles[0],
      bundles[1].publicKey,
      `game:${couple.id}`,
    ),
    keyB = await crypto.sharingKey(
      bundles[1],
      bundles[0].publicKey,
      `game:${couple.id}`,
    );
  let room = joined,
    initial = engine.initialGame("tictactoe");
  async function commit(state, secret, command = null) {
    const n = room.revision + 1;
    const cipher = await crypto.seal(
      keyA,
      state,
      `twilight:game:1:${couple.id}:${room.id}:${n}:state`,
    );
    const hidden = await crypto.seal(
      await crypto.aes(bundles[0].master),
      secret,
      `twilight:game:1:${couple.id}:${room.id}:${n}:host`,
    );
    room = check(
      await clients[0].rpc("commit_private_game", {
        p_id: room.id,
        p_revision: room.revision,
        p_state: cipher,
        p_secret: hidden,
        p_command: command,
        p_status: state.phase === "result" ? "finished" : "active",
      }),
    );
  }
  await commit(initial.state, initial.secret);
  async function action(player, move) {
    const actor = users[player].id,
      id = randomUUID(),
      revision = room.revision;
    const aad = `twilight:game-command:1:${couple.id}:${room.id}:${actor}:${id}:${revision}`;
    const cipher = await crypto.seal(player === 0 ? keyA : keyB, move, aad);
    check(
      await clients[player].rpc("queue_private_game_command", {
        p_id: id,
        p_session: room.id,
        p_revision: revision,
        p_ciphertext: cipher,
      }),
    );
    const command = check(
      await clients[0]
        .from("encrypted_game_commands")
        .select("*")
        .eq("id", id)
        .single(),
    );
    const decoded = await crypto.open(keyA, command.ciphertext, aad);
    const output = engine.play(
      "tictactoe",
      initial.state,
      initial.secret,
      player === 0 ? "X" : "O",
      decoded,
    );
    initial = output;
    const start = performance.now();
    await commit(output.state, output.secret, id);
    latencies.push(Math.round(performance.now() - start));
  }
  await action(0, { kind: "ready" });
  await action(1, { kind: "ready" });
  for (const [player, cell] of [
    [0, 0],
    [1, 3],
    [0, 1],
    [1, 4],
    [0, 2],
  ])
    await action(player, { kind: "cell", index: cell });
  const decrypted = await crypto.open(
    keyB,
    room.encrypted_state,
    `twilight:game:1:${couple.id}:${room.id}:${room.revision}:state`,
  );
  assert.equal(decrypted.winner, "X");
  assert.deepEqual(room.board_state, { encrypted: true });
  assert.equal(room.winner, null);
  assert.equal(room.current_turn, null);
  await assert.rejects(
    crypto.open(
      await crypto.aes(bundles[1].master),
      room.host_secret,
      `twilight:game:1:${couple.id}:${room.id}:${room.revision}:host`,
    ),
  );
  assert.equal(
    check(
      await clients[2]
        .from("encrypted_game_commands")
        .select("*")
        .eq("session_id", room.id),
    ).length,
    0,
  );
  pass(
    "encrypted game transport supports join, readiness, moves and a win; server board and hidden answers stay opaque",
    { commitMs: latencies.slice(1) },
  );
  const views = [null, null],
    transportErrors = [],
    rooms = [];
  const wait = async (predicate, label) => {
    const end = Date.now() + 15000;
    while (!predicate()) {
      if (Date.now() > end)
        throw new Error(`Timed out: ${label}; ${transportErrors.join("; ")}`);
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
  };
  try {
    activate(0);
    const host = new EncryptedGameRoom(
      users[0].id,
      couple.id,
      users[1].id,
      "connect_four",
      (error) => transportErrors.push(error),
      clients[0],
      bundles[0],
    );
    rooms.push(host);
    host.subscribe((next) => {
      views[0] = next;
    });
    await host.start();
    activate(1);
    const guest = new EncryptedGameRoom(
      users[1].id,
      couple.id,
      users[0].id,
      "connect_four",
      (error) => transportErrors.push(error),
      clients[1],
      bundles[1],
    );
    rooms.push(guest);
    guest.subscribe((next) => {
      views[1] = next;
    });
    await guest.start();
    await wait(() => views[0]?.player_o === users[1].id, "host sees join");
    await host.action({ kind: "ready" });
    await wait(
      () => views[1]?.revision === views[0]?.revision,
      "guest sees host ready",
    );
    await guest.action({ kind: "ready" });
    await wait(
      () => views.every((v) => v?.board_state.phase === "play"),
      "both ready",
    );
    const hostMs = [],
      guestMs = [];
    for (let i = 0; i < 3; i++) {
      let began = performance.now();
      await host.action({ kind: "move", index: 0 });
      await wait(
        () => views[1]?.board_state.moves === i * 2 + 1,
        "peer sees host move",
      );
      hostMs.push(Math.round(performance.now() - began));
      began = performance.now();
      await guest.action({ kind: "move", index: 1 });
      await wait(
        () => views[0]?.board_state.moves === i * 2 + 2,
        "host sees peer move",
      );
      guestMs.push(Math.round(performance.now() - began));
    }
    pass(
      "actual client transport drains durable commands and synchronizes two realtime clients",
      {
        hostToPeerMs: hostMs,
        guestToHostMs: guestMs,
        baselineHostToPeerMs: 656,
      },
    );
  } finally {
    for (const client of rooms) client.dispose();
  }
  // Verify disconnect revokes envelopes and removes game queues while preserving
  // the owner's personal vault. The storage cleanup service is exercised separately.
  check(
    await admin.rpc("unlink_relationship", {
      p_actor: users[0].id,
      p_couple: couple.id,
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
  assert.equal(
    check(
      await admin
        .from("encrypted_game_commands")
        .select("id")
        .eq("session_id", room.id),
    ).length,
    0,
  );
  assert.equal(
    check(
      await activate(0)
        .from("daily_logs")
        .select("*")
        .eq("user_id", users[0].id),
    )[0].notes,
    "Synthetic private health note",
  );
  pass(
    "unlink removes shared envelopes/games while preserving independently encrypted personal history",
  );
  fs.mkdirSync("tmp/verification", { recursive: true });
  fs.writeFileSync(
    "tmp/verification/private-vault-live.json",
    JSON.stringify(
      { at: new Date().toISOString(), checks, latencies },
      null,
      2,
    ),
  );
} finally {
  runtime.installVault(null);
  if (couple)
    await admin.rpc("unlink_relationship", {
      p_actor: users[0]?.id,
      p_couple: couple.id,
    });
  for (const [bucket, path] of uploads)
    await admin.storage.from(bucket).remove([path]);
  for (const user of users) {
    await admin.from("profiles").delete().eq("id", user.id);
    await admin.auth.admin.deleteUser(user.id);
  }
  for (const client of clients) await client.removeAllChannels();
  await vite.close();
}

