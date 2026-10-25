import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Capacitor } from '@capacitor/core';

const SignUp: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isPartnerMode = searchParams.get('mode') === 'partner';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = e.target as HTMLFormElement;
    const inputEmail = (form.elements.namedItem('email') as HTMLInputElement).value;
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;
    const fullName = (form.elements.namedItem('fullName') as HTMLInputElement).value;

    if (!fullName || !inputEmail || !password) {
      setError('Please fill out all required fields.');
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: inputEmail,
        password,
        options: {
          data: {
            full_name: fullName,
            is_partner: isPartnerMode, // Flag to identify partner users
          },
        },
      });

      if (error) throw error;

      if (data.user) {
         setEmail(inputEmail);
         setVerifying(true);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'signup',
      });

      if (error) throw error;

      if (data.session) {
        // If partner mode, go to join partner page
        // Otherwise go to onboarding
        if (isPartnerMode) {
          navigate('/partner');
        } else {
          navigate('/');
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const isCapacitor = Capacitor.isNativePlatform();
      const isTauri = typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;

      let redirectUrl = window.location.origin;
      if (isCapacitor) {
        redirectUrl = "com.twilight.garden://google-auth";
      } else if (isTauri) {
        redirectUrl = "twilight-garden://localhost/auth-callback";
      }

      if (isTauri) {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectUrl,
            skipBrowserRedirect: true,
          }
        });
        if (error) throw error;
        if (data?.url) {
          const { open } = await import('@tauri-apps/plugin-shell');
          await open(data.url);
        }
      } else {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
              redirectTo: redirectUrl,
          }
        });
        if (error) throw error;
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (verifying) {
    return (
      <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-[#FDFCF8] dark:bg-background-dark font-display transition-colors duration-300">
        <div className="flex items-center bg-transparent p-4 pb-2 justify-between z-10">
            <button onClick={() => setVerifying(false)} className="text-[#121014] dark:text-white flex size-12 shrink-0 items-center justify-center cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors">
            <span className="material-symbols-outlined">arrow_back_ios_new</span>
            </button>
            <h2 className="text-[#121014] dark:text-white text-lg font-bold flex-1 text-center pr-12">
            Verification
            </h2>
        </div>

        <div className="flex flex-col flex-1 items-center justify-center px-6 py-8 z-10">
        <div className="w-full max-w-md bg-surface-dark/40 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-primary/5 z-0"></div>
          <div className="relative z-10">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-primary/30">
                <span className="material-symbols-outlined text-primary text-3xl">mark_email_read</span>
              </div>
              <h1 className="text-white text-2xl font-bold mb-2">Check your email</h1>
              <p className="text-white/60 text-sm">
                We sent a verification code to <br /><span className="font-semibold text-white">{email}</span>
              </p>
            </div>

            <form className="space-y-6" onSubmit={handleVerifyOtp}>
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-500 text-sm">
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-2">
                <label className="text-white/80 text-sm font-medium ml-1">Verification Code</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-white/30 text-xl pointer-events-none">
                    passkey
                  </span>
                  <input
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="w-full rounded-2xl text-white border border-white/10 bg-surface-dark outline-none focus:ring-2 focus:ring-primary h-14 pl-12 pr-4 text-center text-xl tracking-widest placeholder:text-white/30 transition-all"
                    placeholder="000000"
                    type="text"
                    maxLength={8}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-14 bg-primary hover:bg-[#c95b80] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-2xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 group active:scale-[0.98]"
              >
                <span>{loading ? 'Verifying...' : 'Verify Email'}</span>
                {!loading && <span className="material-symbols-outlined text-xl group-hover:translate-x-1 transition-transform">arrow_forward</span>}
              </button>
            </form>
          </div>
        </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-[#FDFCF8] dark:bg-background-dark font-display transition-colors duration-300">
      {/* Header */}
      <div className="flex items-center bg-transparent p-4 pb-2 justify-between z-10">
        <button onClick={() => navigate('/welcome')} className="text-[#121014] dark:text-white flex size-12 shrink-0 items-center justify-center cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors">
          <span className="material-symbols-outlined">arrow_back_ios_new</span>
        </button>
        <h2 className="text-[#121014] dark:text-white text-lg font-bold flex-1 text-center pr-12">
          Begin Your Journey
        </h2>
      </div>

      <div className="flex flex-col flex-1 items-center justify-start px-6 pt-6 pb-8 z-10">

        {/* Logo */}
        <div className="w-24 h-24 mb-8 relative">
          <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl"></div>
          <div className="relative w-full h-full rounded-full border border-primary/30 flex items-center justify-center overflow-hidden bg-surface-dark">
            <span className="material-symbols-outlined text-primary text-5xl">
              eco
            </span>
          </div>
        </div>

        {/* Title */}
        <div className="max-w-md w-full text-center mb-10">
          <h1 className="text-white text-[32px] font-bold leading-tight tracking-tight mb-3">
            {isPartnerMode ? 'Join Your Partner' : 'Create Account'}
          </h1>
          <p className="text-white/60 text-base font-normal leading-relaxed px-4 text-center">
            {isPartnerMode
              ? 'Sign up to connect with your partner and support their journey.'
              : 'Join our community for personalized cycle insights.'
            }
          </p>
        </div>

        <div className="w-full max-w-md bg-surface-dark/40 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-primary/5 z-0"></div>
          <div className="relative z-10">
            <form className="space-y-5" onSubmit={handleSignup}>
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-500 text-sm">
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-2">
                <label htmlFor="fullName" className="text-white/80 text-sm font-medium ml-1">Full Name</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-white/30 text-xl pointer-events-none">
                    person
                  </span>
                  <input
                    name="fullName" id="fullName" autoComplete="name"
                    className="w-full rounded-2xl text-white border border-white/10 bg-surface-dark outline-none focus:ring-2 focus:ring-primary h-14 pl-12 pr-4 placeholder:text-white/30 text-base font-normal transition-all"
                    placeholder="Enter your name"
                    type="text"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="email" className="text-white/80 text-sm font-medium ml-1">Email Address</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-white/30 text-xl pointer-events-none">
                    mail
                  </span>
                  <input
                    name="email" id="email" autoComplete="email"
                    className="w-full rounded-2xl text-white border border-white/10 bg-surface-dark outline-none focus:ring-2 focus:ring-primary h-14 pl-12 pr-4 placeholder:text-white/30 text-base font-normal transition-all"
                    placeholder="yourname@example.com"
                    type="email"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="password" className="text-white/80 text-sm font-medium ml-1">Create Password</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-white/30 text-xl pointer-events-none">
                    lock
                  </span>
                  <input
                    name="password" id="password" autoComplete="new-password"
                    className="w-full rounded-2xl text-white border border-white/10 bg-surface-dark outline-none focus:ring-2 focus:ring-primary h-14 pl-12 pr-12 placeholder:text-white/30 text-base font-normal transition-all"
                    placeholder="••••••••"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                  >
                    <span className="material-symbols-outlined text-xl">
                      {showPassword ? 'visibility' : 'visibility_off'}
                    </span>
                  </button>
                </div>
                <p className="text-white/30 text-[10px] px-1">
                  At least 8 characters with a mix of letters and numbers.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-14 bg-primary hover:bg-[#c95b80] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-2xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 group mt-4 active:scale-[0.98]"
              >
                <span>{loading ? 'Sending Code...' : 'Sign Up'}</span>
                {!loading && (
                  <span className="material-symbols-outlined text-xl group-hover:translate-x-1 transition-transform">
                    arrow_forward
                  </span>
                )}
              </button>
            </form>

            <div className="relative my-8 flex items-center gap-4">
              <div className="h-px flex-1 bg-white/5"></div>
              <span className="text-xs font-medium text-white/30 whitespace-nowrap uppercase tracking-wider">OR SIGN UP WITH</span>
              <div className="h-px flex-1 bg-white/5"></div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <button
                  onClick={handleGoogleLogin}
                  className="flex items-center justify-center gap-3 h-14 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors backdrop-blur-md active:scale-[0.98]"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <span className="text-white/90 font-medium">Continue with Google</span>
              </button>
            </div>
          </div>
        </div>

        <p className="mt-8 text-center text-white/40 text-sm">
          Already have an account?{' '}
          <button onClick={() => navigate('/login')} className="text-primary font-bold hover:underline ml-1">
            Log In
          </button>
        </p>

        <div className="mt-8 text-center">
            <p className="text-white/20 text-[10px] leading-relaxed">
              By signing up, you agree to our <Link to="/tos" className="underline decoration-white/20 underline-offset-4 hover:text-white transition-colors">Terms of Service</Link><br/>
              and <Link to="/privacy" className="underline decoration-white/20 underline-offset-4 hover:text-white transition-colors">Privacy Policy</Link>.
            </p>
        </div>
      </div>
    </div>
  );
};

export default SignUp;
