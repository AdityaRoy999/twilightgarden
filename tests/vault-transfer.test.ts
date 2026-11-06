import { expect, it } from 'vitest';
import { createBundle } from '../lib/vaultCrypto';
import { approveVaultTransfer, deviceCodeHash, newDeviceSecret, normalizeDeviceCode, receiveVaultTransfer } from '../lib/vaultTransfer';

it('transfers the whole vault only with the local pairing secret, receiving key and correct request binding', async () => {
  const vault = await createBundle('owner', 'epoch'), receiver = await newDeviceSecret();
  expect(receiver.code).toHaveLength(16);
  expect(receiver.privateKey.extractable).toBe(false);
  expect(normalizeDeviceCode(receiver.code.match(/.{4}/g)!.join('-').toLowerCase())).toBe(receiver.code);
  expect(await deviceCodeHash(receiver.code)).toMatch(/^[a-f0-9]{64}$/);
  const envelope = await approveVaultTransfer(vault, 'request-1', receiver.publicKey, receiver.code);
  expect(JSON.stringify(envelope)).not.toContain(vault.master);
  expect(JSON.stringify(envelope)).not.toContain(receiver.code);
  expect(await receiveVaultTransfer(receiver.privateKey, vault.publicKey, receiver.code, 'owner', 'epoch', 'request-1', envelope)).toEqual(vault);
  const wrong = (receiver.code[0] === 'A' ? 'B' : 'A') + receiver.code.slice(1);
  for (const [code, owner, epoch, id] of [[wrong, 'owner', 'epoch', 'request-1'], [receiver.code, 'other', 'epoch', 'request-1'], [receiver.code, 'owner', 'new-epoch', 'request-1'], [receiver.code, 'owner', 'epoch', 'request-2']]) {
    await expect(receiveVaultTransfer(receiver.privateKey, vault.publicKey, code, owner, epoch, id, envelope)).rejects.toThrow();
  }
  const other = await newDeviceSecret();
  await expect(receiveVaultTransfer(other.privateKey, vault.publicKey, receiver.code, 'owner', 'epoch', 'request-1', envelope)).rejects.toThrow();
  const substituted = await createBundle('owner', 'epoch');
  await expect(receiveVaultTransfer(receiver.privateKey, substituted.publicKey, receiver.code, 'owner', 'epoch', 'request-1', envelope)).rejects.toThrow();
});
it('rejects malformed codes and private peer keys', async () => {
  expect(() => normalizeDeviceCode('123456')).toThrow();
  expect(() => normalizeDeviceCode('OOOO-0000-1111-IIII')).toThrow();
  const vault = await createBundle('owner', 'epoch'), receiver = await newDeviceSecret();
  await expect(approveVaultTransfer(vault, 'request', { ...receiver.publicKey, d: 'private' }, receiver.code)).rejects.toThrow();
});
