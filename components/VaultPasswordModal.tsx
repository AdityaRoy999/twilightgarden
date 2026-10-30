import React, { useEffect, useState } from "react";
import { useVault } from "../contexts/VaultContext";
import { SpringModal } from "./ui/SpringModal";
import { AppIcon } from "./ui/Icons";
export function VaultPasswordModal({
  isOpen,
  onClose,
  onApproveDevice,
}: {
  isOpen: boolean;
  onClose: () => void;
  onApproveDevice?: (code: string) => Promise<void>;
}) {
  const { changePassword } = useVault();
  const [current, setCurrent] = useState(""),
    [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState(false);
  const [showLink, setShowLink] = useState(false),
    [code, setCode] = useState(""),
    [linked, setLinked] = useState(false);
  useEffect(() => {
    setCurrent("");
    setPassword("");
    setConfirmation("");
    setError("");
    setDone(false);
    setShowLink(false);
    setCode("");
    setLinked(false);
  }, [isOpen]);
  const approve = async () => {
    if (busy || !onApproveDevice) return;
    setError("");
    if (!/^[A-Z0-9]{8}$/.test(code.trim().toUpperCase())) {
      setError("Enter the eight-character device code.");
      return;
    }
    setBusy(true);
    try {
      await onApproveDevice(code.trim().toUpperCase());
      setLinked(true);
      setDone(true);
      setCode("");
    } catch {
      setError("Could not link this device. Check the code and retry.");
    } finally {
      setBusy(false);
    }
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (password.length < 12) {
      setError("Use at least 12 characters.");
      return;
    }
    if (password !== confirmation) {
      setError("The new passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await changePassword(current, password);
      setDone(true);
      setCurrent("");
      setPassword("");
      setConfirmation("");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not change your backup password. Retry.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <SpringModal
      open={isOpen}
      onClose={busy ? undefined : onClose}
      label="Account backup password"
      className="vault-password-panel"
    >
      <button
        type="button"
        aria-label="Close"
        className="reference-circle ml-auto"
        onClick={onClose}
        disabled={busy}
      >
        <AppIcon name="close" size={22} />
      </button>
      <span className="reference-icon">
        <AppIcon name="lock" size={30} />
      </span>
      <h2 className="mt-4 text-2xl font-bold">
        {linked
          ? "Device linked"
          : done
            ? "Backup password changed"
            : "One backup password"}
      </h2>
      <p className="my-4 text-[var(--text-secondary)]">
        {linked
          ? "The other device can now load your chats."
          : done
            ? "Use the new password to unlock all your private records and chats on a new device."
            : "Your account backup password protects your private records and chats. Disconnecting resets chat keys, while your backup password stays the same."}
      </p>
      {done ? (
        <button className="reference-button w-full" onClick={onClose}>
          Done
        </button>
      ) : (
        <form
          onSubmit={(event) => void submit(event)}
          className="flex flex-col gap-4"
        >
          <label>
            Current backup password
            <input
              required
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </label>
          <label>
            New backup password
            <input
              required
              minLength={12}
              maxLength={1024}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label>
            Confirm new backup password
            <input
              required
              minLength={12}
              maxLength={1024}
              type="password"
              autoComplete="new-password"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          </label>
          {error && <p role="alert">{error}</p>}
          <button className="reference-button w-full" disabled={busy}>
            {busy ? "Updating…" : "Change backup password"}
          </button>
        </form>
      )}
      {!done && onApproveDevice && (
        <div className="mt-5">
          <button
            type="button"
            className="min-h-11 underline"
            onClick={() => setShowLink(!showLink)}
          >
            More options
          </button>
          {showLink && (
            <div>
              <p className="my-3 text-sm">
                Approve a one-time import from another signed-in device.
              </p>
              <label>
                Device code
                <input
                  maxLength={8}
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                />
              </label>
              <button
                type="button"
                className="reference-button mt-3 w-full"
                disabled={busy}
                onClick={() => void approve()}
              >
                Link device
              </button>
            </div>
          )}
        </div>
      )}
    </SpringModal>
  );
}
