import type { SupabaseClient } from "@supabase/supabase-js";
import {
  aes,
  base64,
  open,
  seal,
  sharingKey,
  privateRecordId,
  type Sealed,
} from "./vaultCrypto";
import { unlockedVault, optionalVault, onVaultClear } from "./vaultRuntime";
import { DeviceSecrets } from "./deviceSecrets";
import { CiphertextCache } from "./ciphertextCache";

export type RecordKind =
  "daily_logs" | "health_settings" | "preferences" | "profile" | "request";
export type PrivateRecord = {
  id: string;
  owner_id: string;
  kind: RecordKind;
  epoch: string;
  ciphertext: Sealed;
  owner_key: Sealed;
  recipient_id: string | null;
  couple_id: string | null;
  recipient_key: Sealed | null;
  revision: number;
};
let client: SupabaseClient<any>;
export function configurePrivateData(raw: SupabaseClient<any>) {
  client = raw;
}
type Peer = {
  userId: string;
  coupleId: string;
  publicKey: JsonWebKey;
  shareHealth: boolean;
};
const documents = new Map<string, PrivateRecord>();
const pending = new Map<string, Promise<PrivateRecord[]>>();
const scopeVersions = new Map<string, number>();
const ciphertextCache = new CiphertextCache<PrivateRecord[]>();
const derivedKeys = new Map<string, Promise<CryptoKey>>();
let vaultRevision = 0;
function memoKey(id: string, derive: () => Promise<CryptoKey>) {
  const previous = derivedKeys.get(id);
  if (previous) return previous;
  const promise = derive().catch((error) => {
    if (derivedKeys.get(id) === promise) derivedKeys.delete(id);
    throw error;
  });
  if (derivedKeys.size >= 32)
    derivedKeys.delete(derivedKeys.keys().next().value!);
  derivedKeys.set(id, promise);
  return promise;
}
function ownerWrappingKey() {
  const b = unlockedVault();
  return memoKey(`${b.userId}:${b.epoch}:owner`, () => aes(b.master));
}
function peerWrappingKey(publicKey: JsonWebKey, coupleId: string) {
  const b = unlockedVault();
  return memoKey(
    `${b.userId}:${b.epoch}:${coupleId}:${publicKey.x}:${publicKey.y}`,
    () => sharingKey(b, publicKey, coupleId),
  );
}
export function invalidatePrivateRecords(owner: string, kind: RecordKind) {
  const scope = `${owner}:${kind}`;
  ciphertextCache.delete(scope);
  pending.delete(scope);
  scopeVersions.set(scope, (scopeVersions.get(scope) || 0) + 1);
}
onVaultClear(() => {
  vaultRevision++;
  ciphertextCache.clear();
  derivedKeys.clear();
  scopeVersions.clear();
  documents.clear();
  pending.clear();
  for (const url of blobPointers.keys()) URL.revokeObjectURL(url);
  blobPointers.clear();
});
const healthKinds = new Set<RecordKind>(["daily_logs", "health_settings"]);
let peerPending: Promise<Peer | null> | null = null,
  peerExpiry = 0;
export function invalidatePrivatePeer() {
  peerPending = null;
  peerExpiry = 0;
}
onVaultClear(invalidatePrivatePeer);
export async function getPrivatePeer(): Promise<Peer | null> {
  if (peerPending && Date.now() < peerExpiry) return peerPending;
  peerExpiry = Date.now() + 5000;
  const job = loadPeer();
  peerPending = job;
  try {
    return await job;
  } catch (error) {
    if (peerPending === job) invalidatePrivatePeer();
    throw error;
  }
}
async function loadPeer(): Promise<Peer | null> {
  const bundle = unlockedVault();
  const { data, error } = await client
    .from("couples")
    .select("id,partner_1_id,partner_2_id,share_enabled")
    .eq("status", "active")
    .or(`partner_1_id.eq.${bundle.userId},partner_2_id.eq.${bundle.userId}`)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const userId =
    data.partner_1_id === bundle.userId ? data.partner_2_id : data.partner_1_id;
  if (!userId) return null;
  const result = await client.rpc("get_vault_public_key", { p_user: userId });
  if (result.error) throw result.error;
  if (!result.data) return null;
  const key = result.data.public_key as JsonWebKey;
  const pin = `vault-peer:${bundle.userId}:${data.id}:${userId}`;
  const encoded = JSON.stringify({ x: key.x, y: key.y });
  const previous = await DeviceSecrets.get(pin);
  if (previous && previous !== encoded)
    throw new Error(
      "Your partner’s private-data key changed. Disconnect and verify a fresh connection before sharing.",
    );
  if (!previous) await DeviceSecrets.set(pin, encoded);
  const privacy = await client
    .from("privacy_preferences")
    .select("share_health")
    .eq("user_id", bundle.userId)
    .single();
  if (privacy.error) throw privacy.error;
  return {
    userId,
    coupleId: data.id,
    publicKey: key,
    shareHealth: data.share_enabled && privacy.data.share_health,
  };
}
const context = (
  record: Pick<PrivateRecord, "id" | "owner_id" | "kind" | "epoch">,
) =>
  `twilight:record:1:${record.owner_id}:${record.epoch}:${record.kind}:${record.id}`;
export async function decryptRecord(record: PrivateRecord): Promise<any> {
  const bundle = unlockedVault(),
    aad = context(record);
  let raw: string;
  if (record.owner_id === bundle.userId) {
    if (record.epoch !== bundle.epoch)
      throw new Error("This record belongs to a different vault.");
    raw = await open<string>(
      await ownerWrappingKey(),
      record.owner_key,
      aad + ":owner",
    );
  } else {
    if (
      record.recipient_id !== bundle.userId ||
      !record.recipient_key ||
      !record.couple_id
    )
      throw new Error("This record is not shared with your vault.");
    const other = await getPrivatePeer();
    if (
      other?.userId !== record.owner_id ||
      other.coupleId !== record.couple_id
    )
      throw new Error("The shared connection is no longer available.");
    raw = await open<string>(
      await peerWrappingKey(other.publicKey, record.couple_id),
      record.recipient_key,
      aad + ":recipient",
    );
  }
  const value = await open<any>(await aes(raw), record.ciphertext, aad);
  if (value.avatar_url)
    value.avatar_url = await resolvePrivateAvatar(value.avatar_url);
  return value;
}
export async function encryptedRecords(
  owner: string,
  kind: RecordKind,
  attempt = 0,
): Promise<PrivateRecord[]> {
  const bundle = unlockedVault(),
    revision = vaultRevision;
  const scope = `${owner}:${kind}`;
  const scopeVersion = scopeVersions.get(scope) || 0;
  // Cache only the owner's own envelopes. Shared reads always recheck RLS.
  if (owner === bundle.userId) {
    const cached = ciphertextCache.get(scope);
    if (cached) return cached;
  }
  const existing = pending.get(scope);
  if (existing) return existing;
  const job = (async () => {
    const all: PrivateRecord[] = [];
    let offset = 0;
    while (true) {
      const { data, error } = await client
        .from("private_records")
        .select("*")
        .eq("owner_id", owner)
        .eq("kind", kind)
        .order("id")
        .range(offset, offset + 499);
      if (error) throw error;
      all.push(...data);
      if (data.length < 500) break;
      offset += 500;
    }
    if (revision !== vaultRevision || optionalVault()?.userId !== bundle.userId)
      throw new DOMException("Vault changed", "AbortError");
    if (scopeVersion !== (scopeVersions.get(scope) || 0)) {
      if (attempt >= 2)
        throw new Error("Private records changed while loading. Please retry.");
      return encryptedRecords(owner, kind, attempt + 1);
    }
    for (const r of all) documents.set(r.id, r);
    if (owner === bundle.userId && revision === vaultRevision)
      ciphertextCache.set(scope, all);
    return all;
  })();
  pending.set(scope, job);
  try {
    return await job;
  } finally {
    if (pending.get(scope) === job) pending.delete(scope);
  }
}
export async function readPrivateRows(owner: string, kind: RecordKind) {
  return Promise.all((await encryptedRecords(owner, kind)).map(decryptRecord));
}
export async function preparePrivateRecord(
  kind: RecordKind,
  logicalId: string,
  value: any,
  sharing?: Peer | null,
): Promise<PrivateRecord> {
  const bundle = unlockedVault(),
    id = await privateRecordId(bundle, kind, logicalId),
    existing = documents.get(id);
  const record: PrivateRecord = {
    id,
    owner_id: bundle.userId,
    kind,
    epoch: bundle.epoch,
    ciphertext: null as any,
    owner_key: null as any,
    recipient_id: null,
    couple_id: null,
    recipient_key: null,
    revision: existing?.revision || 0,
  };
  const aad = context(record),
    raw = base64(crypto.getRandomValues(new Uint8Array(32)));
  const payload = { ...value };
  if (payload.avatar_url)
    payload.avatar_url =
      blobPointers.get(payload.avatar_url) || payload.avatar_url;
  record.ciphertext = await seal(await aes(raw), payload, aad);
  record.owner_key = await seal(await ownerWrappingKey(), raw, aad + ":owner");
  const other = sharing === undefined ? await getPrivatePeer() : sharing;
  if (
    other &&
    (kind === "profile" || (healthKinds.has(kind) && other.shareHealth))
  ) {
    record.recipient_id = other.userId;
    record.couple_id = other.coupleId;
    record.recipient_key = await seal(
      await peerWrappingKey(other.publicKey, other.coupleId),
      raw,
      aad + ":recipient",
    );
  }
  return record;
}
export async function savePrivateBatch(records: PrivateRecord[]) {
  const { error } = await client.rpc("save_private_records", {
    p_records: records,
  });
  for (const record of records)
    invalidatePrivateRecords(record.owner_id, record.kind);
  if (error) {
    for (const record of records) documents.delete(record.id);
    throw error;
  }
  for (const record of records)
    documents.set(record.id, { ...record, revision: record.revision + 1 });
}
export async function savePrivateRow(
  kind: RecordKind,
  logicalId: string,
  value: any,
) {
  await encryptedRecords(unlockedVault().userId, kind);
  await savePrivateBatch([await preparePrivateRecord(kind, logicalId, value)]);
}
/** Only an unlocked owner can grant record keys. The server cannot backfill them. */
export async function refreshPrivateShares() {
  const bundle = unlockedVault(),
    other = await getPrivatePeer();
  if (!other) return false;
  for (const kind of ["profile", "health_settings", "daily_logs"] as const) {
    const records = await encryptedRecords(bundle.userId, kind);
    const changes: PrivateRecord[] = [];
    for (const record of records) {
      const shouldShare = kind === "profile" || other.shareHealth;
      if (
        shouldShare &&
        record.recipient_id === other.userId &&
        record.couple_id === other.coupleId
      )
        continue;
      if (!shouldShare && !record.recipient_key) continue;
      // Rotate the content key on a sharing change. No personal master key is shared.
      const value = await decryptRecord(record);
      const logicalId = kind === "daily_logs" ? value.date : kind;
      changes.push(
        await preparePrivateRecord(
          kind,
          logicalId,
          value,
          shouldShare ? other : null,
        ),
      );
      if (changes.length === 50) {
        await savePrivateBatch(changes.splice(0));
      }
    }
    if (changes.length) await savePrivateBatch(changes);
  }
  return true;
}
type AvatarPointer = {
  v: 1;
  path: string;
  key: string;
  iv: string;
  type: string;
};
const blobPointers = new Map<string, string>();
export async function encryptPrivateAvatar(file: File, userId: string) {
  const bundle = unlockedVault();
  if (bundle.userId !== userId) throw new Error("Avatar owner mismatch.");
  const raw = base64(crypto.getRandomValues(new Uint8Array(32))),
    iv = crypto.getRandomValues(new Uint8Array(12)),
    path = `${userId}/${crypto.randomUUID()}`;
  const data = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(path) },
    await aes(raw),
    await file.arrayBuffer(),
  );
  const { error } = await client.storage
    .from("private-media")
    .upload(path, new Blob([data], { type: "application/octet-stream" }), {
      contentType: "application/octet-stream",
    });
  if (error) throw error;
  const pointer =
    "private-avatar:" +
    JSON.stringify({
      v: 1,
      path,
      key: raw,
      iv: base64(iv),
      type: file.type,
    } satisfies AvatarPointer);
  const url = URL.createObjectURL(file);
  blobPointers.set(url, pointer);
  return url;
}
export async function resolvePrivateAvatar(pointer: string): Promise<string> {
  if (!pointer.startsWith("private-avatar:")) {
    if (pointer.startsWith("blob:") && blobPointers.has(pointer))
      return pointer;
    return "";
  }
  for (const [url, p] of blobPointers) if (p === pointer) return url;
  const ref = JSON.parse(pointer.slice(15)) as AvatarPointer;
  if (
    ref.v !== 1 ||
    !ref.path.match(/^[a-f0-9-]+\/[a-f0-9-]+$/) ||
    !["image/png", "image/jpeg", "image/webp"].includes(ref.type)
  )
    throw new Error("Invalid private avatar.");
  const { data, error } = await client.storage
    .from("private-media")
    .download(ref.path);
  if (error) throw error;
  const bytes = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: Uint8Array.from(atob(ref.iv), (c) => c.charCodeAt(0)),
      additionalData: new TextEncoder().encode(ref.path),
    },
    await aes(ref.key),
    await data.arrayBuffer(),
  );
  const url = URL.createObjectURL(new Blob([bytes], { type: ref.type }));
  blobPointers.set(url, pointer);
  return url;
}
export function privateDataReady() {
  return !!optionalVault();
}
