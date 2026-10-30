/** Client-only private content protocol. No server secret participates in decryption. */
export type VaultBundle = {
  v: 1;
  userId: string;
  epoch: string;
  master: string;
  privateKey: JsonWebKey;
  publicKey: JsonWebKey;
};
export type Sealed = { v: 1; iv: string; data: string };
export type VaultBackup = {
  v: 1;
  iterations: number;
  salt: string;
  sealed: Sealed;
};
const encoder = new TextEncoder(),
  decoder = new TextDecoder();
export function base64(bytes: Uint8Array): string {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text);
}
export function unbase64(text: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
}
export async function aes(raw: string): Promise<CryptoKey> {
  const bytes = unbase64(raw);
  if (bytes.length !== 32) throw new Error("Invalid private content key.");
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}
export async function seal(
  key: CryptoKey,
  value: unknown,
  context: string,
): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: encoder.encode(context),
      tagLength: 128,
    },
    key,
    encoder.encode(JSON.stringify(value)),
  );
  return { v: 1, iv: base64(iv), data: base64(new Uint8Array(data)) };
}
export async function open<T>(
  key: CryptoKey,
  envelope: Sealed,
  context: string,
): Promise<T> {
  if (
    envelope?.v !== 1 ||
    typeof envelope.data !== "string" ||
    unbase64(envelope.iv).length !== 12
  )
    throw new Error("Unsupported encrypted record.");
  return JSON.parse(
    decoder.decode(
      await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: unbase64(envelope.iv),
          additionalData: encoder.encode(context),
          tagLength: 128,
        },
        key,
        unbase64(envelope.data),
      ),
    ),
  ) as T;
}
export async function createBundle(
  userId: string,
  epoch: string,
): Promise<VaultBundle> {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );
  return {
    v: 1,
    userId,
    epoch,
    master: base64(crypto.getRandomValues(new Uint8Array(32))),
    privateKey: await crypto.subtle.exportKey("jwk", pair.privateKey),
    publicKey: await crypto.subtle.exportKey("jwk", pair.publicKey),
  };
}
export function backupContext(userId: string, epoch: string) {
  return `twilight:vault:1:${userId}:${epoch}`;
}
async function passwordKey(password: string, salt: string, iterations: number) {
  if (
    !Number.isInteger(iterations) ||
    iterations < 600000 ||
    iterations > 1000000 ||
    unbase64(salt).length !== 16
  )
    throw new Error("Unsupported backup parameters.");
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: unbase64(salt), iterations },
    key,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
export async function backupBundle(
  bundle: VaultBundle,
  password: string,
): Promise<VaultBackup> {
  if (password.length < 12 || password.length > 1024)
    throw new Error("Use a backup password with at least 12 characters.");
  const salt = base64(crypto.getRandomValues(new Uint8Array(16))),
    iterations = 600000;
  return {
    v: 1,
    salt,
    iterations,
    sealed: await seal(
      await passwordKey(password, salt, iterations),
      bundle,
      backupContext(bundle.userId, bundle.epoch),
    ),
  };
}
export async function restoreBundle(
  backup: VaultBackup,
  password: string,
  userId: string,
  epoch: string,
): Promise<VaultBundle> {
  if (backup?.v !== 1) throw new Error("Unsupported backup version.");
  const bundle = await open<VaultBundle>(
    await passwordKey(password, backup.salt, backup.iterations),
    backup.sealed,
    backupContext(userId, epoch),
  );
  if (
    bundle.v !== 1 ||
    bundle.userId !== userId ||
    bundle.epoch !== epoch ||
    unbase64(bundle.master).length !== 32
  )
    throw new Error("Backup identity does not match this account.");
  return bundle;
}
export async function sharingKey(
  bundle: VaultBundle,
  other: JsonWebKey,
  context: string,
) {
  const own = await crypto.subtle.importKey(
    "jwk",
    bundle.privateKey,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveBits"],
  );
  const peer = await crypto.subtle.importKey(
    "jwk",
    other,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: peer },
    own,
    256,
  );
  const material = await crypto.subtle.importKey("raw", bits, "HKDF", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: encoder.encode("twilight-private-sharing-v1"),
      info: encoder.encode(context),
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
export async function privateRecordId(
  bundle: VaultBundle,
  kind: string,
  logicalId: string,
) {
  const key = await crypto.subtle.importKey(
    "raw",
    unbase64(bundle.master),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return Array.from(
    new Uint8Array(
      await crypto.subtle.sign(
        "HMAC",
        key,
        encoder.encode(`${kind}:${logicalId}`),
      ),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
