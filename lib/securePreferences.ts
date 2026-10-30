import { DeviceSecrets } from "./deviceSecrets";
import { Preferences as LegacyPreferences } from "@capacitor/preferences";
/** Preferences-compatible API for identity material; no plaintext fallback. */
export const SecurePreferences = {
  async get({ key }: { key: string }) {
    let value = await DeviceSecrets.get(key);
    if (value === null) {
      const legacy = await LegacyPreferences.get({ key });
      if (legacy.value !== null) {
        await DeviceSecrets.set(key, legacy.value);
        await LegacyPreferences.remove({ key });
        value = legacy.value;
      }
    }
    return { value };
  },
  async set({ key, value }: { key: string; value: string }) {
    await DeviceSecrets.set(key, value);
    await LegacyPreferences.remove({ key });
  },
  async remove({ key }: { key: string }) {
    await DeviceSecrets.remove(key);
    await LegacyPreferences.remove({ key });
  },
};
