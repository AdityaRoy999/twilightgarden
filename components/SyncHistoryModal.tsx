import React, { useEffect, useRef, useState } from "react";
import QRCode from "react-qr-code";
import {
  X,
  LockKeyhole,
  Smartphone,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
} from "lucide-react";
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
  const [passwordStep, setPasswordStep] = useState<"choose" | "confirm">(
    "choose",
  );
  const [showPassword, setShowPassword] = useState(false);
  const [doneMessage, setDoneMessage] = useState("");
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
      setBusy(false);
      setPasswordStep("choose");
      setShowPassword(false);
      setDoneMessage("");
      setPassphrase("");
      setConfirmation("");
      setShowDevices(initialTab === "sync");
    } else {
      setPassphrase("");
      setConfirmation("");
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
  }, [isOpen, user?.id, initialTab]);
  const unlock = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (!isSyncRequired && passwordStep === "choose") {
      if (passphrase.length < 8) {
        setError("Use at least 8 characters.");
        return;
      }
      setError("");
      setShowPassword(false);
      setPasswordStep("confirm");
      return;
    }
    setBusy(true);
    setError("");
    const current = revision.current;
    try {
      if (isSyncRequired) await restoreFromCloudBackup(passphrase);
      else {
        if (passphrase !== confirmation)
          throw new Error("Passwords do not match. Try again.");
        await setupCloudBackup(passphrase);
      }
      if (current !== revision.current) return;
      setPassphrase("");
      setConfirmation("");
      setDoneMessage(
        isSyncRequired
          ? "Your chats are ready on this device."
          : "Your chats can now be restored with your backup password.",
      );
      setDone(true);
    } catch (error) {
      if (current !== revision.current) return;
      setError(
        isSyncRequired
          ? "That password did not work. Try again or link from another device."
          : error instanceof Error
            ? error.message
            : "Could not save your backup. Please try again.",
      );
    } finally {
      if (current === revision.current) setBusy(false);
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
      if (current !== revision.current) {
        await supabase.from("sync_sessions").delete().eq("id", session.id);
        return;
      }
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
          setDoneMessage("Your chats are ready on this device.");
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
      if (current === revision.current)
        setError("Could not create a device link. Please retry.");
    } finally {
      if (current === revision.current) setBusy(false);
    }
  };
  if (!isOpen) return null;
  const needsDeviceLink = isSyncRequired && !hasCloudBackup;
  const confirming = !isSyncRequired && passwordStep === "confirm";
  const field =
    "h-12 w-full rounded-xl border border-gray-200 bg-transparent px-4 pr-12 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-white/10";
  const deviceLink = (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">
        On a device already signed in to your account, open Chat backup → More
        options and enter this code.
      </p>
      {linkCode && !expired ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-white p-4 text-gray-900">
          <QRCode value={"twilightsync:" + linkCode} size={144} />
          <strong
            aria-label="Link code"
            className="font-mono text-xl tracking-[0.15em]"
          >
            {linkCode}
          </strong>
          <span className="text-xs text-gray-500">Valid for 10 minutes</span>
        </div>
      ) : (
        <button
          disabled={busy}
          onClick={linkDevice}
          className="h-12 w-full rounded-xl bg-primary text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy
            ? "Getting code…"
            : expired
              ? "Get a new code"
              : "Show link code"}
        </button>
      )}
    </div>
  );
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
        className="relative max-h-[90dvh] w-full max-w-sm overflow-y-auto rounded-3xl bg-[#fdfcf8] p-6 text-gray-900 shadow-xl dark:bg-[#211e27] dark:text-white"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          aria-label="Close chat backup"
          onClick={onClose}
          className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5"
        >
          <X size={20} />
        </button>
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          {done ? (
            <Check size={22} />
          ) : needsDeviceLink ? (
            <Smartphone size={22} />
          ) : (
            <LockKeyhole size={22} />
          )}
        </div>
        <h2 id="history-title" className="pr-6 text-xl font-semibold">
          {done
            ? "All set"
            : needsDeviceLink
              ? "Link this device"
              : isSyncRequired
                ? "Restore chats"
                : confirming
                  ? "Confirm password"
                  : hasCloudBackup
                    ? "Change backup password"
                    : "Back up chats"}
        </h2>
        {done ? (
          <>
            <p className="mb-5 mt-3 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
              {doneMessage}
            </p>
            <button
              onClick={onClose}
              className="h-12 w-full rounded-xl bg-primary text-sm font-semibold text-white"
            >
              Done
            </button>
          </>
        ) : (
          <>
            {!needsDeviceLink && (
              <p className="mb-5 mt-2 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                {isSyncRequired
                  ? "Enter your backup password once to restore your messages."
                  : confirming
                    ? "Enter the same password again."
                    : hasCloudBackup
                      ? "Choose a new password for restoring your chats."
                      : "Optional. Keep your chats when you switch devices."}
              </p>
            )}
            {error && (
              <p
                role="alert"
                className="mb-4 mt-3 rounded-xl bg-red-500/10 p-3 text-sm text-red-500"
              >
                {error}
              </p>
            )}
            {needsDeviceLink ? (
              <div className="mt-4">{deviceLink}</div>
            ) : (
              <form onSubmit={unlock} className="space-y-4">
                <div>
                  <label
                    htmlFor="chat-backup-password"
                    className="mb-2 block text-sm font-medium"
                  >
                    {confirming ? "Confirm password" : "Backup password"}
                  </label>
                  <div className="relative">
                    <input
                      key={passwordStep}
                      autoFocus
                      id="chat-backup-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete={
                        isSyncRequired ? "current-password" : "new-password"
                      }
                      minLength={isSyncRequired ? 1 : 8}
                      maxLength={128}
                      required
                      value={confirming ? confirmation : passphrase}
                      onChange={(event) => {
                        setError("");
                        if (confirming) setConfirmation(event.target.value);
                        else setPassphrase(event.target.value);
                      }}
                      className={field}
                    />
                    <button
                      type="button"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-1 top-0.5 flex h-11 w-11 items-center justify-center text-gray-500"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {!isSyncRequired && !confirming && (
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      At least 8 characters. You’ll need it on a new device.
                    </p>
                  )}
                </div>
                <button
                  disabled={busy}
                  className="h-12 w-full rounded-xl bg-primary text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busy
                    ? "Please wait…"
                    : isSyncRequired
                      ? "Restore chats"
                      : confirming
                        ? "Save backup"
                        : "Continue"}
                </button>
                {confirming && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setPasswordStep("choose");
                      setConfirmation("");
                      setError("");
                      setShowPassword(false);
                    }}
                  className="min-h-11 w-full text-sm text-gray-500 dark:text-gray-400"
                  >
                    Change password
                  </button>
                )}
              </form>
            )}
            <button
              onClick={onClose}
              className="mt-2 min-h-11 w-full text-sm text-gray-500 dark:text-gray-400"
            >
              {isSyncRequired ? "Do this later" : "Not now"}
            </button>
            {!needsDeviceLink && (
              <>
                <button
                  onClick={() => setShowDevices((value) => !value)}
                  aria-expanded={showDevices}
                  aria-controls="history-options"
                  className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400"
                >
                  More options
                  <ChevronDown
                    size={16}
                    className={showDevices ? "rotate-180" : ""}
                  />
                </button>
                {showDevices && (
                  <div
                    id="history-options"
                    className="mt-3 space-y-3 border-t border-black/10 pt-4 dark:border-white/10"
                  >
                    <h3 className="text-sm font-semibold">
                      {isSyncRequired
                        ? "Link from another device"
                        : "Link another device"}
                    </h3>
                    {isSyncRequired ? (
                      deviceLink
                    ) : (
                      <form
                        className="space-y-3"
                        onSubmit={async (event) => {
                          event.preventDefault();
                          if (busy) return;
                          setBusy(true);
                          setError("");
                          const current = revision.current;
                          try {
                            await completeSyncHandshake(approveCode);
                            if (current !== revision.current) return;
                            setDoneMessage(
                              "The other device can now load your chats.",
                            );
                            setDone(true);
                          } catch {
                            if (current === revision.current)
                              setError(
                                "Check the code and make sure both devices use your account.",
                              );
                          } finally {
                            if (current === revision.current) setBusy(false);
                          }
                        }}
                      >
                        <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                          Enter the code shown on your new device.
                        </p>
                        <label
                          htmlFor="device-code"
                          className="block text-sm font-medium"
                        >
                          Device code
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
                          className="h-12 w-full rounded-xl border border-gray-200 bg-transparent px-4 text-center font-mono text-base tracking-widest dark:border-white/10"
                        />
                        <button
                          disabled={busy}
                          className="h-12 w-full rounded-xl border border-primary/30 text-sm font-semibold text-primary disabled:opacity-50"
                        >
                          {busy ? "Linking…" : "Link device"}
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}
