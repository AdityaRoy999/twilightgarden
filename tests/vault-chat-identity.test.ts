// @vitest-environment jsdom
import { webcrypto } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";
const storage = vi.hoisted(() => new Map<string, string>());
vi.mock("../lib/securePreferences", () => ({
  SecurePreferences: {
    get: async ({ key }: { key: string }) => ({
      value: storage.get(key) ?? null,
    }),
    set: async ({ key, value }: { key: string; value: string }) => {
      storage.set(key, value);
    },
    remove: async ({ key }: { key: string }) => {
      storage.delete(key);
    },
  },
}));
import { createBundle, aes, open, seal } from "../lib/vaultCrypto";
import { installVault } from "../lib/vaultRuntime";
import { generateKeyPair, clearEncryptionCache } from "../lib/encryption";
import {
  resolveVaultChatIdentity,
  vaultChatContext,
} from "../lib/vaultChatIdentity";
beforeEach(() => {
  storage.clear();
  clearEncryptionCache();
  Object.defineProperty(window, "crypto", {
    configurable: true,
    value: webcrypto,
  });
  vi.stubGlobal("crypto", webcrypto);
});
function client(row: any = null) {
  return {
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }),
      }),
    })),
    rpc: vi.fn(async () => ({ error: null })),
  } as any;
}
it("migrates a usable legacy local key under the account vault without changing its public identity", async () => {
  const vault = await createBundle("owner", "epoch");
  installVault(vault);
  const pair = await generateKeyPair();
  storage.set("owner_private_key", pair.privateKey);
  const db = client();
  const result = await resolveVaultChatIdentity(
    db,
    "owner",
    pair.publicKey,
    0,
    "device",
  );
  expect(result).toEqual({ publicKey: pair.publicKey, needsRestore: false });
  const payload = db.rpc.mock.calls[0][1];
  expect(payload.p_public_key).toBe(pair.publicKey);
  expect(
    await open(
      await aes(vault.master),
      payload.p_ciphertext,
      vaultChatContext("owner", "epoch", 0),
    ),
  ).toBe(pair.privateKey);
});
it("requires a one-time legacy import when a canonical key exists without a recoverable local key", async () => {
  installVault(await createBundle("owner", "epoch"));
  const pair = await generateKeyPair(),
    db = client();
  expect(
    await resolveVaultChatIdentity(db, "owner", pair.publicKey, 0, "device"),
  ).toEqual({ publicKey: null, needsRestore: true });
  expect(db.rpc).not.toHaveBeenCalled();
  expect(storage.has("owner_private_key")).toBe(false);
});
it("rejects a recovery envelope copied from an earlier conversation generation", async () => {
  const vault = await createBundle("owner", "epoch");
  installVault(vault);
  const pair = await generateKeyPair();
  const ciphertext = await seal(
    await aes(vault.master),
    pair.privateKey,
    vaultChatContext("owner", "epoch", 0),
  );
  const db = client({
    epoch: "epoch",
    identity_generation: 1,
    public_key: pair.publicKey,
    ciphertext,
  });
  await expect(
    resolveVaultChatIdentity(db, "owner", pair.publicKey, 1, "device"),
  ).rejects.toThrow();
  expect(db.rpc).not.toHaveBeenCalled();
});
