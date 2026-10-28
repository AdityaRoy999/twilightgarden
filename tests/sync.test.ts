import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
const preferences = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("@capacitor/preferences", () => ({ Preferences: preferences }));
import {
  generateKeyPair,
  clearEncryptionCache,
  getCachedPrivateKey,
  encryptIdentityWithPin,
  decryptIdentityWithPin,
  generateVerificationFingerprint,
  decryptMessage,
} from "../lib/encryption";
import {
  resolveDeviceIdentity,
  installRecoveredIdentity,
  reconcileIdentityGeneration,
} from "../lib/identity";
import { mergeChatNotes, cursorFilter } from "../lib/chat";
import type { SharedNote } from "../types";
beforeEach(() => {
  vi.stubGlobal("window", { crypto: webcrypto, atob, btoa });
  clearEncryptionCache();
  preferences.get.mockReset();
  preferences.set.mockReset().mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllGlobals());
describe("stable identity and recovery", () => {
  it('does not recache a retired private key from an in-flight message read',async()=>{
    const old=await generateKeyPair();
    let finish!:(value:{value:string})=>void;
    preferences.get.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
    const read=decryptMessage('unused',old.publicKey,'A');
    clearEncryptionCache();finish({value:old.privateKey});
    await read;
    expect(getCachedPrivateKey()).toBeNull();
  });
  it('discards a retired local identity before initializing a fresh link', async () => {
    const old = await generateKeyPair();
    const store = new Map<string,string>([['A_private_key',old.privateKey],['A_public_key',old.publicKey],['A_chat_identity_generation','0']]);
    preferences.get.mockImplementation(async({key})=>({value:store.get(key)||null}));
    preferences.set.mockImplementation(async({key,value})=>{store.set(key,value);});
    preferences.remove.mockImplementation(async({key})=>{store.delete(key);});
    const next=await resolveDeviceIdentity('A',null,()=>true,1);
    expect(next.needsRestore).toBe(false);
    expect(next.publicKey).not.toBe(old.publicKey);
    expect(store.get('A_chat_identity_generation')).toBe('1');
    expect(store.get('A_private_key')).not.toBe(old.privateKey);
  });
  it('does not erase a current-generation identity on a normal refresh',async()=>{
    preferences.get.mockResolvedValue({value:'2'});preferences.remove.mockClear();
    await reconcileIdentityGeneration('A',2);
    expect(preferences.remove).not.toHaveBeenCalled();
  });
  it('rejects a stale server snapshot rather than downgrading the identity generation',async()=>{
    preferences.get.mockResolvedValue({value:'2'});preferences.remove.mockClear();
    await expect(reconcileIdentityGeneration('A',1)).rejects.toThrow('changed');
    expect(preferences.remove).not.toHaveBeenCalled();
  });
  it('rejects an old restore that finishes after the local unlink reset',async()=>{
    const old=await generateKeyPair();
    preferences.get.mockResolvedValue({value:'1'});
    await expect(installRecoveredIdentity('A',old.privateKey,old.publicKey,0)).rejects.toThrow('reset conversation');
    expect(getCachedPrivateKey()).toBeNull();
    expect(preferences.set).not.toHaveBeenCalled();
  });
  it("does not generate or publish a replacement identity on a new device", async () => {
    const canonical = await generateKeyPair();
    preferences.get.mockResolvedValue({ value: null });
    expect(await resolveDeviceIdentity("A", canonical.publicKey)).toEqual({
      publicKey: null,
      needsRestore: true,
    });
    expect(preferences.set).not.toHaveBeenCalled();
    expect(getCachedPrivateKey()).toBeNull();
  });
  it("blocks mismatching local keys until the canonical identity is restored", async () => {
    const canonical = await generateKeyPair(),
      wrong = await generateKeyPair();
    preferences.get.mockResolvedValue({ value: wrong.privateKey });
    expect(
      (await resolveDeviceIdentity("A", canonical.publicKey)).needsRestore,
    ).toBe(true);
    await expect(
      installRecoveredIdentity("A", wrong.privateKey, canonical.publicKey),
    ).rejects.toThrow(/match/);
    await installRecoveredIdentity(
      "A",
      canonical.privateKey,
      canonical.publicKey,
    );
    expect(getCachedPrivateKey()).toBe(canonical.privateKey);
  });
  it("restores the same private identity with its passphrase and rejects wrong credentials", async () => {
    const key = await generateKeyPair();
    const backup = await encryptIdentityWithPin(
      key.privateKey,
      "synthetic-passphrase",
    );
    expect(
      await decryptIdentityWithPin(
        backup.ciphertext,
        "synthetic-passphrase",
        backup.salt,
      ),
    ).toBe(key.privateKey);
    await expect(
      decryptIdentityWithPin(
        backup.ciphertext,
        "wrong-passphrase",
        backup.salt,
      ),
    ).rejects.toThrow();
  });
  it("verifies the same fingerprint across JWK metadata formats", async () => {
    const a = await generateKeyPair(),
      b = await generateKeyPair();
    const formatted = btoa(
      JSON.stringify({
        ...JSON.parse(atob(a.publicKey)),
        key_ops: [],
        ext: true,
      }),
    );
    expect(
      await generateVerificationFingerprint(a.publicKey, b.publicKey),
    ).toBe(await generateVerificationFingerprint(b.publicKey, formatted));
  });
});
describe("message reconciliation", () => {
  const note = (id: string, status: SharedNote["status"] = "sent") =>
    ({
      id,
      status,
      created_at: "2026-10-26T00:00:00.000Z",
      content: "Synthetic",
      sender_id: "A",
      couple_id: "pair",
    }) as SharedNote;
  it("deduplicates retries and never rolls read receipts back", () => {
    const current = [{ ...note("a", "read"), localStatus: "sending" as const }];
    const merged = mergeChatNotes(
      current,
      [note("a", "delivered"), note("b")],
      "A",
    );
    expect(merged).toHaveLength(2);
    expect(merged[0].status).toBe("read");
    expect(merged[0].localStatus).toBeUndefined();
  });
  it("orders identical timestamps by ID and honors per-user deletion", () => {
    const deleted = { ...note("c"), deleted_by: ["A"] };
    expect(
      mergeChatNotes([note("b")], [note("a"), deleted], "A").map((n) => n.id),
    ).toEqual(["a", "b"]);
  });
  it("includes the message ID in history pagination cursors", () => {
    expect(
      cursorFilter(note("c43eb5d5-d67b-4f4b-a9e8-ab99b6e734c9")),
    ).toContain("id.lt.c43eb5d5");
    expect(() => cursorFilter(note("invalid)"))).toThrow();
  });
});
