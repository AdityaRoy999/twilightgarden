import React, { useEffect, useRef, useState } from "react";
import QRCode from "react-qr-code";
import { X, KeyRound, Smartphone, Check, ArrowRight } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useCouples } from "../contexts/CouplesContext";
import { supabase } from "../lib/supabase";
import { createSyncSession } from "../lib/sync";
import { decryptWithEphemeralKey } from "../lib/encryption";
import { installRecoveredIdentity } from "../lib/identity";
import { useDialogFocus } from "../hooks/useDialogFocus";

export function SyncHistoryModal({
  isOpen,
  onClose,
  initialTab = "backup",
}: {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: "sync" | "backup";
}) {
  const dialog = useRef<HTMLElement>(null);
  useDialogFocus(dialog, isOpen);
  const { user } = useAuth();
  const {
    isSyncRequired,
    hasCloudBackup,
    setupCloudBackup,
    restoreFromCloudBackup,
    completeSyncHandshake,
    refreshE2EE,
  } = useCouples();
  const [passphrase, setPassphrase] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState(false);
  const [linkCode, setLinkCode] = useState(""),
    [approveCode, setApproveCode] = useState(""),
    [showDevices, setShowDevices] = useState(initialTab === "sync");
  const [expired, setExpired] = useState(false);
  const revision = useRef(0),
    channel = useRef<ReturnType<typeof supabase.channel> | null>(null),
    sessionId = useRef<string | null>(null),
    expiry = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (isOpen) {
      setLinkCode("");
      setApproveCode("");
      setExpired(false);
      setError("");
      setDone(false);
      setPassphrase("");
      setConfirmation("");
      setShowDevices(initialTab === "sync");
    }
    return () => {
      revision.current++;
      clearTimeout(expiry.current);
      if (channel.current) void supabase.removeChannel(channel.current);
      channel.current = null;
      if (sessionId.current)
        void supabase
          .from("sync_sessions")
          .delete()
          .eq("id", sessionId.current)
          .then(() => {});
      sessionId.current = null;
    };
  }, [isOpen, user?.id]);
  const unlock = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (isSyncRequired) await restoreFromCloudBackup(passphrase);
      else {
        if (passphrase !== confirmation)
          throw new Error("The passphrases do not match.");
        await setupCloudBackup(passphrase);
      }
      setPassphrase("");
      setConfirmation("");
      setDone(true);
    } catch (error) {
      setError(
        isSyncRequired
          ? "Could not unlock. Check your recovery passphrase or use a trusted device."
          : error instanceof Error
            ? error.message
            : "Could not protect your history. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  };
  const linkDevice = async () => {
    if (!user || busy) return;
    setBusy(true);
    setError("");
    setLinkCode("");
    setExpired(false);
    const current = ++revision.current;
    try {
      if (channel.current) void supabase.removeChannel(channel.current);
      if (sessionId.current)
        await supabase
          .from("sync_sessions")
          .delete()
          .eq("id", sessionId.current);
      const { session, ephemeralPrivate } = await createSyncSession(user.id);
      if (current !== revision.current) return;
      sessionId.current = session.id;
      let consuming = false;
      const consume = async (updated: {
        status?: string;
        encrypted_payload?: string | null;
      }) => {
        if (
          consuming ||
          updated.status !== "completed" ||
          !updated.encrypted_payload ||
          current !== revision.current
        )
          return;
        consuming = true;
        try {
          const envelope = JSON.parse(updated.encrypted_payload);
          if (envelope.version !== 1)
            throw new Error("Unsupported history link");
          const canonical = await supabase.rpc("get_chat_public_key", {
            p_user_id: user.id,
          });
          if (canonical.error) throw canonical.error;
          const key = await decryptWithEphemeralKey(
            envelope.ciphertext,
            ephemeralPrivate,
            envelope.senderPublicKey,
          );
          if (current !== revision.current) return;
          await installRecoveredIdentity(user.id, key, canonical.data);
          await refreshE2EE();
          if (current !== revision.current) return;
          await supabase.from("sync_sessions").delete().eq("id", session.id);
          sessionId.current = null;
          setDone(true);
          clearTimeout(expiry.current);
        } catch {
          setError(
            "Could not verify this device link. Generate a new code and retry.",
          );
          consuming = false;
        }
      };
      channel.current = supabase
        .channel("device_link_" + session.id)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "sync_sessions",
            filter: "id=eq." + session.id,
          },
          (event) => {
            void consume(event.new);
          },
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED" && current === revision.current) {
            setLinkCode(session.token);
            void supabase
              .from("sync_sessions")
              .select("status,encrypted_payload")
              .eq("id", session.id)
              .single()
              .then(({ data }) => {
                if (data) void consume(data);
              });
          }
        });
      expiry.current = setTimeout(
        () => {
          setExpired(true);
          setLinkCode("");
        },
        10 * 60 * 1000,
      );
    } catch {
      setError("Could not create a device link. Please retry.");
    } finally {
      setBusy(false);
    }
  };
  if (!isOpen) return null;
  const field =
    "h-12 w-full rounded-xl border border-gray-200 bg-transparent px-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-white/10";
  return (
    <div
      className="fixed inset-0 z-[250] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <section
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-title"
        className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-3xl bg-[#fdfcf8] p-6 text-gray-900 shadow-xl dark:bg-[#211e27] dark:text-white"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          aria-label="Close history setup"
          onClick={onClose}
          className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5"
        >
          <X size={20} />
        </button>
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          {done ? <Check /> : <KeyRound />}
        </div>
        <h2 id="history-title" className="pr-6 text-2xl font-semibold">
          {done
            ? "History is ready"
            : isSyncRequired
              ? "Unlock your history"
              : hasCloudBackup
                ? "Recovery passphrase"
                : "Protect your history"}
        </h2>
        {done ? (
          <>
            <p className="my-4 text-sm leading-relaxed text-gray-500">
              Your messages use the same encryption identity on this device. New
              messages and saved history will sync automatically.
            </p>
            <button
              onClick={onClose}
              className="h-12 w-full rounded-xl bg-primary font-semibold text-white"
            >
              Continue
            </button>
          </>
        ) : (
          <>
            <p className="mb-5 mt-3 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
              {isSyncRequired
                ? "Enter your recovery passphrase once. Your saved conversations will load automatically."
                : "Choose a passphrase to unlock your conversations when you sign in on a new device. Save it somewhere safe; we cannot recover it."}
            </p>
            {error && (
              <p
                role="alert"
                className="mb-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-500"
              >
                {error}
              </p>
            )}
            {(!isSyncRequired || hasCloudBackup) && (
              <form onSubmit={unlock} className="space-y-4">
                <div>
                  <label
                    htmlFor="recovery-passphrase"
                    className="mb-2 block text-sm font-medium"
                  >
                    Recovery passphrase
                  </label>
                  <input
                    autoFocus
                    id="recovery-passphrase"
                    type="password"
                    autoComplete={
                      isSyncRequired ? "current-password" : "new-password"
                    }
                    minLength={isSyncRequired ? 6 : 8}
                    maxLength={128}
                    required
                    value={passphrase}
                    onChange={(event) => setPassphrase(event.target.value)}
                    className={field}
                  />
                </div>
                {!isSyncRequired && (
                  <div>
                    <label
                      htmlFor="recovery-confirmation"
                      className="mb-2 block text-sm font-medium"
                    >
                      Confirm passphrase
                    </label>
                    <input
                      id="recovery-confirmation"
                      type="password"
                      autoComplete="new-password"
                      required
                      value={confirmation}
                      onChange={(event) => setConfirmation(event.target.value)}
                      className={field}
                    />
                  </div>
                )}
                <button
                  disabled={busy}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busy
                    ? "Please wait…"
                    : isSyncRequired
                      ? "Unlock history"
                      : hasCloudBackup
                        ? "Update recovery passphrase"
                        : "Protect history"}
                  {!busy && <ArrowRight size={17} />}
                </button>
              </form>
            )}
            <button
              onClick={() => setShowDevices((v) => !v)}
              aria-expanded={showDevices}
              className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 text-sm text-primary"
            >
              <Smartphone size={18} />
              Use another signed-in device
            </button>
            {showDevices && (
              <div className="mt-3 space-y-4 border-t border-black/10 pt-5 dark:border-white/10">
                {isSyncRequired ? (
                  <>
                    <p className="text-sm text-gray-500">
                      Generate a code here, then enter it in History & Sync on a
                      device that can already read your messages. Both devices
                      must use your account.
                    </p>
                    {linkCode && !expired ? (
                      <div className="flex flex-col items-center gap-3 rounded-2xl bg-white p-4 text-gray-900">
                        <QRCode value={"twilightsync:" + linkCode} size={144} />
                        <strong className="font-mono text-xl tracking-[0.15em]">
                          {linkCode}
                        </strong>
                        <span className="text-xs text-gray-500">
                          Expires after 10 minutes
                        </span>
                      </div>
                    ) : (
                      <button
                        disabled={busy}
                        onClick={linkDevice}
                        className="h-12 w-full rounded-xl border border-primary/30 text-sm text-primary"
                      >
                        {expired
                          ? "Generate another code"
                          : "Generate device code"}
                      </button>
                    )}
                  </>
                ) : (
                  <form
                    className="space-y-3"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      setBusy(true);
                      setError("");
                      try {
                        await completeSyncHandshake(approveCode);
                        setDone(true);
                      } catch {
                        setError(
                          "This code is invalid or expired. Check both devices use the same account.",
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <label htmlFor="device-code" className="block text-sm">
                      Code shown on your new device
                    </label>
                    <input
                      id="device-code"
                      autoCapitalize="characters"
                      autoComplete="off"
                      required
                      minLength={8}
                      maxLength={8}
                      value={approveCode}
                      onChange={(event) =>
                        setApproveCode(event.target.value.toUpperCase())
                      }
                      className={
                        field + " text-center font-mono tracking-widest"
                      }
                    />
                    <button
                      disabled={busy}
                      className="h-12 w-full rounded-xl border border-primary/30 text-sm text-primary"
                    >
                      Approve device
                    </button>
                  </form>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
