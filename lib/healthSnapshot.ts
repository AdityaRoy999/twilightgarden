import { encryptData, getCachedPrivateKey } from './encryption';

// Health RPCs already persist the authorized, structured health fields. This
// legacy encrypted duplicate is optional and must not gate personal logging on
// a separate chat identity being unlocked on this device.
export async function encryptHealthSnapshot(payload: unknown, partnerKey: string | null) {
  if (!partnerKey || !getCachedPrivateKey()) return null;
  return encryptData(payload, partnerKey);
}
