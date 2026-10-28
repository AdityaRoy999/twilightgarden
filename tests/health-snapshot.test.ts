import { beforeEach, expect, it, vi } from 'vitest';
const crypto = vi.hoisted(() => ({ key: null as string | null, encrypt: vi.fn() }));
vi.mock('../lib/encryption', () => ({ getCachedPrivateKey: () => crypto.key, encryptData: crypto.encrypt }));
import { encryptHealthSnapshot } from '../lib/healthSnapshot';
beforeEach(() => { crypto.key = null; crypto.encrypt.mockReset().mockResolvedValue('encrypted'); });
it('allows health saves on a device awaiting chat identity recovery', async () => {
  expect(await encryptHealthSnapshot({ notes: 'Edited previous record' }, 'partner-key')).toBeNull();
  expect(crypto.encrypt).not.toHaveBeenCalled();
});
it('keeps the encrypted duplicate when both encryption keys are available', async () => {
  crypto.key = 'own-key';
  expect(await encryptHealthSnapshot({ flow: 'light' }, 'partner-key')).toBe('encrypted');
  expect(crypto.encrypt).toHaveBeenCalledWith({ flow: 'light' }, 'partner-key');
});
it('does not disguise encryption failures after identity recovery', async () => {
  crypto.key = 'own-key'; crypto.encrypt.mockRejectedValue(new Error('Invalid partner key'));
  await expect(encryptHealthSnapshot({}, 'invalid')).rejects.toThrow('Invalid partner key');
});
