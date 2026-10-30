import type { VaultBundle } from "./vaultCrypto";
let current: VaultBundle | null = null;
const cleaners = new Set<() => void>();
export function unlockedVault() {
  if (!current)
    throw new Error("Unlock your private vault before accessing private data.");
  return current;
}
export function optionalVault() {
  return current;
}
export function installVault(bundle: VaultBundle | null) {
  current = bundle;
  for (const clean of cleaners) clean();
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event("twilight-vault-change"));
}
export function onVaultClear(clean: () => void) {
  cleaners.add(clean);
  return () => {
    cleaners.delete(clean);
  };
}
