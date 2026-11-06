// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  vault: { userId: "alice", epoch: "epoch-a" },
  online: false,
  secrets: new Map<string, string>(),
  rows: [] as any[],
  save: vi.fn(),
  prepare: vi.fn(),
  decrypt: vi.fn(),
}));
vi.mock("../lib/deviceSecrets", () => ({
  DeviceSecrets: {
    get: vi.fn(async (k: string) => h.secrets.get(k) || null),
    set: vi.fn(async (k: string, v: string) => {
      h.secrets.set(k, v);
    }),
  },
}));
vi.mock("../lib/vaultRuntime", () => ({
  unlockedVault: () => ({ ...h.vault }),
  optionalVault: () => ({ ...h.vault }),
}));
vi.mock("../lib/privateData", () => ({
  encryptedRecords: vi.fn(async () => h.rows),
  invalidatePrivateRecords: vi.fn(),
  readPrivateRows: vi.fn(async () => [{ cycle_length: 29 }]),
  preparePrivateRecord: h.prepare,
  decryptRecord: h.decrypt,
  savePrivateBatch: h.save,
}));
import {
  saveHealthRecord,
  readHealthRecords,
  pendingHealthCount,
  flushHealthQueue,
} from "../lib/healthStore";
const entry = (id = "one") => ({
  id,
  category: "fertility" as const,
  date: "2026-11-06",
  title: "",
  notes: "private observation",
  values: { temperature: 36.5 },
  shareWithPartner: false,
});
beforeEach(() => {
  h.vault = { userId: "alice", epoch: "epoch-a" };
  h.online = false;
  h.secrets.clear();
  h.rows = [];
  vi.clearAllMocks();
  vi.stubGlobal("navigator", {
    get onLine() {
      return h.online;
    },
  });
  h.prepare.mockImplementation(async (kind, id, value) => ({
    id,
    kind,
    revision: 0,
    ciphertext: { data: `sealed-${id}` },
    recipient_id: null,
  }));
  h.decrypt.mockImplementation(async (r: any) => ({ id: r.id }));
  h.save.mockResolvedValue(undefined);
});
it("queues ciphertext only, preserves concurrent edits and isolates accounts and epochs", async () => {
  await Promise.all([
    saveHealthRecord("reproductive_entries", entry("one")),
    saveHealthRecord("reproductive_entries", entry("two")),
  ]);
  expect(await pendingHealthCount()).toBe(2);
  expect([...h.secrets.values()].join()).not.toContain("private observation");
  expect(
    (await readHealthRecords("reproductive_entries")).map((x) => x.id),
  ).toEqual(["one", "two"]);
  h.vault = { userId: "bob", epoch: "epoch-a" };
  expect(await pendingHealthCount()).toBe(0);
  h.vault = { userId: "alice", epoch: "epoch-b" };
  expect(await pendingHealthCount()).toBe(0);
});
it("retains conflicting edits and never silently overwrites a newer server revision", async () => {
  h.rows = [
    {
      id: "one",
      kind: "reproductive_entries",
      revision: 4,
      ciphertext: { data: "old" },
    },
  ];
  h.online = true;
  await readHealthRecords("reproductive_entries");
  h.online = false;
  await saveHealthRecord("reproductive_entries", entry());
  h.online = true;
  h.save.mockRejectedValueOnce(
    Object.assign(new Error("conflict"), { code: "40001" }),
  );
  await expect(flushHealthQueue()).rejects.toThrow("conflict");
  expect(h.save.mock.calls[0][0][0].revision).toBe(4);
  expect(await pendingHealthCount()).toBe(1);
  await flushHealthQueue();
  expect(await pendingHealthCount()).toBe(0);
});
it("refuses new offline sharing and mode changes that would leave a partner with stale estimates", async () => {
  await expect(
    saveHealthRecord("reproductive_entries", {
      ...entry(),
      shareWithPartner: true,
      shareCoupleId: "pair",
    }),
  ).rejects.toThrow("Go online");
  await expect(
    saveHealthRecord("reproductive_settings", {
      id: "reproductive_settings",
      mode: "postpartum",
    }),
  ).rejects.toThrow("Go online");
  expect(await pendingHealthCount()).toBe(0);
});
it("saves mode and calendar suppression together, preserving other cycle settings", async () => {
  h.online = true;
  await saveHealthRecord("reproductive_settings", {
    id: "reproductive_settings",
    mode: "postpartum",
  });
  expect(h.save).toHaveBeenCalledTimes(1);
  expect(h.save.mock.calls[0][0]).toHaveLength(2);
  expect(h.prepare).toHaveBeenCalledWith("health_settings", "health_settings", {
    cycle_length: 29,
    calendar_estimates_paused: true,
  });
});
it("stops a pending save if the vault changes during encryption", async () => {
  h.prepare.mockImplementationOnce(async () => {
    h.vault = { userId: "bob", epoch: "epoch-b" };
    return {
      id: "one",
      kind: "reproductive_entries",
      ciphertext: { data: "sealed" },
    };
  });
  await expect(
    saveHealthRecord("reproductive_entries", entry()),
  ).rejects.toThrow("Vault changed");
  expect(h.secrets.size).toBe(0);
  expect(h.save).not.toHaveBeenCalled();
});
