import { NotificationProvider } from './contexts/NotificationContext';
import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
import { supabase } from './lib/supabase';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { DataProvider, useData } from './contexts/DataContext';
import { CouplesProvider, useCouples } from './contexts/CouplesContext';
import { AdminProvider } from './contexts/AdminContext';
import Layout from './components/Layout';
import AdminLayout from './components/AdminLayout';
import { TutorialProvider } from './contexts/TutorialContext';
import { CallProvider } from './contexts/CallContext';
import { CallModal } from './components/CallModal';
import { GlobalGameTutorial } from './components/tutorials/GlobalGameTutorial';
import UpdateModal from './components/UpdateModal';
import RestorationOverlay from './components/RestorationOverlay';
import { useWidgetSync } from './hooks/useWidgetSync';
import { useAutoUpdater } from './hooks/useAutoUpdater';
import { IdentityLockdownPrompt } from './components/IdentityLockdownPrompt';
import ErrorBoundary from './components/ErrorBoundary';
// KeySyncWrapper removed in favor of Signal-style multi-device sync

// Lazy-loaded components for code splitting
const Welcome = React.lazy(() => import('./pages/Welcome'));
const Login = React.lazy(() => import('./pages/Login'));
const SignUp = React.lazy(() => import('./pages/SignUp'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Onboarding = React.lazy(() => import('./pages/Onboarding'));
const CalendarView = React.lazy(() => import('./pages/Calendar'));
const Insights = React.lazy(() => import('./pages/Insights'));
const LogDetails = React.lazy(() => import('./pages/LogDetails'));
const Settings = React.lazy(() => import('./pages/Settings'));
const CycleLengthSettings = React.lazy(() => import('./pages/CycleLengthSettings'));
const PeriodLengthSettings = React.lazy(() => import('./pages/PeriodLengthSettings'));
const EditProfile = React.lazy(() => import('./pages/EditProfile'));
const LogHistory = React.lazy(() => import('./pages/LogHistory'));
const ForgotPassword = React.lazy(() => import('./pages/ForgotPassword'));
const NotificationSettings = React.lazy(() => import('./pages/settings/NotificationSettings'));
const ThemeSettings = React.lazy(() => import('./pages/settings/ThemeSettings'));
const SharedCard = React.lazy(() => import('./pages/SharedCard'));
const LoveLock = React.lazy(() => import('./pages/LoveLock'));
const JoinPartner = React.lazy(() => import('./pages/JoinPartner'));
const Wellness = React.lazy(() => import('./pages/Wellness'));
const BreathingExercises = React.lazy(() => import('./pages/BreathingExercises'));
// Partner Pages Lazy Load
const PartnerLayout = React.lazy(() => import('./components/PartnerLayout'));
const PartnerDashboard = React.lazy(() => import('./pages/partner/PartnerDashboard'));
const PartnerCalendar = React.lazy(() => import('./pages/partner/PartnerCalendar'));
const PartnerInsights = React.lazy(() => import('./pages/partner/PartnerInsights'));
const PartnerLogs = React.lazy(() => import('./pages/partner/PartnerLogs'));
const PartnerProfile = React.lazy(() => import('./pages/partner/PartnerProfile'));
const PartnerNotifications = React.lazy(() => import('./pages/partner/PartnerNotifications'));
const PartnerWellness = React.lazy(() => import('./pages/partner/PartnerWellness'));


const PartnerLogin = React.lazy(() => import('./pages/partner/PartnerLogin'));
const PartnerSignUp = React.lazy(() => import('./pages/partner/PartnerSignUp'));
const PartnerForgotPassword = React.lazy(() => import('./pages/partner/PartnerForgotPassword'));
const PartnerAuthCallback = React.lazy(() => import('./pages/partner/PartnerAuthCallback'));

// Legal Pages Lazy Load
const TOS = React.lazy(() => import('./pages/legal/TOS'));
const PrivacyPolicy = React.lazy(() => import('./pages/legal/PrivacyPolicy'));

// Admin Pages Lazy Load
const AdminDashboard = React.lazy(() => import('./pages/Admin/AdminDashboard'));
const AdminLogs = React.lazy(() => import('./pages/Admin/AdminLogs'));
const AdminProfile = React.lazy(() => import('./pages/Admin/AdminProfile'));

// Games Pages Lazy Load
const Games = React.lazy(() => import('./pages/Games'));
const TicTacToe = React.lazy(() => import('./pages/games/TicTacToe'));
const DotsBoxes = React.lazy(() => import('./pages/games/DotsBoxes'));
const ConnectFour = React.lazy(() => import('./pages/games/ConnectFour'));
const RockPaperScissors = React.lazy(() => import('./pages/games/RockPaperScissors'));
const HangmanGame = React.lazy(() => import('./pages/games/Hangman'));
const WordGuess = React.lazy(() => import('./pages/games/WordGuess'));
const TwentyQuestions = React.lazy(() => import('./pages/games/TwentyQuestions'));
const MemoryMatch = React.lazy(() => import('./pages/games/MemoryMatch'));
const TwoTruthsOneLie = React.lazy(() => import('./pages/games/TwoTruthsOneLie'));
const RiddleMe = React.lazy(() => import('./pages/games/RiddleMe'));
const StoryBuilder = React.lazy(() => import('./pages/games/StoryBuilder'));
const WouldYouRather = React.lazy(() => import('./pages/games/WouldYouRather'));
const TruthOrDare = React.lazy(() => import('./pages/games/TruthOrDare'));
const ThisOrThat = React.lazy(() => import('./pages/games/ThisOrThat'));
const LoveTrivia = React.lazy(() => import('./pages/games/LoveTrivia'));
const EmojiCharades = React.lazy(() => import('./pages/games/EmojiCharades'));
const NeverHaveIEver = React.lazy(() => import('./pages/games/NeverHaveIEver'));
const RapidFire = React.lazy(() => import('./pages/games/RapidFire'));
const SongLyrics = React.lazy(() => import('./pages/games/SongLyrics'));

// Custom Twilight Garden loading spinner
const LoadingScreen: React.FC = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-[#121014] overflow-hidden relative">
    <style>{`
      @keyframes tg-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
      @keyframes tg-shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
      @keyframes tg-orbit { 0% { transform: rotate(0deg) translateX(52px) rotate(0deg); opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { transform: rotate(360deg) translateX(52px) rotate(-360deg); opacity: 0; } }
      @keyframes tg-pulse-ring { 0% { transform: scale(0.8); opacity: 0.5; } 50% { transform: scale(1.15); opacity: 0; } 100% { transform: scale(0.8); opacity: 0; } }
      @keyframes tg-fade-in { 0% { opacity: 0; transform: translateY(12px); } 100% { opacity: 1; transform: translateY(0); } }
      @keyframes tg-dot { 0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); } 40% { opacity: 1; transform: scale(1); } }
      .tg-float { animation: tg-float 2.5s ease-in-out infinite; }
      .tg-shimmer-text { background: linear-gradient(90deg, #984369 0%, #C77DBA 40%, #FF6B9D 50%, #C77DBA 60%, #984369 100%); background-size: 200% auto; -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; animation: tg-shimmer 3s linear infinite; }
      .tg-ring { animation: tg-pulse-ring 2s ease-out infinite; }
      .tg-orbit-dot { animation: tg-orbit 3s linear infinite; }
      .tg-fade { animation: tg-fade-in 0.8s ease-out forwards; }
      .tg-dot { animation: tg-dot 1.4s ease-in-out infinite; }
    `}</style>

    {/* Ambient glow */}
    <div className="absolute inset-0 pointer-events-none">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] rounded-full"
           style={{ background: 'radial-gradient(circle, rgba(152,67,105,0.15) 0%, transparent 70%)' }} />
    </div>

    {/* Logo container */}
    <div className="relative tg-float">
      {/* Pulse ring */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="tg-ring w-[88px] h-[88px] rounded-full border border-[#984369]/30" />
      </div>

      {/* Orbiting dots */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-0 h-0">
          <div className="tg-orbit-dot absolute w-[5px] h-[5px] rounded-full bg-[#FF6B9D]/80" style={{ animationDelay: '0s' }} />
          <div className="tg-orbit-dot absolute w-[4px] h-[4px] rounded-full bg-[#C77DBA]/60" style={{ animationDelay: '1s' }} />
          <div className="tg-orbit-dot absolute w-[3px] h-[3px] rounded-full bg-[#984369]/70" style={{ animationDelay: '2s' }} />
        </div>
      </div>

      {/* Flower icon */}
      <div style={{ width: 72, height: 72 }}>
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="tg-g1" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#984369"/>
              <stop offset="100%" stopColor="#C77DBA"/>
            </linearGradient>
            <linearGradient id="tg-g2" x1="100" y1="0" x2="0" y2="100" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FF6B9D"/>
              <stop offset="100%" stopColor="#984369"/>
            </linearGradient>
            <filter id="tg-glow">
              <feGaussianBlur stdDeviation="2" result="glow"/>
              <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>
          <g filter="url(#tg-glow)">
            <ellipse cx="50" cy="30" rx="14" ry="22" fill="url(#tg-g1)" opacity="0.85"/>
            <ellipse cx="70" cy="42" rx="14" ry="22" fill="url(#tg-g2)" opacity="0.75" transform="rotate(72 70 42)"/>
            <ellipse cx="64" cy="66" rx="14" ry="22" fill="url(#tg-g1)" opacity="0.7" transform="rotate(144 64 66)"/>
            <ellipse cx="36" cy="66" rx="14" ry="22" fill="url(#tg-g2)" opacity="0.75" transform="rotate(216 36 66)"/>
            <ellipse cx="30" cy="42" rx="14" ry="22" fill="url(#tg-g1)" opacity="0.8" transform="rotate(288 30 42)"/>
            <circle cx="50" cy="50" r="10" fill="#FFD700" opacity="0.9"/>
            <circle cx="50" cy="50" r="6" fill="#FFF5CC" opacity="0.7"/>
          </g>
        </svg>
      </div>
    </div>

    {/* Brand name */}
    <p className="tg-shimmer-text tg-fade mt-5 text-sm font-bold tracking-[0.25em] uppercase" style={{ animationDelay: '0.2s' }}>
      Twilight Garden
    </p>

    {/* Loading dots */}
    <div className="tg-fade flex items-center gap-1.5 mt-6" style={{ animationDelay: '0.5s' }}>
      <div className="tg-dot w-1.5 h-1.5 rounded-full bg-[#984369]" style={{ animationDelay: '0s' }} />
      <div className="tg-dot w-1.5 h-1.5 rounded-full bg-[#984369]" style={{ animationDelay: '0.2s' }} />
      <div className="tg-dot w-1.5 h-1.5 rounded-full bg-[#984369]" style={{ animationDelay: '0.4s' }} />
    </div>
  </div>
);

// OAuth/Catch-all handler - waits for auth to complete before redirecting
const AuthAwareRedirect: React.FC = () => {
  const { user, loading } = useAuth();

  // Wait for auth to finish loading before deciding where to go
  if (loading) return <LoadingScreen />;

  // Once loaded, redirect to appropriate place
  if (user) {
    if (user.role === 'admin') {
      return <Navigate to="/admin/users" replace />;
    }
    if (user.role === 'partner') {
      return <Navigate to="/partner/dashboard" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return <Navigate to="/welcome" replace />;
};

// Role-based redirect for the home route
const RoleBasedHome: React.FC = () => {
  const { user, loading } = useAuth();
  const { isSupporter, loading: couplesLoading } = useCouples();

  if (loading || couplesLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/welcome" replace />;

  // Route based on role
  if (user.role === 'admin') {
    return <Navigate to="/admin/users" replace />;
  }
  if (user.role === 'partner') {
    return <Navigate to="/partner/dashboard" replace />;
  }
  return <Navigate to="/dashboard" replace />;
};

// Menstruator-only route guard (users tracking their own cycles)
const MenstruatorRoute: React.FC<{ children: React.ReactNode; allowIncomplete?: boolean }> = ({ children, allowIncomplete = false }) => {
  const { user, loading: authLoading, profileRefreshed } = useAuth();

  if (authLoading || (!profileRefreshed && !user?.role)) return <LoadingScreen />;
  if (!user) return <Navigate to="/welcome" replace />;

  // Partners should NEVER see menstruator-specific pages
  if (user.role === 'partner') {
    return <Navigate to="/partner/dashboard" replace />;
  }

  // Admins can see everything (useful for debugging)
  if (user.role === 'admin') {
    return <>{children}</>;
  }

  return <RequireOnboarding allowIncomplete={allowIncomplete}>{children}</RequireOnboarding>;
};

// Base protected route for generic shared pages
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  if (authLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/welcome" replace />;
  return <>{children}</>;
};

// Admin-only route guard
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/welcome" replace />;
  if (user.role !== 'admin') return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
};

// Partner-only route guard
const PartnerRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const { couple, isSupporter, isLoading: couplesLoading } = useCouples();

  if (loading || couplesLoading) return <LoadingScreen />;

  if (!user) return <Navigate to="/welcome" replace />;

  // Allow admins to access partner routes for testing/management
  if (user.role === 'admin') {
    return <>{children}</>;
  }

  // Partners can access routes even without a couple — pairing happens inside LoveLock

  // Strict check: non-partners who are NOT supporters (e.g. regular users trying to access partner routes)
  // should be sent back to their dashboard.
  // BUT if they are role='partner', they belong here regardless of supporter status.
  if (user.role !== 'partner' && !isSupporter) {
    // If they are the menstruator, send them to main dashboard
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

const RequireOnboarding: React.FC<{ children: React.ReactNode; allowIncomplete: boolean }> = ({ children, allowIncomplete }) => {
  const { user, sessionVerified, profileRefreshed } = useAuth();
  const { cycleSettings, loading, error } = useData();

  // Wait for profile to be fully verified before making routing decisions
  // This prevents partners from being misidentified as regular users on slow connections
  // Also wait for profileRefreshed to ensure the role is authoritative
  if (loading || !sessionVerified || (!profileRefreshed && user?.role !== 'partner')) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#121014] text-white p-6 text-center">
        <div>
          <span className="material-symbols-outlined text-4xl mb-4 text-red-500">wifi_off</span>
          <h1 className="text-xl font-bold mb-2">Connection Issue</h1>
          <p className="text-white/60 mb-4 text-sm max-w-xs mx-auto">
            {error.message || "Failed to load your data. Please check your connection."}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-[#984369] rounded-full text-sm font-bold"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Admin users bypass onboarding entirely
  if (user?.role === 'admin') {
    return <>{children}</>;
  }

  // Partner users bypass onboarding - they don't track periods
  // This is a safety catch-all
  if (user?.role === 'partner') {
    return <Navigate to="/partner/dashboard" replace />;
  }

  if (!cycleSettings.onboardingCompleted && !allowIncomplete) {
    return <Navigate to="/onboarding" />;
  }

  if (cycleSettings.onboardingCompleted && allowIncomplete) {
    return <Navigate to="/" />;
  }

  return <>{children}</>;
};

// Route for pages that should only be accessible when NOT logged in (Login, Signup, etc.)
const PublicOnlyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  // If user is already logged in, redirect them based on role
  if (user) {
    if (user.role === 'admin') {
      return <Navigate to="/admin/users" replace />;
    }
    if (user.role === 'partner') {
      return <Navigate to="/partner/dashboard" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

// Component to handle navigation triggered by notification clicks
const NotificationNavigationHandler: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleNotificationAction = (e: any) => {
      const url = e.detail?.url;
      if (url) {
        console.log('[NotificationHandler] Navigating to:', url);
        // Ensure the path is correctly formatted for navigation
        const target = url.startsWith('/') ? url : `/${url}`;
        navigate(target);
      }
    };

    window.addEventListener('appNotificationClick', handleNotificationAction);
    return () => window.removeEventListener('appNotificationClick', handleNotificationAction);
  }, [navigate]);

  return null;
};


const WidgetSyncHandler: React.FC = () => {
  useWidgetSync();
  return null;
};

const AuthStatusBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { error, refreshUser, recoveringPassword } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (recoveringPassword) navigate('/reset-password', { replace: true });
  }, [recoveringPassword, navigate]);
  if (error) return <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-background-dark text-white">
    <h1 className="text-xl font-bold">Unable to verify your session</h1>
    <p role="alert" className="max-w-md text-center">{error}</p>
    <button onClick={() => { void refreshUser(); }} className="rounded-xl bg-primary px-6 py-3">Retry</button>
  </main>;
  return <>{children}</>;
};

const AccountScope: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, dataEpoch } = useAuth();
  return <React.Fragment key={(user?.id || 'signed-out')+':'+dataEpoch}>{children}</React.Fragment>;
};

const App: React.FC = () => {
  useAutoUpdater();

  useEffect(() => {
    // Listen for Deep Links (OAuth Redirects)
    const handleDeepLink = async (url: string) => {
      try {
        console.log('[App] handleDeepLink called with:', url);

        // Custom-scheme URLs (twilight-garden://...) may not parse correctly
        // with new URL() on some platforms. Use manual extraction as fallback.
        let code: string | null = null;
        let accessToken: string | null = null;
        let refreshToken: string | null = null;

        try {
          const parsedUrl = new URL(url);
          code = parsedUrl.searchParams.get('code');
          if (!code && parsedUrl.hash) {
            const hashParams = new URLSearchParams(parsedUrl.hash.substring(1));
            accessToken = hashParams.get('access_token');
            refreshToken = hashParams.get('refresh_token');
          }
        } catch {
          // Fallback: manual extraction for URLs that new URL() can't parse
          const codeMatch = url.match(/[?&]code=([^&#]+)/);
          if (codeMatch) code = decodeURIComponent(codeMatch[1]);

          const hashIdx = url.indexOf('#');
          if (hashIdx !== -1) {
            const hashParams = new URLSearchParams(url.substring(hashIdx + 1));
            accessToken = hashParams.get('access_token');
            refreshToken = hashParams.get('refresh_token');
          }
        }

        // 1. Handle PKCE Flow (code in query params)
        if (code) {
          console.log('[App] Deep link Code detected, exchanging for session...');
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) console.error('[App] Code exchange error:', error);
          if (url.includes('partner/auth-callback')) {
             window.location.href = '#/partner/auth-callback';
          }
          return;
        }

        // 2. Handle Implicit Flow (tokens in hash)
        if (accessToken && refreshToken) {
          console.log('[App] Deep link Tokens detected, setting session...');
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) console.error('[App] setSession error:', error);
          if (url.includes('partner/auth-callback')) {
             window.location.href = '#/partner/auth-callback';
          }
        }
      } catch (e) {
        console.error('[App] Error processing deep link', e);
      }
    };

    // Set up the listener for URL deep links
    const listener = CapacitorApp.addListener('appUrlOpen', (data) => {
      console.log('[App] App opened with URL:', data.url);
      if (data.url.includes('com.twilight.garden')) {
        handleDeepLink(data.url);
      }
    });

    const isTauri = !!(window as any).__TAURI_INTERNALS__ || !!(window as any).__TAURI__;
    let tauriListenerUnsubscribe: (() => void) | null = null;
    if (isTauri) {
      import('@tauri-apps/plugin-deep-link').then(({ onOpenUrl, getCurrent }) => {
        // Listen for deep links received while the app is running
        // (works on all platforms; on Windows/Linux requires single-instance plugin)
        onOpenUrl((urls) => {
          console.log('[App] Tauri deep link opened with URLs:', urls);
          for (const url of urls) {
            if (url.includes('twilight-garden')) {
              handleDeepLink(url);
            }
          }
        }).then(unsub => { tauriListenerUnsubscribe = unsub });

        // Also check if the app was STARTED via a deep link (initial URL)
        getCurrent().then((urls) => {
          if (urls && urls.length > 0) {
            console.log('[App] App launched with deep link URLs:', urls);
            for (const url of urls) {
              if (url.includes('twilight-garden')) {
                handleDeepLink(url);
              }
            }
          }
        }).catch(err => console.error('Failed to get current deep link URLs:', err));
      }).catch(err => console.error('Failed to load tauri deep link plugin', err));
    }

    // Handle app restored from notification (Android cold starts)
    const restoreListener = CapacitorApp.addListener('appRestoredResult', (data: any) => {
      console.log('[App] App restored result:', data);
      if (data.pluginId === 'PushNotifications' && data.data?.notification?.data?.url) {
        const url = data.data.notification.data.url;
        console.log('[App] Restored from notification, dispatching click event for:', url);
        const navEvent = new CustomEvent('appNotificationClick', { detail: { url } });
        window.dispatchEvent(navEvent);
      }
    });

    return () => {
      listener.then(handle => handle.remove());
      restoreListener.then(handle => handle.remove());
      if (tauriListenerUnsubscribe) tauriListenerUnsubscribe();
    };
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <AccountScope>
          <CouplesProvider>
            <NotificationProvider>
          <CallProvider>
              <DataProvider>
                <TutorialProvider>
                <HashRouter>
                  <AuthStatusBoundary>
                  <RestorationOverlay />
                  <WidgetSyncHandler />
                  <NotificationNavigationHandler />
                  <UpdateModal />
                  <GlobalGameTutorial />
                  <CallModal />
                  <IdentityLockdownPrompt />

                  <React.Suspense fallback={<LoadingScreen />}>
                    <Routes>
                    <Route path="/welcome" element={<PublicOnlyRoute><Welcome /></PublicOnlyRoute>} />
                    <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
                    <Route path="/signup" element={<PublicOnlyRoute><SignUp /></PublicOnlyRoute>} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password" element={<ForgotPassword />} />
                    <Route path="/partner/reset-password" element={<ForgotPassword />} />

                    {/* Dedicated Partner Auth Routes */}
                    <Route path="/partner/login" element={<PublicOnlyRoute><PartnerLogin /></PublicOnlyRoute>} />
                    <Route path="/partner/signup" element={<PublicOnlyRoute><PartnerSignUp /></PublicOnlyRoute>} />
                    <Route path="/partner/forgot-password" element={<PublicOnlyRoute><PartnerForgotPassword /></PublicOnlyRoute>} />

                    <Route path="/partner/auth-callback" element={<PartnerAuthCallback />} />

                    <Route path="/share/:code" element={<SharedCard />} />

                    {/* Legal Routes */}
                    <Route path="/tos" element={<TOS />} />
                    <Route path="/privacy" element={<PrivacyPolicy />} />

                    {/* Admin Routes - completely isolated with AdminProvider */}
                    <Route element={<AdminRoute><AdminProvider><AdminLayout /></AdminProvider></AdminRoute>}>
                      <Route path="/admin/users" element={<AdminDashboard />} />
                      <Route path="/admin/logs" element={<AdminLogs />} />
                      <Route path="/admin/profile" element={<AdminProfile />} />
                      <Route path="/admin/notes" element={<LoveLock />} />
                      <Route path="/admin/games" element={<Games />} />
                      <Route path="/admin/settings/theme" element={<ThemeSettings />} />
                      <Route path="/admin/settings/profile" element={<EditProfile />} />
                    </Route>

                    {/* Dedicated Partner Routes */}
                    <Route element={<PartnerRoute><PartnerLayout /></PartnerRoute>}>
                      <Route path="/partner/dashboard" element={<PartnerDashboard />} />
                      <Route path="/partner/calendar" element={<PartnerCalendar />} />
                      <Route path="/partner/insights" element={<PartnerInsights />} />
                      <Route path="/partner/logs" element={<PartnerLogs />} />
                      <Route path="/partner/wellness" element={<PartnerWellness />} />
                      <Route path="/partner/notes" element={<LoveLock />} />
                      <Route path="/partner/games" element={<Games />} />
                      <Route path="/partner/settings/theme" element={<ThemeSettings />} />
                      <Route path="/partner/profile" element={<PartnerProfile />} />
                    </Route>

                    {/* Legacy redirects - keeping clean */}
                    <Route path="/join-partner" element={<Navigate to="/partner/dashboard" replace />} />
                    <Route path="/partner" element={<Navigate to="/partner/dashboard" replace />} />

                    <Route path="/onboarding" element={
                      <MenstruatorRoute allowIncomplete={true}>
                        <Onboarding />
                      </MenstruatorRoute>
                    } />

                    {/* Root redirect - no layout, just redirect based on role */}
                    <Route path="/" element={<RoleBasedHome />} />

                    {/* User routes with user layout */}
                    <Route element={<Layout />}>
                      <Route path="/dashboard" element={<MenstruatorRoute><Dashboard /></MenstruatorRoute>} />
                      <Route path="/calendar" element={<MenstruatorRoute><CalendarView /></MenstruatorRoute>} />
                      <Route path="/insights" element={<MenstruatorRoute><Insights /></MenstruatorRoute>} />
                      <Route path="/log/details" element={<MenstruatorRoute><LogDetails /></MenstruatorRoute>} />
                      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                      <Route path="/settings/cycle-length" element={<MenstruatorRoute><CycleLengthSettings /></MenstruatorRoute>} />
                      <Route path="/settings/period-length" element={<MenstruatorRoute><PeriodLengthSettings /></MenstruatorRoute>} />
                      <Route path="/settings/history" element={<MenstruatorRoute><LogHistory /></MenstruatorRoute>} />
                      <Route path="/settings/profile" element={<ProtectedRoute><EditProfile /></ProtectedRoute>} />
                      <Route path="/settings/notifications" element={<ProtectedRoute><NotificationSettings /></ProtectedRoute>} />
                      <Route path="/settings/theme" element={<ProtectedRoute><ThemeSettings /></ProtectedRoute>} />
                      <Route path="/notes" element={<ProtectedRoute><LoveLock /></ProtectedRoute>} />
                      <Route path="/games" element={<ProtectedRoute><Games /></ProtectedRoute>} />
                      <Route path="/wellness" element={<MenstruatorRoute><Wellness /></MenstruatorRoute>} />
                      <Route path="/breathing" element={<MenstruatorRoute><BreathingExercises /></MenstruatorRoute>} />
                    </Route>

                    {/* Standalone game routes (no bottom nav) */}
                    <Route path="/games/tictactoe" element={<ProtectedRoute><TicTacToe /></ProtectedRoute>} />
                    <Route path="/admin/games/tictactoe" element={<AdminRoute><TicTacToe /></AdminRoute>} />
                    <Route path="/partner/games/tictactoe" element={<PartnerRoute><TicTacToe /></PartnerRoute>} />
                    <Route path="/games/dots-boxes" element={<ProtectedRoute><DotsBoxes /></ProtectedRoute>} />
                    <Route path="/admin/games/dots-boxes" element={<AdminRoute><DotsBoxes /></AdminRoute>} />
                    <Route path="/partner/games/dots-boxes" element={<PartnerRoute><DotsBoxes /></PartnerRoute>} />
                    <Route path="/games/connect-four" element={<ProtectedRoute><ConnectFour /></ProtectedRoute>} />
                    <Route path="/admin/games/connect-four" element={<AdminRoute><ConnectFour /></AdminRoute>} />
                    <Route path="/partner/games/connect-four" element={<PartnerRoute><ConnectFour /></PartnerRoute>} />
                    <Route path="/games/rps" element={<ProtectedRoute><RockPaperScissors /></ProtectedRoute>} />
                    <Route path="/admin/games/rps" element={<AdminRoute><RockPaperScissors /></AdminRoute>} />
                    <Route path="/partner/games/rps" element={<PartnerRoute><RockPaperScissors /></PartnerRoute>} />
                    <Route path="/games/hangman" element={<ProtectedRoute><HangmanGame /></ProtectedRoute>} />
                    <Route path="/admin/games/hangman" element={<AdminRoute><HangmanGame /></AdminRoute>} />
                    <Route path="/partner/games/hangman" element={<PartnerRoute><HangmanGame /></PartnerRoute>} />
                    <Route path="/games/wordle" element={<ProtectedRoute><WordGuess /></ProtectedRoute>} />
                    <Route path="/admin/games/wordle" element={<AdminRoute><WordGuess /></AdminRoute>} />
                    <Route path="/partner/games/wordle" element={<PartnerRoute><WordGuess /></PartnerRoute>} />
                    <Route path="/games/20-questions" element={<ProtectedRoute><TwentyQuestions /></ProtectedRoute>} />
                    <Route path="/admin/games/20-questions" element={<AdminRoute><TwentyQuestions /></AdminRoute>} />
                    <Route path="/partner/games/20-questions" element={<PartnerRoute><TwentyQuestions /></PartnerRoute>} />
                    <Route path="/games/memory" element={<ProtectedRoute><MemoryMatch /></ProtectedRoute>} />
                    <Route path="/admin/games/memory" element={<AdminRoute><MemoryMatch /></AdminRoute>} />
                    <Route path="/partner/games/memory" element={<PartnerRoute><MemoryMatch /></PartnerRoute>} />
                    <Route path="/games/two-truths" element={<ProtectedRoute><TwoTruthsOneLie /></ProtectedRoute>} />
                    <Route path="/admin/games/two-truths" element={<AdminRoute><TwoTruthsOneLie /></AdminRoute>} />
                    <Route path="/partner/games/two-truths" element={<PartnerRoute><TwoTruthsOneLie /></PartnerRoute>} />
                    <Route path="/games/riddle-me" element={<ProtectedRoute><RiddleMe /></ProtectedRoute>} />
                    <Route path="/admin/games/riddle-me" element={<AdminRoute><RiddleMe /></AdminRoute>} />
                    <Route path="/partner/games/riddle-me" element={<PartnerRoute><RiddleMe /></PartnerRoute>} />
                    <Route path="/games/story-builder" element={<ProtectedRoute><StoryBuilder /></ProtectedRoute>} />
                    <Route path="/admin/games/story-builder" element={<AdminRoute><StoryBuilder /></AdminRoute>} />
                    <Route path="/partner/games/story-builder" element={<PartnerRoute><StoryBuilder /></PartnerRoute>} />
                    <Route path="/games/would-you-rather" element={<ProtectedRoute><WouldYouRather /></ProtectedRoute>} />
                    <Route path="/admin/games/would-you-rather" element={<AdminRoute><WouldYouRather /></AdminRoute>} />
                    <Route path="/partner/games/would-you-rather" element={<PartnerRoute><WouldYouRather /></PartnerRoute>} />

                    <Route path="/games/truth-dare" element={<ProtectedRoute><TruthOrDare /></ProtectedRoute>} />
                    <Route path="/admin/games/truth-dare" element={<AdminRoute><TruthOrDare /></AdminRoute>} />
                    <Route path="/partner/games/truth-dare" element={<PartnerRoute><TruthOrDare /></PartnerRoute>} />

                    <Route path="/games/this-or-that" element={<ProtectedRoute><ThisOrThat /></ProtectedRoute>} />
                    <Route path="/admin/games/this-or-that" element={<AdminRoute><ThisOrThat /></AdminRoute>} />
                    <Route path="/partner/games/this-or-that" element={<PartnerRoute><ThisOrThat /></PartnerRoute>} />

                    <Route path="/games/trivia" element={<ProtectedRoute><LoveTrivia /></ProtectedRoute>} />
                    <Route path="/admin/games/trivia" element={<AdminRoute><LoveTrivia /></AdminRoute>} />
                    <Route path="/partner/games/trivia" element={<PartnerRoute><LoveTrivia /></PartnerRoute>} />

                    <Route path="/games/emoji-charades" element={<ProtectedRoute><EmojiCharades /></ProtectedRoute>} />
                    <Route path="/admin/games/emoji-charades" element={<AdminRoute><EmojiCharades /></AdminRoute>} />
                    <Route path="/partner/games/emoji-charades" element={<PartnerRoute><EmojiCharades /></PartnerRoute>} />

                    <Route path="/games/never-have-i-ever" element={<ProtectedRoute><NeverHaveIEver /></ProtectedRoute>} />
                    <Route path="/admin/games/never-have-i-ever" element={<AdminRoute><NeverHaveIEver /></AdminRoute>} />
                    <Route path="/partner/games/never-have-i-ever" element={<PartnerRoute><NeverHaveIEver /></PartnerRoute>} />
                    <Route path="/games/rapid-fire" element={<ProtectedRoute><RapidFire /></ProtectedRoute>} />
                    <Route path="/admin/games/rapid-fire" element={<AdminRoute><RapidFire /></AdminRoute>} />
                    <Route path="/partner/games/rapid-fire" element={<PartnerRoute><RapidFire /></PartnerRoute>} />
                    <Route path="/games/song-lyrics" element={<ProtectedRoute><SongLyrics /></ProtectedRoute>} />
                    <Route path="/admin/games/song-lyrics" element={<AdminRoute><SongLyrics /></AdminRoute>} />
                    <Route path="/partner/games/song-lyrics" element={<PartnerRoute><SongLyrics /></PartnerRoute>} />

                    {/* Catch-all route - waits for auth then redirects appropriately */}
                    <Route path="*" element={<AuthAwareRedirect />} />
                    </Routes>
                  </React.Suspense>
                  </AuthStatusBoundary>
                </HashRouter>
            </TutorialProvider>
          </DataProvider>
          </CallProvider>
          </NotificationProvider>
          </CouplesProvider>
          </AccountScope>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;
