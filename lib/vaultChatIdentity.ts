import type { SupabaseClient } from "@supabase/supabase-js";
import { aes, open, seal, type Sealed } from "./vaultCrypto";
import { unlockedVault } from "./vaultRuntime";
import { SecurePreferences as Preferences } from "./securePreferences";
import { derivePublicKeyFromPrivate } from "./encryption";
import {
  installRecoveredIdentity,
  reconcileIdentityGeneration,
  resolveDeviceIdentity,
  samePublicKey,
} from "./identity";

type Backup = {
  epoch: string;
  identity_generation: number;
  public_key: string;
  ciphertext: Sealed;
};
export function vaultChatContext(
  userId: string,
  epoch: string,
  generation: number,
) {
  return `twilight:vault-chat:1:${userId}:${epoch}:${generation}`;
}
/** The personal vault's existing password also recovers the independent chat key.
 * Unlink destroys this envelope and increments generation, never the personal vault. */
export async function resolveVaultChatIdentity(
  client: SupabaseClient<any>,
  userId: string,
  canonical: string | null,
  generation: number,
  deviceId: string,
  isCurrent = () => true,
) {
  const vault = unlockedVault();
  if (vault.userId !== userId)
    throw new Error("Unlock this account before opening chat.");
  const scopeKey = userId + "_chat_vault_scope";
  const { value: scope } = await Preferences.get({ key: scopeKey });
  if (scope !== vault.epoch) {
    // A dataset/account-vault reset can lower the server generation. Old local
    // counters cannot lock the fresh account, and retired keys cannot republish.
    if (!canonical) {
      await Preferences.remove({ key: userId + "_private_key" });
      await Preferences.remove({ key: userId + "_public_key" });
    }
    await Preferences.set({
      key: userId + "_chat_identity_generation",
      value: String(generation),
    });
    await Preferences.set({ key: scopeKey, value: vault.epoch });
  }
  await reconcileIdentityGeneration(userId, generation, isCurrent);
  if (!isCurrent()) throw new DOMException("Connection changed", "AbortError");
  const { data, error } = await client
    .from("vault_chat_backups")
    .select("epoch,identity_generation,public_key,ciphertext")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  const backup = data as Backup | null;
  let identity: { publicKey: string | null; needsRestore: boolean };
  if (backup) {
    if (
      backup.epoch !== vault.epoch ||
      backup.identity_generation !== generation
    )
      throw new Error(
        "Chat changed. Reopen it to sync the current connection.",
      );
    const privateKey = await open<string>(
      await aes(vault.master),
      backup.ciphertext,
      vaultChatContext(userId, vault.epoch, generation),
    );
    const publicKey = derivePublicKeyFromPrivate(privateKey);
    if (
      !samePublicKey(publicKey, backup.public_key) ||
      (canonical && !samePublicKey(publicKey, canonical))
    )
      throw new Error(
        "The encrypted chat identity does not match this connection.",
      );
    if (!isCurrent())
      throw new DOMException("Connection changed", "AbortError");
    await installRecoveredIdentity(userId, privateKey, canonical, generation);
    identity = { publicKey, needsRestore: false };
  } else {
    identity = await resolveDeviceIdentity(
      userId,
      canonical,
      isCurrent,
      generation,
    );
  }
  if (identity.needsRestore || !identity.publicKey) return identity;
  const { value: privateKey } = await Preferences.get({
    key: userId + "_private_key",
  });
  if (!privateKey || !isCurrent())
    throw new Error("Secure chat setup was interrupted. Retry.");
  const ciphertext =
    backup?.ciphertext ??
    (await seal(
      await aes(vault.master),
      privateKey,
      vaultChatContext(userId, vault.epoch, generation),
    ));
  const registration = await client.rpc("register_vault_chat_identity", {
    p_epoch: vault.epoch,
    p_generation: generation,
    p_public_key: identity.publicKey,
    p_ciphertext: ciphertext,
    p_device: deviceId,
    p_device_name:
      typeof navigator === "undefined"
        ? "Device"
        : navigator.platform || "Device",
  });
  if (registration.error) throw registration.error;
  if (!isCurrent()) throw new DOMException("Connection changed", "AbortError");
  return identity;
}
