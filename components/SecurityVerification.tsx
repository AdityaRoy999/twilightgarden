import { SpringModal } from './ui/SpringModal';
import React, { useEffect, useRef, useState } from "react";
import QRCode from "react-qr-code";
import { Camera, Check, Clipboard, Shield, X } from './ui/Icons';
import {
  derivePublicKeyFromPrivate,
  generateVerificationFingerprint,
  getCachedPrivateKey,
} from "../lib/encryption";
import { useCouples } from "../contexts/CouplesContext";
import {getPrivatePeer} from '../lib/privateData';
import {unlockedVault} from '../lib/vaultRuntime';

export function SecurityVerification({
  isOpen,
  onClose,
  partnerPubKey,
}: {
  isOpen: boolean;
  onClose: () => void;
  partnerPubKey: string | null;
}) {
  const { isSyncRequired } = useCouples();
  const [fingerprint, setFingerprint] = useState<string | null>(null),
    [otherCode, setOtherCode] = useState("");
  const [result, setResult] = useState<"verified" | "mismatch" | null>(null),
    [scanning, setScanning] = useState(false),
    [error, setError] = useState(""),
    [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  useEffect(() => {
    let active = true;
    setFingerprint(null);
    setResult(null);
    setOtherCode("");
    setError("");
    setScanning(false);
    setCopied(false);
    const privateKey = getCachedPrivateKey();
    if (isOpen && privateKey && partnerPubKey && !isSyncRequired)
      void (async()=>{
        const peer=await getPrivatePeer();if(!peer)throw new Error('Partner vault unavailable');
        return generateVerificationFingerprint(derivePublicKeyFromPrivate(privateKey),partnerPubKey,
          [btoa(JSON.stringify(unlockedVault().publicKey)),btoa(JSON.stringify(peer.publicKey))]);
      })()
        .then((value) => {
          if (active) setFingerprint(value);
        })
        .catch(() => {
          if (active)
            setError(
              "Could not create the verification code. Unlock your history and retry.",
            );
        });
    return () => {
      active = false;
      clearTimeout(copyTimer.current);
    };
  }, [isOpen, partnerPubKey, isSyncRequired]);
  useEffect(() => {
    if (!isOpen || !scanning || !fingerprint) return;
    let active = true;
    let scanner: import("html5-qrcode").Html5Qrcode | undefined;
    const stop = async () => {
      if (!scanner) return;
      try {
        await scanner.stop();
      } catch {
        /* May still be starting. */
      }
      try {
        scanner.clear();
      } catch {
        /* Already cleared. */
      }
    };
    void (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (!active) return;
        scanner = new Html5Qrcode("security-qr-scanner");
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decoded) => {
            if (!active) return;
            setResult(
              decoded.replace(/\s/g, "") === fingerprint
                ? "verified"
                : "mismatch",
            );
            setScanning(false);
          },
          () => {},
        );
        if (!active) await stop();
      } catch {
        if (active) {
          setError(
            "Could not open the camera. You can compare or paste the code below.",
          );
          setScanning(false);
        }
      }
    })();
    return () => {
      active = false;
      void stop();
    };
  }, [isOpen, scanning, fingerprint]);
  return (
    <SpringModal open={isOpen} onClose={onClose} labelledBy="security-title" className="security-dialog max-w-lg p-0">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-black/10 bg-background-dark p-4 dark:border-white/10 dark:bg-background-dark">
        <h2
          id="security-title"
          className="flex items-center gap-2 text-lg font-semibold"
        >
          <Shield size={21} />
          Verify your connection
        </h2>
        <button
          autoFocus
          onClick={onClose}
          aria-label="Close security verification"
          className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5"
        >
          <X />
        </button>
      </header>
      <div className="mx-auto max-w-md space-y-6 p-6">
        <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">
          Compare this code with your partner in person or through another
          trusted channel. Both devices should show the same code.
        </p>
        {error && (
          <p
            role="alert"
            className="rounded-xl bg-red-500/10 p-3 text-sm text-red-500"
          >
            {error}
          </p>
        )}
        {!fingerprint ? (
          <p role="status">
            Unlock your history and wait for your partner’s identity to load.
          </p>
        ) : (
          <>
            <p
              role="status"
              className={`rounded-xl p-3 text-center text-sm ${result === "verified" ? "bg-green-500/10 text-green-600" : result === "mismatch" ? "bg-red-500/10 text-red-500" : "bg-primary/10 text-primary"}`}
            >
              {result === "verified"
                ? "Codes match — verified on this device"
                : result === "mismatch"
                  ? "Codes do not match. Check the account and device before continuing."
                  : "Awaiting code comparison"}
            </p>
            <div className="security-qr mx-auto flex w-fit rounded-2xl bg-white p-5">
              <QRCode value={fingerprint} size={220} />
            </div>
            <p
              aria-label="Security code"
              className="rounded-2xl border border-black/10 p-4 text-center font-mono text-base leading-8 tracking-widest dark:border-white/10"
            >
              {fingerprint.match(/.{1,5}/g)?.join(" ")}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setError("");
                  setScanning((value) => !value);
                }}
                className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-primary/30 text-sm text-primary"
              >
                <Camera size={18} />
                {scanning ? "Stop scanner" : "Scan partner code"}
              </button>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(fingerprint);
                    setCopied(true);
                    clearTimeout(copyTimer.current);
                    copyTimer.current = setTimeout(
                      () => setCopied(false),
                      2000,
                    );
                  } catch {
                    setError(
                      "Could not copy. You can compare the displayed code.",
                    );
                  }
                }}
                className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-primary/30 text-sm text-primary"
              >
                {copied ? <Check size={18} /> : <Clipboard size={18} />}
                {copied ? "Copied" : "Copy code"}
              </button>
            </div>
            {scanning && (
              <div
                id="security-qr-scanner"
                className="overflow-hidden rounded-2xl"
              />
            )}
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                setResult(
                  otherCode.replace(/\s/g, "") === fingerprint
                    ? "verified"
                    : "mismatch",
                );
              }}
            >
              <label
                htmlFor="partner-security-code"
                className="block text-sm font-medium"
              >
                Or paste your partner’s code
              </label>
              <textarea
                id="partner-security-code"
                value={otherCode}
                onChange={(event) => {
                  setOtherCode(event.target.value);
                  setResult(null);
                }}
                maxLength={100}
                required
                rows={3}
                className="w-full rounded-xl border border-gray-200 bg-transparent p-3 font-mono text-sm dark:border-white/10"
              />
              <button className="on-brand min-h-12 w-full rounded-xl bg-primary text-sm font-semibold text-white">
                Compare codes
              </button>
            </form>
            <p className="text-xs leading-relaxed text-gray-500">
              This compares your current encryption identities. If either
              identity changes, compare the new code again.
            </p>
          </>
        )}
      </div>
    </SpringModal>
  );
}
