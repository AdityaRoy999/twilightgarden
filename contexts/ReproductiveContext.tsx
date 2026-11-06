import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useAuth } from "./AuthContext";
import { usePrivacy } from "./PrivacyContext";
import { useVault } from "./VaultContext";
import { rawSupabase } from "../lib/supabase";
import { onVaultClear } from "../lib/vaultRuntime";
import { invalidatePrivateRecords } from "../lib/privateData";
import {
  defaultHealthSettings,
  validateHealthEntry,
  validateHealthSettings,
  type HealthEntry,
  type HealthSettings,
} from "../lib/reproductiveHealth";
import {
  readHealthRecords,
  saveHealthRecord,
  pendingHealthCount,
  flushHealthQueue,
  discardHealthQueue,
} from "../lib/healthStore";
import { scheduleReproductiveReminders } from "../lib/reproductiveReminders";
type Value = {
  settings: HealthSettings;
  entries: HealthEntry[];
  loading: boolean;
  error: string;
  pending: number;
  refresh: () => Promise<void>;
  saveSettings: (s: HealthSettings) => Promise<void>;
  saveEntry: (e: HealthEntry) => Promise<void>;
  removeEntry: (e: HealthEntry) => Promise<void>;
  discard: () => Promise<void>;
};
const Context = createContext<Value | null>(null);
export function ReproductiveProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { preferences } = usePrivacy();
  const allowed = preferences?.health_consent === true;
  const { user } = useAuth(),
    vault = useVault();
  const [settings, setSettings] = useState(defaultHealthSettings),
    [entries, setEntries] = useState<HealthEntry[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [pending, setPending] = useState(0);
  const version = useRef(0);
  const identity = `${user?.id}:${vault.epoch}:${vault.ready}:${allowed}`;
  const refresh = useCallback(async () => {
    const rev = ++version.current;
    if (!user || !vault.ready || !allowed || user.role === "partner") {
      setEntries([]);
      setSettings(defaultHealthSettings);
      setLoading(false);
      setPending(0);
      return;
    }
    try {
      let syncError = "";
      if (navigator.onLine) {
        try {
          await flushHealthQueue();
        } catch (e) {
          syncError =
            (e as { code?: string }).code === "40001"
              ? "An offline edit conflicts with another device. Export your visible entries before discarding local edits. No server records were overwritten."
              : "Pending edits could not sync. Your encrypted changes are kept on this device.";
        }
      }
      const [s, e, p] = await Promise.all([
        readHealthRecords("reproductive_settings"),
        readHealthRecords("reproductive_entries"),
        pendingHealthCount(),
      ]);
      if (rev !== version.current) return;
      setSettings(s[0] || defaultHealthSettings);
      setEntries(
        e
          .filter((x) => !x.deleted)
          .sort((a, b) => b.date.localeCompare(a.date)),
      );
      setPending(p);
      setError(syncError);
    } catch (e) {
      if (rev === version.current) {
        setError(
          (e as { code?: string }).code === "40001"
            ? "An offline edit conflicts with another device. Export your pending entries before discarding local edits. No server records were overwritten."
            : "Health records could not sync. Your encrypted pending edits are kept on this device.",
        );
        try {
          setPending(await pendingHealthCount());
        } catch {}
      }
    } finally {
      if (rev === version.current) setLoading(false);
    }
  }, [identity]);
  useEffect(() => {
    setLoading(true);
    void refresh();
    return () => {
      version.current++;
    };
  }, [refresh]);
  useEffect(
    () =>
      onVaultClear(() => {
        version.current++;
        setEntries([]);
        setSettings(defaultHealthSettings);
        setPending(0);
        setError("");
      }),
    [],
  );
  useEffect(() => {
    if (!user || !vault.ready || !allowed || user.role === "partner") return;
    let timer: ReturnType<typeof setTimeout>;
    const load = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void refresh(), 150);
    };
    const resume = () => {
      if (document.visibilityState === "visible") load();
    };
    window.addEventListener("online", load);
    document.addEventListener("visibilitychange", resume);
    const c = rawSupabase
      .channel(`reproductive:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "private_records",
          filter: `owner_id=eq.${user.id}`,
        },
        (payload: any) => {
          if (payload.new?.kind?.startsWith("reproductive_")) {
            invalidatePrivateRecords(user.id, payload.new.kind);
            load();
          }
        },
      )
      .subscribe();
    return () => {
      clearTimeout(timer);
      window.removeEventListener("online", load);
      document.removeEventListener("visibilitychange", resume);
      void rawSupabase.removeChannel(c);
    };
  }, [identity, refresh]);
  const saveSettings = async (s: HealthSettings) => {
    validateHealthSettings(s);
    await saveHealthRecord("reproductive_settings", s);
    setSettings(s);
    setPending(await pendingHealthCount());
  };
  useEffect(() => {
    if (!vault.ready || loading || !allowed || user?.role === "partner") return;
    const schedule = () => {
      void scheduleReproductiveReminders(entries, settings).catch(() =>
        setError(
          "Journal saved, but device reminders could not be scheduled. Check notification permissions.",
        ),
      );
    };
    schedule();
    window.addEventListener("twilight-private-preferences", schedule);
    return () =>
      window.removeEventListener("twilight-private-preferences", schedule);
  }, [identity, loading, entries, settings]);
  const saveEntry = async (e: HealthEntry) => {
    validateHealthEntry(e);
    await saveHealthRecord("reproductive_entries", e);
    setEntries((old) =>
      [e, ...old.filter((x) => x.id !== e.id)].sort((a, b) =>
        b.date.localeCompare(a.date),
      ),
    );
    setPending(await pendingHealthCount());
  };
  const removeEntry = async (e: HealthEntry) => {
    await saveHealthRecord("reproductive_entries", {
      ...e,
      title: "",
      notes: "",
      values: {},
      deleted: true,
      shareWithPartner: false,
    });
    setEntries((old) => old.filter((x) => x.id !== e.id));
    setPending(await pendingHealthCount());
  };
  const discard = async () => {
    await discardHealthQueue();
    await refresh();
  };
  return (
    <Context.Provider
      value={{
        settings,
        entries,
        loading,
        error,
        pending,
        refresh,
        saveSettings,
        saveEntry,
        removeEntry,
        discard,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useReproductive() {
  const c = useContext(Context);
  if (!c) throw new Error("Health provider unavailable");
  return c;
}
