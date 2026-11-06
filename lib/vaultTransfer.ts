import { base64, unbase64, open, seal, type Sealed, type VaultBundle } from './vaultCrypto';

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const encoder = new TextEncoder();
export function normalizeDeviceCode(value: string) {
  const code = value.replace(/[\s-]/g, '').toUpperCase();
  if (!/^[A-HJ-NP-Z2-9]{16}$/.test(code)) throw new Error('Enter the 16-character code shown on your new device.');
  return code;
}
export async function deviceCodeHash(value: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(normalizeDeviceCode(value)))), b => b.toString(16).padStart(2, '0')).join('');
}
export async function newDeviceSecret() {
  const code = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => alphabet[b & 31]).join('');
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
  return { code, privateKey: pair.privateKey, publicKey: await crypto.subtle.exportKey('jwk', pair.publicKey) };
}
function context(userId: string, epoch: string, requestId: string) {
  return `twilight:vault-device:1:${userId}:${epoch}:${requestId}`;
}
async function transferKey(privateKey: CryptoKey, publicKey: JsonWebKey, code: string, binding: string) {
  if (publicKey.d || publicKey.kty !== 'EC' || publicKey.crv !== 'P-256') throw new Error('Invalid device key.');
  const peer = await crypto.subtle.importKey('jwk', publicKey, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const bits = await crypto.subtle.deriveBits({ name: 'ECDH', public: peer }, privateKey, 256);
  const material = await crypto.subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey']);
  // The plaintext pairing secret never reaches the server. It authenticates the
  // ECDH exchange, including against substitution of the request's public key.
  return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: encoder.encode(normalizeDeviceCode(code)), info: encoder.encode(binding) }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function approveVaultTransfer(bundle: VaultBundle, requestId: string, requester: JsonWebKey, code: string) {
  const own = await crypto.subtle.importKey('jwk', bundle.privateKey, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
  const binding = context(bundle.userId, bundle.epoch, requestId);
  return seal(await transferKey(own, requester, code, binding), bundle, binding);
}
export async function receiveVaultTransfer(privateKey: CryptoKey, sender: JsonWebKey, code: string, userId: string, epoch: string, requestId: string, envelope: Sealed) {
  const binding = context(userId, epoch, requestId);
  const bundle = await open<VaultBundle>(await transferKey(privateKey, sender, code, binding), envelope, binding);
  if (bundle.v !== 1 || bundle.userId !== userId || bundle.epoch !== epoch || unbase64(bundle.master).length !== 32 || bundle.publicKey.x !== sender.x || bundle.publicKey.y !== sender.y || bundle.privateKey.x !== sender.x || bundle.privateKey.y !== sender.y || !bundle.privateKey.d) throw new Error('The device identity did not match your vault.');
  return bundle;
}
