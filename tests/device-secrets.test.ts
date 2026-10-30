// @vitest-environment node
import { indexedDB } from "fake-indexeddb";
import { beforeAll, expect, it, vi } from "vitest";
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => false },
}));
vi.mock("capacitor-secure-storage-plugin", () => ({
  SecureStoragePlugin: { get: vi.fn(), set: vi.fn() },
}));
import { DeviceSecrets } from "../lib/deviceSecrets";
beforeAll(() => {
  vi.stubGlobal("indexedDB", indexedDB);
});
it("wraps browser credentials with a non-extractable key, without using localStorage", async () => {
  await Promise.all([
    DeviceSecrets.set("account-secret-a", "synthetic private credential"),
    DeviceSecrets.set("account-secret-b", "another secret"),
  ]);
  expect(await DeviceSecrets.get("account-secret-a")).toBe(
    "synthetic private credential",
  );
  expect(await DeviceSecrets.get("account-secret-b")).toBe("another secret");
  const db = await new Promise<IDBDatabase>((resolve) => {
    const r = indexedDB.open("twilight-device-secrets", 1);
    r.onsuccess = () => resolve(r.result);
  });
  const read = (key: string) =>
    new Promise<any>((resolve) => {
      const r = db.transaction("secrets").objectStore("secrets").get(key);
      r.onsuccess = () => resolve(r.result);
    });
  const stored = await read("account-secret-a");
  expect(stored.v).toBe(1);
  expect(JSON.stringify(stored)).not.toContain("private credential");
  const key = await read("device-wrapping-key");
  expect(key.extractable).toBe(false);
  await expect(crypto.subtle.exportKey("raw", key)).rejects.toThrow();
  db.close();
  await DeviceSecrets.remove("account-secret-a");
  expect(await DeviceSecrets.get("account-secret-a")).toBeNull();
});
