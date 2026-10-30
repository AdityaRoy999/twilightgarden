import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
vi.mock('../lib/securePreferences', () => ({ SecurePreferences: { get: vi.fn(), set: vi.fn() } }));
import { clearEncryptionCache, clearSharedKeyCache, decryptWithEphemeralKey, encryptMessage, decryptMessage, encryptData, decryptData, generateKeyPair, setCachedPrivateKey, initializeEncryptionKeys, getCachedPrivateKey } from '../lib/encryption';
import { SecurePreferences as Preferences } from '../lib/securePreferences';

beforeEach(() => { vi.stubGlobal('window', { crypto: webcrypto, atob, btoa }); clearEncryptionCache(); });
afterEach(() => vi.unstubAllGlobals());

describe('identity-key encryption', () => {
  it('binds private chat fields to their message and never displays a plaintext downgrade',async()=>{
    const a=await generateKeyPair(),b=await generateKeyPair();setCachedPrivateKey(a.privateKey);
    const cipher=await encryptMessage('private note',b.publicKey,'pair:note-1:content');
    const reactions=await encryptData([{user_id:'a',emoji:'❤️'}],b.publicKey,'pair:note-1:reactions');
    setCachedPrivateKey(b.privateKey);
    expect(await decryptMessage(cipher,a.publicKey,undefined,'pair:note-1:content')).toBe('private note');
    expect(await decryptMessage(cipher,a.publicKey,undefined,'pair:note-2:content')).toContain('🔐');
    expect(await decryptMessage('unencrypted server text',a.publicKey)).toContain('🔐');
    expect(await decryptData(reactions,a.publicKey,undefined,'pair:note-1:reactions')).toEqual([{user_id:'a',emoji:'❤️'}]);
    expect(await decryptData(reactions,a.publicKey,undefined,'pair:note-2:reactions')).toBeNull();
  });
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
    a.publicKey=btoa(JSON.stringify({...JSON.parse(atob(a.publicKey)),key_ops:[],ext:true}));
    b.publicKey=btoa(JSON.stringify({...JSON.parse(atob(b.publicKey)),key_ops:[],ext:true}));
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
