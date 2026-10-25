import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
vi.mock('@capacitor/preferences', () => ({ Preferences: { get: vi.fn(), set: vi.fn() } }));
import { clearEncryptionCache, clearSharedKeyCache, decryptWithEphemeralKey, encryptMessage, generateKeyPair, setCachedPrivateKey, initializeEncryptionKeys, getCachedPrivateKey } from '../lib/encryption';
import { Preferences } from '@capacitor/preferences';

beforeEach(() => { vi.stubGlobal('window', { crypto: webcrypto, atob, btoa }); clearEncryptionCache(); });
afterEach(() => vi.unstubAllGlobals());

describe('identity-key encryption', () => {
  it('cannot repopulate the previous account identity after logout', async () => {
    let release!: (value: {value:string}) => void;
    vi.mocked(Preferences.get).mockImplementationOnce(() => new Promise(resolve => {release=resolve;})).mockResolvedValue({value:'old-private-key'});
    const pending=initializeEncryptionKeys('previous-account');
    clearEncryptionCache();release({value:'old-public-key'});
    await expect(pending).rejects.toThrow(/cancelled/);
    expect(getCachedPrivateKey()).toBeNull();
  });
  it('keeps two recipients separate even when their serialized keys have the same suffix', async () => {
    const own = await generateKeyPair(), a = await generateKeyPair(), b = await generateKeyPair();
    expect(a.publicKey.slice(-20)).toBe(b.publicKey.slice(-20));
    setCachedPrivateKey(own.privateKey);
    await encryptMessage('for the first recipient', a.publicKey);
    const ciphertext = await encryptMessage('for the second recipient 🌸', b.publicKey);
    expect(await decryptWithEphemeralKey(ciphertext, b.privateKey, own.publicKey)).toBe('for the second recipient 🌸');
    await expect(decryptWithEphemeralKey(ciphertext, a.privateKey, own.publicKey)).rejects.toThrow();
  });
  it('preserves decryption after cache reset', async () => {
    const own = await generateKeyPair(), other = await generateKeyPair();
    setCachedPrivateKey(own.privateKey);
    const ciphertext = await encryptMessage('persistent history', other.publicKey);
    clearSharedKeyCache();
    expect(await decryptWithEphemeralKey(ciphertext, other.privateKey, own.publicKey)).toBe('persistent history');
  });
  it('rejects encryption without an initialized identity', async () => {
    const other = await generateKeyPair();
    await expect(encryptMessage('private', other.publicKey)).rejects.toThrow('Private key missing');
  });
});
