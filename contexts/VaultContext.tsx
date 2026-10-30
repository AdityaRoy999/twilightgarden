import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useAuth } from "./AuthContext";
import { usePrivacy } from "./PrivacyContext";
import { rawSupabase } from "../lib/supabase";
import {
  backupBundle,
  createBundle,
  restoreBundle,
  type VaultBackup,
  type VaultBundle,
} from "../lib/vaultCrypto";
import { installVault, optionalVault } from "../lib/vaultRuntime";
import { DeviceSecrets } from "../lib/deviceSecrets";
import {
  refreshPrivateShares,
  invalidatePrivatePeer,
  savePrivateRow,
  invalidatePrivateRecords,
} from "../lib/privateData";
type VaultRow = {
  user_id: string;
  epoch: string;
  public_key: JsonWebKey;
  backup: VaultBackup;
};
type Value = {
  ready: boolean;
  loading: boolean;
  exists: boolean;
  error: string;
  refresh: () => Promise<void>;
  unlock: (password: string) => Promise<void>;
  create: (password: string, name?: string) => Promise<void>;
};
const Context = createContext<Value | null>(null);
export function VaultProvider({ children }: { children: React.ReactNode }) {
  const { user, dataEpoch, refreshUser } = useAuth(),
    { preferences } = usePrivacy();
  const [ready, setReady] = useState(false),
    [loading, setLoading] = useState(true),
    [row, setRow] = useState<VaultRow | null>(null),
    [error, setError] = useState("");
  const version = useRef(0),
    alive = useRef(true);
  const userId = useRef(user?.id);
  userId.current = user?.id;
  const admitted =
    preferences?.age_band === "18+" &&
    preferences?.core_consent &&
    !preferences?.deleting;
  const rememberKey = (epoch: string) =>
    `personal-vault:${dataEpoch}:${user?.id}:${epoch}`;
  const activate = async (bundle: VaultBundle) => {
    const revision = version.current;
    await DeviceSecrets.set(rememberKey(bundle.epoch), JSON.stringify(bundle));
    if (
      !alive.current ||
      userId.current !== bundle.userId ||
      revision !== version.current
    )
      throw new DOMException("Account changed", "AbortError");
    installVault(bundle);
    setReady(true);
    // Hydrate name/avatar only after unlocking. The auth cache remains metadata-only.
    void refreshUser();
  };
  const refresh = useCallback(async () => {
    const revision = ++version.current;
    setError("");
    if (!user || !admitted) {
      installVault(null);
      setReady(false);
      setRow(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await rawSupabase
        .from("account_vaults" as any)
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      if (!alive.current || revision !== version.current) return;
      const value = data as unknown as VaultRow | null;
      setRow(value);
      if (value) {
        const saved = await DeviceSecrets.get(rememberKey(value.epoch));
        if (saved) {
          const bundle = JSON.parse(saved) as VaultBundle;
          if (
            bundle.userId !== user.id ||
            bundle.epoch !== value.epoch ||
            bundle.publicKey.x !== value.public_key.x ||
            bundle.publicKey.y !== value.public_key.y
          )
            throw new Error(
              "Device vault does not match the account. Unlock with your backup password.",
            );
          if (!alive.current || revision !== version.current) return;
          await activate(bundle);
        } else {
          installVault(null);
          setReady(false);
        }
      } else {
        installVault(null);
        setReady(false);
      }
    } catch {
      if (alive.current && revision === version.current)
        setError(
          "Your encrypted vault could not be loaded. Check your connection and retry.",
        );
    } finally {
      if (alive.current && revision === version.current) setLoading(false);
    }
  }, [user?.id, dataEpoch, admitted]);
  useEffect(() => {
    alive.current = true;
    void refresh();
    return () => {
      alive.current = false;
      version.current++;
      installVault(null);
    };
  }, [refresh]);
  const unlock = async (password: string) => {
    if (!row || !user) throw new Error("No backup is available.");
    let bundle: VaultBundle;
    try {
      bundle = await restoreBundle(row.backup, password, user.id, row.epoch);
    } catch {
      throw new Error(
        "That backup password could not unlock this vault. Check it and try again.",
      );
    }
    if (
      bundle.publicKey.x !== row.public_key.x ||
      bundle.publicKey.y !== row.public_key.y
    )
      throw new Error("Backup key mismatch.");
    await activate(bundle);
  };
  const create = async (password: string, name = "") => {
    if (!user || !admitted || row)
      throw new Error(
        "A vault already exists. Unlock it to keep your records.",
      );
    const bundle = await createBundle(user.id, crypto.randomUUID()),
      backup = await backupBundle(bundle, password);
    const { error } = await rawSupabase.from("account_vaults" as any).insert({
      user_id: user.id,
      epoch: bundle.epoch,
      public_key: bundle.publicKey,
      backup,
    });
    if (error) {
      await refresh();
      throw new Error(
        "Your vault could not be created. Retry, or unlock the vault if it was created on another device.",
      );
    }
    setRow({
      user_id: user.id,
      epoch: bundle.epoch,
      public_key: bundle.publicKey,
      backup,
    });
    await activate(bundle);
    if (name.trim()) {
      await savePrivateRow("profile", "profile", {
        id: user.id,
        full_name: name.trim().slice(0, 100),
      });
      void refreshUser();
    }
  };
  useEffect(() => {
    if (!ready || !user) return;
    let stopped = false,
      busy = false,
      shared = false;
    invalidatePrivatePeer();
    const share = async () => {
      if (stopped || busy || !optionalVault()) return;
      busy = true;
      try {
        shared = await refreshPrivateShares();
      } catch (e) {
        if (!stopped)
          setError(
            e instanceof Error
              ? e.message
              : "Private sharing could not be updated.",
          );
      } finally {
        busy = false;
      }
    };
    const channel = rawSupabase
      .channel(`private-shares:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "couples" },
        () => {
          shared = false;
          invalidatePrivatePeer();
          void share();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "private_records",
          filter: `owner_id=eq.${user.id}`,
        },
        (payload: any) => {
          const record = payload.new?.kind ? payload.new : payload.old;
          if (record?.kind) invalidatePrivateRecords(user.id, record.kind);
        },
      )
      .subscribe();
    const timer = setInterval(() => {
      if (!shared && document.visibilityState === "visible") void share();
    }, 10000);
    const resume = () => {
      if (document.visibilityState === "visible") void share();
    };
    window.addEventListener("focus", resume);
    void share();
    return () => {
      stopped = true;
      clearInterval(timer);
      void rawSupabase.removeChannel(channel);
      window.removeEventListener("focus", resume);
    };
  }, [ready, user?.id, preferences?.share_health]);
  return (
    <Context.Provider
      value={{
        ready: ready && optionalVault()?.userId === user?.id,
        loading,
        exists: !!row,
        error,
        refresh,
        unlock,
        create,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useVault() {
  const value = useContext(Context);
  if (!value) throw new Error("VaultProvider missing");
  return value;
}
