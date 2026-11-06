import { DeviceSecrets } from "./deviceSecrets";
import {
  decryptRecord,
  encryptedRecords,
  readPrivateRows,
  invalidatePrivateRecords,
  preparePrivateRecord,
  savePrivateBatch,
  type PrivateRecord,
} from "./privateData";
import { unlockedVault, optionalVault } from "./vaultRuntime";
import type { HealthEntry, HealthSettings } from "./reproductiveHealth";

type Kind = "reproductive_settings" | "reproductive_entries";
type Identity = { userId: string; epoch: string };
const key = (identity: Identity, part: string) =>
  `health-sync:${identity.userId}:${identity.epoch}:${part}`;
function assertIdentity(identity: Identity) {
  const current = optionalVault();
  if (
    !current ||
    current.userId !== identity.userId ||
    current.epoch !== identity.epoch
  )
    throw new Error("Vault changed.");
}
async function stored(
  identity: Identity,
  part: string,
): Promise<PrivateRecord[]> {
  assertIdentity(identity);
  const value = JSON.parse(
    (await DeviceSecrets.get(key(identity, part))) || "[]",
  );
  assertIdentity(identity);
  return value;
}
async function put(identity: Identity, part: string, records: PrivateRecord[]) {
  assertIdentity(identity);
  await DeviceSecrets.set(key(identity, part), JSON.stringify(records));
  assertIdentity(identity);
}
const offline = () => typeof navigator !== "undefined" && !navigator.onLine;

// Serialize queue changes: a flush and an offline save must not erase one another.
const writes = new Map<string, Promise<unknown>>();
function serialize<T>(
  identity: Identity,
  action: () => Promise<T>,
): Promise<T> {
  const scope = key(identity, "pending");
  const task = (writes.get(scope) || Promise.resolve())
    .catch(() => {})
    .then(action);
  writes.set(scope, task);
  void task
    .finally(() => {
      if (writes.get(scope) === task) writes.delete(scope);
    })
    .catch(() => {});
  return task;
}

export async function readHealthRecords(kind: Kind) {
  const identity = unlockedVault();
  let records: PrivateRecord[];
  if (offline()) records = await stored(identity, kind);
  else {
    invalidatePrivateRecords(identity.userId, kind);
    records = await encryptedRecords(identity.userId, kind);
    await put(identity, kind, records);
  }
  const pending = (await stored(identity, "pending")).filter(
    (r) => r.kind === kind,
  );
  const all = new Map(records.map((r) => [r.id, r]));
  for (const r of pending) all.set(r.id, r);
  const result = await Promise.all([...all.values()].map(decryptRecord));
  assertIdentity(identity);
  return result;
}
export async function pendingHealthCount() {
  return (await stored(unlockedVault(), "pending")).length;
}

export async function saveHealthRecord(
  kind: Kind,
  value: HealthEntry | HealthSettings,
) {
  const identity = unlockedVault();
  return serialize(identity, async () => {
    assertIdentity(identity);
    const isOffline = offline();
    if (kind === "reproductive_settings" && isOffline)
      throw new Error(
        "Go online to change health modes, so calendar estimates update on both sides together.",
      );
    // A grant must be checked online against the current connection and consent.
    if (isOffline && "shareWithPartner" in value && value.shareWithPartner)
      throw new Error("Go online to share or change a shared entry.");
    const snapshot = await stored(identity, kind),
      pending = await stored(identity, "pending");
    if (!isOffline) await encryptedRecords(identity.userId, kind);
    assertIdentity(identity);
    const record = await preparePrivateRecord(
      kind,
      value.id,
      value,
      isOffline ? null : undefined,
    );
    assertIdentity(identity);
    const old =
      pending.find((r) => r.id === record.id) ||
      snapshot.find((r) => r.id === record.id);
    if (isOffline) {
      record.revision = old?.revision || 0;
      await put(identity, "pending", [
        ...pending.filter((r) => r.id !== record.id),
        record,
      ]);
      return "queued" as const;
    }
    if (pending.some((r) => r.id === record.id))
      throw new Error(
        "Sync or discard the pending edit before editing this entry again.",
      );
    if (kind === "reproductive_settings") {
      const current =
        (await readPrivateRows(identity.userId, "health_settings"))[0] || {};
      assertIdentity(identity);
      const mode = (value as HealthSettings).mode;
      const cycle = await preparePrivateRecord(
        "health_settings",
        "health_settings",
        {
          ...current,
          calendar_estimates_paused: [
            "pregnancy",
            "postpartum",
            "contraception",
            "perimenopause",
          ].includes(mode),
        },
      );
      assertIdentity(identity);
      await savePrivateBatch([record, cycle]);
    } else await savePrivateBatch([record]);
    assertIdentity(identity);
    await put(identity, kind, [
      ...snapshot.filter((r) => r.id !== record.id),
      { ...record, revision: record.revision + 1 },
    ]);
    return "saved" as const;
  });
}
export function flushHealthQueue() {
  const identity = unlockedVault();
  return serialize(identity, async () => {
    const pending = await stored(identity, "pending");
    for (const record of pending) {
      assertIdentity(identity);
      // The server rejects stale revisions; never silently overwrite a newer edit.
      await savePrivateBatch([record]);
      const snapshot = await stored(identity, record.kind);
      await put(identity, record.kind, [
        ...snapshot.filter((r) => r.id !== record.id),
        { ...record, revision: record.revision + 1 },
      ]);
      const latest = await stored(identity, "pending");
      await put(
        identity,
        "pending",
        latest.filter(
          (r) =>
            r.id !== record.id || r.ciphertext.data !== record.ciphertext.data,
        ),
      );
    }
  });
}
export async function discardHealthQueue() {
  const identity = unlockedVault();
  await serialize(identity, () => put(identity, "pending", []));
}
