import { Capacitor } from "@capacitor/core";
import { SecureStoragePlugin } from "capacitor-secure-storage-plugin";
import { seal, open, type Sealed } from "./vaultCrypto";

// The plugin's web implementation is deliberately never used. Browser secrets
// are wrapped with a non-extractable device key in IndexedDB, not localStorage.
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("twilight-device-secrets", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("secrets");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function read(key: string) {
  const db = await database();
  try {
    return await new Promise<any>((resolve, reject) => {
      const req = db.transaction("secrets").objectStore("secrets").get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}
async function write(key: string, value: unknown, remove = false) {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("secrets", "readwrite");
      if (remove) tx.objectStore("secrets").delete(key);
      else tx.objectStore("secrets").put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
let wrapping: Promise<CryptoKey> | undefined;
async function deviceKey() {
  return (wrapping ??= (async () => {
    const candidate = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"],
      ),
      db = await database();
    try {
      return await new Promise<CryptoKey>((resolve, reject) => {
        const tx = db.transaction("secrets", "readwrite"),
          store = tx.objectStore("secrets"),
          request = store.get("device-wrapping-key");
        let key: CryptoKey;
        request.onsuccess = () => {
          key = request.result || candidate;
          if (!request.result) store.put(key, "device-wrapping-key");
        };
        tx.oncomplete = () => resolve(key);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  })().catch((e) => {
    wrapping = undefined;
    throw e;
  }));
}
export const DeviceSecrets = {
  async get(key: string): Promise<string | null> {
    if (Capacitor.isNativePlatform()) {
      try {
        return (await SecureStoragePlugin.get({ key })).value;
      } catch (error) {
        // contains distinguishes a missing entry from a locked or failing Keychain.
        if (!(await SecureStoragePlugin.keys()).value.includes(key))
          return null;
        throw error;
      }
    }
    const value = (await read(key)) as Sealed | undefined;
    return value ? open<string>(await deviceKey(), value, key) : null;
  },
  async set(key: string, value: string) {
    if (Capacitor.isNativePlatform()) {
      await SecureStoragePlugin.set({ key, value });
      return;
    }
    await write(key, await seal(await deviceKey(), value, key));
  },
  async remove(key: string) {
    if (Capacitor.isNativePlatform()) {
      if ((await SecureStoragePlugin.keys()).value.includes(key))
        await SecureStoragePlugin.remove({ key });
      return;
    }
    await write(key, null, true);
  },
};
