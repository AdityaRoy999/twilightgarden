import {SecurePreferences as Preferences} from './securePreferences';
import {
  derivePublicKeyFromPrivate,
  initializeEncryptionKeys,
  setCachedPrivateKey,
  clearEncryptionCache,
} from "./encryption";

const identityTasks = new Map<string, Promise<unknown>>();
async function withIdentityLock<T>(userId:string, task:()=>Promise<T>):Promise<T> {
  const previous=identityTasks.get(userId);
  const pending=(async()=>{await previous?.catch(()=>{});return task();})();
  identityTasks.set(userId,pending);
  try{return await pending;}finally{if(identityTasks.get(userId)===pending)identityTasks.delete(userId);}
}

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
  generation = 0,
) {
  return withIdentityLock(userId,()=>resolveIdentityUnlocked(userId,canonicalKey,isCurrent,generation));
}
async function resolveIdentityUnlocked(userId:string,canonicalKey:string|null,isCurrent:()=>boolean,generation:number) {
  await reconcileGenerationUnlocked(userId, generation, isCurrent);
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

/** Offline devices discard the retired identity before publishing any key. */
export async function reconcileIdentityGeneration(userId: string, generation: number, isCurrent = () => true) {
  return withIdentityLock(userId,()=>reconcileGenerationUnlocked(userId,generation,isCurrent));
}
async function reconcileGenerationUnlocked(userId:string,generation:number,isCurrent:()=>boolean) {
  const marker = userId + '_chat_identity_generation';
  const { value } = await Preferences.get({ key: marker });
  if (!isCurrent()) throw new Error('Identity initialization cancelled');
  const parsed = Number(value || 0);
  const local = Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
  if (local > generation) throw new Error('Chat identity changed. Refresh and retry.');
  if (generation > local) {
    clearEncryptionCache();
    await Preferences.remove({ key: userId + '_private_key' });
    await Preferences.remove({ key: userId + '_public_key' });
  }
  if (!isCurrent()) throw new Error('Identity initialization cancelled');
  if (generation > local) await Preferences.set({ key: marker, value: String(generation) });
}
export async function installRecoveredIdentity(
  userId: string,
  privateKey: string,
  canonicalKey: string | null,
  generation?: number,
) {
  return withIdentityLock(userId,async()=>{
  if(generation!==undefined){
    const {value}=await Preferences.get({key:userId+'_chat_identity_generation'});
    if(Number(value||0)!==generation)throw new Error('This backup belongs to a reset conversation. Set up chat again.');
  }
  const publicKey = derivePublicKeyFromPrivate(privateKey);
  if (canonicalKey && !samePublicKey(publicKey, canonicalKey))
    throw new Error("This recovery key does not match your account identity.");
  await Preferences.set({ key: userId + "_private_key", value: privateKey });
  await Preferences.set({ key: userId + "_public_key", value: publicKey });
  setCachedPrivateKey(privateKey);
  return publicKey;
  });
}
