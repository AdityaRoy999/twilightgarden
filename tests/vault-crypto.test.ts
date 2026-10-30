// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  createBundle,
  aes,
  seal,
  open,
  backupBundle,
  restoreBundle,
  privateRecordId,
  sharingKey,
} from "../lib/vaultCrypto";
describe("private vault protocol", () => {
  it("keeps private values and dates out of the envelope and rejects swapping/tampering", async () => {
    const vault = await createBundle("owner", "epoch"),
      key = await aes(vault.master);
    const a = await seal(
      key,
      { date: "2026-10-23", notes: "private text" },
      "record-a",
    );
    const b = await seal(
      key,
      { date: "2026-10-23", notes: "private text" },
      "record-a",
    );
    expect(a.iv).not.toBe(b.iv);
    expect(JSON.stringify(a)).not.toContain("private text");
    expect(JSON.stringify(a)).not.toContain("2026-10-23");
    expect(await open(key, a, "record-a")).toEqual({
      date: "2026-10-23",
      notes: "private text",
    });
    await expect(open(key, a, "record-b")).rejects.toThrow();
    await expect(
      open(
        key,
        { ...a, data: (a.data[0] === "A" ? "B" : "A") + a.data.slice(1) },
        "record-a",
      ),
    ).rejects.toThrow();
    const stranger = await createBundle("stranger", "epoch");
    await expect(
      open(await aes(stranger.master), a, "record-a"),
    ).rejects.toThrow();
  });
  it("recovers on a new device only with the backup password and matching account/epoch", async () => {
    const bundle = await createBundle("owner", "epoch"),
      backup = await backupBundle(bundle, "a separate recovery password");
    expect(JSON.stringify(backup)).not.toContain(bundle.master);
    expect(JSON.stringify(backup)).not.toContain("recovery password");
    expect(
      await restoreBundle(
        backup,
        "a separate recovery password",
        "owner",
        "epoch",
      ),
    ).toEqual(bundle);
    await expect(
      restoreBundle(backup, "wrong password", "owner", "epoch"),
    ).rejects.toThrow();
    await expect(
      restoreBundle(backup, "a separate recovery password", "other", "epoch"),
    ).rejects.toThrow();
    await expect(
      restoreBundle(
        backup,
        "a separate recovery password",
        "owner",
        "new-epoch",
      ),
    ).rejects.toThrow();
    await expect(
      restoreBundle(
        { ...backup, iterations: 100 },
        "a separate recovery password",
        "owner",
        "epoch",
      ),
    ).rejects.toThrow();
  });
  it("shares a record key with a peer without handing out the owner master key", async () => {
    const alice = await createBundle("a", "epoch-a"),
      bob = await createBundle("b", "epoch-b"),
      eve = await createBundle("e", "epoch-e");
    const sent = await seal(
      await sharingKey(alice, bob.publicKey, "couple-1"),
      "record-key",
      "wrap",
    );
    expect(
      await open(
        await sharingKey(bob, alice.publicKey, "couple-1"),
        sent,
        "wrap",
      ),
    ).toBe("record-key");
    await expect(
      open(await sharingKey(eve, alice.publicKey, "couple-1"), sent, "wrap"),
    ).rejects.toThrow();
    await expect(
      open(await sharingKey(bob, alice.publicKey, "couple-2"), sent, "wrap"),
    ).rejects.toThrow();
    expect(await privateRecordId(alice, "daily_logs", "2026-10-23")).toBe(
      await privateRecordId(alice, "daily_logs", "2026-10-23"),
    );
    expect(await privateRecordId(alice, "daily_logs", "2026-10-23")).not.toBe(
      await privateRecordId(bob, "daily_logs", "2026-10-23"),
    );
  });
});
