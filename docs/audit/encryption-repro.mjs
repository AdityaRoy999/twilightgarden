import { webcrypto } from 'node:crypto';
import { createServer } from 'vite';
globalThis.window = {crypto:webcrypto, btoa:globalThis.btoa, atob:globalThis.atob};
const server = await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'error'});
try {
  const m = await server.ssrLoadModule('/lib/encryption.ts');
  const own = await m.generateKeyPair();
  const first = await m.generateKeyPair();
  const second = await m.generateKeyPair();
  m.setCachedPrivateKey(own.privateKey);
  await m.encryptMessage('first recipient',first.publicKey);
  const ciphertext = await m.encryptMessage('second recipient',second.publicKey);
  let cachedDecrypts = false;
  try { cachedDecrypts = (await m.decryptWithEphemeralKey(ciphertext,second.privateKey,own.publicKey)) === 'second recipient'; } catch {}
  m.clearSharedKeyCache();
  const fresh = await m.encryptMessage('second recipient',second.publicKey);
  let freshDecrypts = false;
  try { freshDecrypts = (await m.decryptWithEphemeralKey(fresh,second.privateKey,own.publicKey)) === 'second recipient'; } catch {}
  console.log(JSON.stringify({differentPartnerKeys:first.publicKey!==second.publicKey,cacheIdentifiersCollide:first.publicKey.slice(-20)===second.publicKey.slice(-20),secondRecipientDecryptsWithCache:cachedDecrypts,secondRecipientDecryptsAfterCacheClear:freshDecrypts},null,2));
} finally { await server.close(); }
