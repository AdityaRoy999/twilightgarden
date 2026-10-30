import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useVault } from "../contexts/VaultContext";
import { AppIcon } from "./ui/Icons";
import {OnboardingArt} from './ui/OnboardingArt';
export function VaultBoundary({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth(),
    vault = useVault();
  const [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [name, setName] = useState(""),
    [saved, setSaved] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  if (!user || vault.ready) return <>{children}</>;
  if (vault.loading)
    return (
      <main className="privacy-center" role="status">
        Opening your encrypted space…
      </main>
    );
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!vault.exists && (password !== confirm || !saved)) {
      setError("Confirm the password and save a copy somewhere safe.");
      return;
    }
    setBusy(true);
    try {
      if (vault.exists) await vault.unlock(password);
      else await vault.create(password, name);
      setPassword("");
      setConfirm("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not unlock your vault.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="privacy-center vault-onboarding safe-screen">
      <section className="reference-card mx-auto w-full max-w-lg p-6 sm:p-9">
        <OnboardingArt variant="vault"/>
        <h1 className="mt-5 text-3xl font-bold">
          {vault.exists
            ? "Unlock your private space"
            : "Protect your private space"}
        </h1>
        <p className="my-5 text-[var(--text-secondary)]">
          {vault.exists
            ? "Enter your backup password to unlock this device. Your records stay encrypted while locked."
            : "Set one backup password for your private records, profile, preferences and chats. Your partner receives only the records you choose to share."}
        </p>
        <form
          onSubmit={(event) => void submit(event)}
          className="flex flex-col gap-4"
        >
          {!vault.exists && (
            <label>
              Display name (optional)
              <input
                className="mt-2 w-full rounded-2xl bg-[var(--surface-soft)] p-4 text-base"
                autoComplete="nickname"
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
          )}
          <label>
            Backup password
            <input
              className="mt-2 w-full rounded-2xl bg-[var(--surface-soft)] p-4 text-base"
              autoComplete={vault.exists ? "current-password" : "new-password"}
              type="password"
              minLength={12}
              maxLength={1024}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {!vault.exists && (
            <>
              <label>
                Confirm backup password
                <input
                  className="mt-2 w-full rounded-2xl bg-[var(--surface-soft)] p-4 text-base"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </label>
              <label className="vault-saved-check">
                <input
                  type="checkbox"
                  checked={saved}
                  onChange={(e) => setSaved(e.target.checked)}
                />
                <span className="vault-check-mark" aria-hidden="true"><AppIcon name="check" size={20}/></span>
                <span>
                  I saved this password. Twilight cannot recover it. Losing it
                  and all unlocked devices means losing access to my encrypted
                  records.
                </span>
              </label>
            </>
          )}
          {(error || vault.error) && <p role="alert">{error || vault.error}</p>}
          <button className="reference-button" disabled={busy}>
            {busy
              ? "Securing your space…"
              : vault.exists
                ? "Unlock"
                : "Create encrypted vault"}
          </button>
        </form>
        <div className="mt-5 flex flex-wrap gap-5">
          <a href="#/privacy-controls">Privacy choices</a>
          <button onClick={() => void vault.refresh()}>Retry</button>
          <button onClick={() => void signOut()}>Sign out</button>
        </div>
      </section>
    </main>
  );
}
