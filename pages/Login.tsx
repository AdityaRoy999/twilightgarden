import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

import { supabase } from "../lib/supabase";
import { Capacitor } from "@capacitor/core";

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showPassword, setShowPassword] = React.useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = e.target as HTMLFormElement;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement)
      .value;

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      // No explicit navigate('/') here - the cached session update or
      // onAuthStateChange in AuthContext will trigger re-render
      // and PublicOnlyRoute will redirect to /dashboard
      // This implementation avoids race conditions where we redirect before user state is set
    } catch (err: any) {
      setError(err.message);
      setLoading(false); // Only unset loading on error since success will unmount/redirect
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const isCapacitor = Capacitor.isNativePlatform();
      // window.__TAURI_INTERNALS__ is definitively only present in actual Tauri windows
      const isTauri = typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;

      console.log('Environment Check:', { isCapacitor, isTauri, url: window.location.origin });

      let redirectUrl = window.location.origin;
      if (isCapacitor) {
        redirectUrl = "com.twilight.garden://google-auth";
      } else if (isTauri) {
        redirectUrl = "twilight-garden://localhost/auth-callback";
      }

      if (isTauri) {
        console.log("Triggering Tauri OAuth Flow...");
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: redirectUrl,
            skipBrowserRedirect: true,
          },
        });
        if (error) throw error;
        if (data?.url) {
          const { open } = await import('@tauri-apps/plugin-shell');
          await open(data.url);
        }
      } else {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: redirectUrl,
          },
        });
        if (error) throw error;
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-background-dark font-display">
      <div className="flex items-center bg-transparent p-4 pb-2 justify-between z-10">
        <button
          onClick={() => navigate("/welcome")}
          className="text-white flex size-12 shrink-0 items-center justify-center cursor-pointer"
        >
          <span className="material-symbols-outlined">arrow_back_ios</span>
        </button>
        <h2 className="text-white/90 text-sm font-medium tracking-[0.2em] uppercase flex-1 text-center pr-12">
          Twilight Garden
        </h2>
      </div>

      <div className="flex flex-col flex-1 items-center justify-center px-6 py-8 z-10">
        <div className="w-24 h-24 mb-8 relative">
          <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl"></div>
          <div className="relative w-full h-full rounded-full border border-primary/30 flex items-center justify-center overflow-hidden bg-surface-dark">
            <span className="material-symbols-outlined text-primary text-5xl">
              eco
            </span>
          </div>
        </div>

        <div className="max-w-md w-full text-center mb-10">
          <h1 className="text-white text-[32px] font-bold leading-tight tracking-tight mb-3">
            Welcome Back
          </h1>
          <p className="text-white/60 text-base font-normal leading-relaxed px-4">
            Find your flow. Please log in to your sanctuary.
          </p>
        </div>

        <div className="w-full max-w-md bg-surface-dark/40 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-primary/5 z-0"></div>
          <div className="relative z-10">
          <form className="space-y-6" onSubmit={handleLogin}>
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-500 text-sm mb-4">
                {error}
              </div>
            )}
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-white/80 text-sm font-medium ml-1">
                Email Address
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-white/30 text-xl pointer-events-none">
                  mail
                </span>
                <input
                  name="email" id="email" autoComplete="email"
                  className="w-full rounded-2xl text-white border border-white/10 bg-surface-dark outline-none focus:ring-2 focus:ring-primary h-14 pl-12 pr-4 placeholder:text-white/30 text-base font-normal transition-all"
                  placeholder="Your email"
                  type="email"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center ml-1">
                <label htmlFor="password" className="text-white/80 text-sm font-medium">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => navigate("/forgot-password")}
                  className="text-primary text-xs font-semibold hover:underline"
                >
                  Forgot?
                </button>
              </div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-white/30 text-xl pointer-events-none">
                  lock
                </span>
                <input
                  name="password" id="password" autoComplete="current-password"
                  className="w-full rounded-2xl text-white border border-white/10 bg-surface-dark outline-none focus:ring-2 focus:ring-primary h-14 pl-12 pr-12 placeholder:text-white/30 text-base font-normal transition-all"
                  placeholder="Your password"
                  type={showPassword ? "text" : "password"}
                  required
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                >
                  <span className="material-symbols-outlined text-xl">
                    {showPassword ? "visibility" : "visibility_off"}
                  </span>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-14 bg-primary hover:bg-[#c95b80] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-2xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 group mt-2 active:scale-[0.98]"
            >
              <span>{loading ? "Logging in..." : "Log In"}</span>
              {!loading && (
                <span className="material-symbols-outlined text-xl group-hover:translate-x-1 transition-transform">
                  arrow_forward
                </span>
              )}
            </button>
          </form>

          <div className="relative my-8 flex items-center gap-4">
            <div className="h-px flex-1 bg-white/5"></div>
            <span className="text-xs font-medium text-white/30 whitespace-nowrap">
              OR CONTINUE WITH
            </span>
            <div className="h-px flex-1 bg-white/5"></div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="flex items-center justify-center gap-3 h-14 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors backdrop-blur-md active:scale-[0.98]"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <span className="text-white/90 text-sm font-medium">Continue with Google</span>
            </button>
          </div>
          </div>
        </div>

        <p className="mt-8 text-white/40 text-sm">
          New to the garden?{" "}
          <button
            onClick={() => navigate("/signup")}
            className="text-primary font-bold hover:underline ml-1"
          >
            Create an account
          </button>
        </p>
      </div>

      <div className="fixed top-[-10%] right-[-10%] w-[40%] h-[30%] bg-primary/10 blur-[120px] rounded-full z-0"></div>
      <div className="fixed bottom-[-5%] left-[-5%] w-[50%] h-[40%] bg-primary/5 blur-[100px] rounded-full z-0"></div>
    </div>
  );
};

export default Login;
