import { Preferences } from "@capacitor/preferences";
import {
  derivePublicKeyFromPrivate,
  initializeEncryptionKeys,
  setCachedPrivateKey,
  clearEncryptionCache,
} from "./encryption";

export function samePublicKey(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  try {
    if (!a || !b) return false;
    const x = JSON.parse(atob(a)),
      y = JSON.parse(atob(b));
    return ["kty", "crv", "x", "y"].every((key) => x[key] === y[key]);
  } catch {
    return false;
  }
}
export async function resolveDeviceIdentity(
  userId: string,
  canonicalKey: string | null,
  isCurrent = () => true,
) {
  const { value: privateKey } = await Preferences.get({
    key: userId + "_private_key",
  });
  if (!isCurrent()) throw new Error("Identity initialization cancelled");
  if (privateKey) {
    const publicKey = derivePublicKeyFromPrivate(privateKey);
    if (!canonicalKey || samePublicKey(publicKey, canonicalKey)) {
      await Preferences.set({ key: userId + "_public_key", value: publicKey });
      if (!isCurrent()) throw new Error("Identity initialization cancelled");
      setCachedPrivateKey(privateKey);
      return { publicKey, needsRestore: false };
    }
  }
  if (canonicalKey) {
    clearEncryptionCache();
    return { publicKey: null, needsRestore: true };
  }
  return {
    publicKey: await initializeEncryptionKeys(userId),
    needsRestore: false,
  };
}
export async function installRecoveredIdentity(
  userId: string,
  privateKey: string,
  canonicalKey: string | null,
) {
  const publicKey = derivePublicKeyFromPrivate(privateKey);
  if (canonicalKey && !samePublicKey(publicKey, canonicalKey))
    throw new Error("This recovery key does not match your account identity.");
  await Preferences.set({ key: userId + "_private_key", value: privateKey });
  await Preferences.set({ key: userId + "_public_key", value: publicKey });
  setCachedPrivateKey(privateKey);
  return publicKey;
}
