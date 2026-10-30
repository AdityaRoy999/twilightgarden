import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Heart,
  LockKeyhole,
} from './ui/Icons';
import { Capacitor } from "@capacitor/core";
import { supabase } from "../lib/supabase";

export default function AuthScreen({
  signup = false,
  partner = false,
}: {
  signup?: boolean;
  partner?: boolean;
}) {
  const navigate = useNavigate();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState("");
  const [visible, setVisible] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false),
    [code, setCode] = useState(""),
    [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(
      () => setCooldown((v) => Math.max(0, v - 1)),
      1000,
    );
    return () => clearTimeout(timer);
  }, [cooldown]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (verifying) {
        const { error } = await supabase.auth.verifyOtp({
          email: email.trim(),
          token: code.trim(),
          type: "signup",
        });
        if (error) throw error;
      } else if (signup) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: name.trim(), is_partner: partner } },
        });
        if (error) throw error;
        if (!data.session) {
          setVerifying(true);
          setCooldown(60);
          setPassword("");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not sign in. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  };
  const resend = async () => {
    if (cooldown || busy) return;
    setBusy(true);
    setError("");
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
      });
      if (error) throw error;
      setCooldown(60);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not resend the code.",
      );
    } finally {
      setBusy(false);
    }
  };
  const google = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const tauri = !!(window as unknown as { __TAURI_INTERNALS__?: unknown })
        .__TAURI_INTERNALS__;
      if (signup && partner)
        sessionStorage.setItem("twilight-partner-signup", "true");
      else sessionStorage.removeItem("twilight-partner-signup");
      const redirect = Capacitor.isNativePlatform()
        ? "com.twilight.garden://google-auth"
        : tauri
          ? "twilight-garden://localhost/auth-callback"
          : window.location.origin +
            (signup && partner ? "/#/partner/auth-callback" : "/");
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: redirect, skipBrowserRedirect: tauri || Capacitor.isNativePlatform() },
      });
      if (error) throw error;
      if (Capacitor.isNativePlatform() && data.url) {
        const { Browser } = await import('@capacitor/browser');
        await Browser.open({url:data.url});
      }
      if (tauri && data.url) {
        const { open } = await import("@tauri-apps/plugin-shell");
        await open(data.url);
      }
    } catch (error) {
      sessionStorage.removeItem("twilight-partner-signup");
      setError(
        error instanceof Error ? error.message : "Could not connect to Google.",
      );
    } finally {
      setBusy(false);
    }
  };
  const input =
    "h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-base text-gray-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-white/5 dark:text-white";
  const title = verifying
    ? "Check your email"
    : signup
      ? partner ? "A little closer, together" : "Make room for yourself"
      : "Welcome back";
  return (
    <div className="bloom-auth safe-screen min-h-dvh bg-background-dark font-display text-gray-900 dark:bg-background-dark dark:text-white">
      <header className="mx-auto flex h-20 max-w-6xl items-center justify-between px-4 sm:px-8">
        <button
          onClick={() =>
            verifying ? setVerifying(false) : navigate("/welcome")
          }
          aria-label="Back"
          className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-black/5 dark:hover:bg-white/5"
        >
          <ArrowLeft size={21} />
        </button>
        <Link
          to="/welcome"
          className="flex items-center gap-2 text-sm font-bold tracking-wide"
        >
          <Heart size={21} className="text-primary" />
          Twilight Garden
        </Link>
        <span className="w-11" />
      </header>
      <main className="mx-auto grid max-w-6xl items-center gap-16 px-6 pb-10 pt-3 sm:pt-8 lg:min-h-[calc(100dvh-80px)] lg:grid-cols-2 lg:pb-20">
        <section
          className="hidden max-w-lg space-y-8 lg:block"
          aria-label="About Twilight"
        >
          <span className="inline-flex rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-sm text-primary">
            A little closer, every day
          </span>
          <h1 className="text-6xl font-semibold leading-[1.12] tracking-tight">
            Your rhythm.
            <br />
            <span className="text-primary">Your shared space.</span>
          </h1>
          <p className="max-w-sm text-lg leading-relaxed text-gray-500 dark:text-gray-400">
            Understand your cycle, make space for how you feel, and stay
            connected to the person beside you.
          </p>
          <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
            <LockKeyhole size={18} />
            <span>You decide what to share with your partner.</span>
          </div>
        </section>
        <section className="mx-auto w-full max-w-[420px]">
          <div className="mb-7">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              {partner ? "Partner space" : "Your personal space"}
            </p>
            <h2 className="text-3xl font-semibold tracking-tight">{title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
              {verifying
                ? `Enter the verification code sent to ${email}.`
                : signup
                  ? partner ? "Create your partner account and share a little more care." : "A simple start to a more connected routine."
                  : "Log in to pick up where you left off."}
            </p>
          </div>
          <form
            onSubmit={submit}
            className="space-y-4"
            aria-label={
              verifying ? "Verify email" : signup ? "Create account" : "Log in"
            }
          >
            {error && (
              <p
                role="alert"
                className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-600 dark:text-red-400"
              >
                {error}
              </p>
            )}
            {verifying ? (
              <div>
                <label
                  htmlFor="code"
                  className="mb-2 block text-sm font-medium"
                >
                  Verification code
                </label>
                <input
                  id="code"
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  pattern="[0-9]{6,8}"
                  minLength={6}
                  maxLength={8}
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className={input + " text-center tracking-[0.3em]"}
                  autoFocus
                />
              </div>
            ) : (
              <>
                {signup && (
                  <div>
                    <label
                      htmlFor="fullName"
                      className="mb-2 block text-sm font-medium"
                    >
                      Full name
                    </label>
                    <input
                      id="fullName"
                      autoComplete="name"
                      maxLength={100}
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={input}
                    />
                  </div>
                )}
                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-medium"
                  >
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={input}
                  />
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label htmlFor="password" className="text-sm font-medium">
                      Password
                    </label>
                    {!signup && (
                      <Link
                        to={partner ? "/partner/forgot-password" : "/forgot-password"}
                        className="py-1 text-sm text-primary hover:underline"
                      >
                        Forgot password?
                      </Link>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      id="password"
                      type={visible ? "text" : "password"}
                      autoComplete={
                        signup ? "new-password" : "current-password"
                      }
                      minLength={signup ? 8 : undefined}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={input + " pr-14"}
                    />
                    <button
                      type="button"
                      onClick={() => setVisible((v) => !v)}
                      aria-label={visible ? "Hide password" : "Show password"}
                      className="absolute right-1 top-0.5 flex h-11 w-11 items-center justify-center text-gray-400"
                    >
                      {visible ? <EyeOff size={19} /> : <Eye size={19} />}
                    </button>
                  </div>
                  {signup && (
                    <p className="mt-2 text-xs text-gray-500">
                      Use at least 8 characters.
                    </p>
                  )}
                </div>
              </>
            )}
            <button
              disabled={busy}
              className="on-brand flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-primary px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy
                ? "Please wait…"
                : verifying
                  ? "Verify email"
                  : signup
                    ? "Create account"
                    : "Log in"}
              {!busy && <ArrowRight size={18} />}
            </button>
          <p className="mt-4 text-sm text-[var(--text-secondary)]">For ages 13+. Teen sensitive features require a verified guardian process and are not yet enabled. Review <Link className="text-primary underline" to="/privacy">Privacy</Link> and <Link className="text-primary underline" to="/tos">Terms & safety</Link>. You’ll choose data permissions after sign-in.</p>
                </form>
          {verifying ? (
            <button
              disabled={busy || cooldown > 0}
              onClick={resend}
              className="mt-5 min-h-11 w-full text-sm text-primary disabled:text-gray-400"
            >
              {cooldown
                ? `Resend code in ${cooldown}s`
                : "Resend verification code"}
            </button>
          ) : (
            <>
              <div className="my-5 flex items-center gap-4 text-xs text-gray-400">
                <span className="h-px flex-1 bg-black/10 dark:bg-white/10" />
                or
                <span className="h-px flex-1 bg-black/10 dark:bg-white/10" />
              </div>
              <button
                disabled={busy}
                onClick={google}
                className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white text-sm font-medium hover:bg-gray-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
              >
                <span aria-hidden="true" className="font-bold text-blue-500">
                  G
                </span>
                Continue with Google
              </button>
              <p className="mt-6 text-center text-sm text-gray-500">
                {signup ? "Already have an account?" : "New to Twilight?"}{" "}
                <Link
                  className="font-semibold text-primary hover:underline"
                  to={
                    signup
                      ? partner ? "/partner/login" : "/login"
                      : partner ? "/partner/signup" : "/signup"
                  }
                >
                  {signup ? "Log in" : "Create an account"}
                </Link>
              </p>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
