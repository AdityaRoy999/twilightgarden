/** Local-only mockup generator: renders the real pages with fictional fixtures.
 * It does not use production providers, execute effects, or contact Supabase.
 * Run npm run design:preview, then open /tmp/design-preview.html on Vite.
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { calculateCyclePhase } from '../lib/cycleUtils';
import AppShell from '../components/AppShell';

const fixture = vi.hoisted(() => {
  const noop = () => {};
  const settings = { avgCycleLength: 32, avgPeriodLength: 5, lastPeriodStart: '2026-10-02', irregularCycle: false, onboardingCompleted: true };
  const logs = [{ id: 'sample-log', date: '2026-10-26', userId: 'preview-user', moods: ['calm'], symptoms: ['cramps'], energyLevel: 'medium', sleepQuality: 'good', sleepHours: 8, notes: 'A slow morning and a little time for myself.' }];
  const user = { id: 'preview-user', name: 'Aria', email: 'aria@example.invalid', role: 'user', avatar_url: '' };
  const profile = { id: 'preview-partner', full_name: 'Sam', avatar_url: '', email: 'sam@example.invalid' };
  const couple = { id: 'preview-couple', user_id: user.id, partner_id: profile.id, status: 'active', share_enabled: true, notes_unlocked: true, love_notes_unlocked: true };
  const notes = [{ id: 'sample-1', sender_id: profile.id, user_id: profile.id, couple_id: couple.id, content: 'How are you feeling today?', type: 'text', created_at: '2026-10-26T09:00:00Z', reactions: {}, is_read: true }, { id: 'sample-2', sender_id: user.id, user_id: user.id, couple_id: couple.id, content: 'A little tired. A quiet evening together sounds lovely.', type: 'text', created_at: '2026-10-26T09:01:00Z', reactions: {}, is_read: true }];
  return { noop, settings, logs, user, profile, couple, notes, empty: false, game: false, theme: 'light' };
});
// Show games after the loading state, in their ready-to-start lobbies.
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  const useState = (initial: any) => actual.useState(fixture.game && initial === true ? false : initial);
  return { ...actual, useState, default: { ...actual, useState } };
});
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: fixture.user, loading: false, profileRefreshed: true, sessionVerified: true, signOut: fixture.noop, refreshUser: fixture.noop }) }));
vi.mock('../contexts/DataContext', () => ({ useData: () => ({ logs: fixture.empty ? [] : fixture.logs, cycleSettings: fixture.settings, getLog: () => fixture.empty ? undefined : fixture.logs[0], getCyclePhase: (date = '2026-10-26') => calculateCyclePhase(date, fixture.settings), updateSettings: fixture.noop, addLog: fixture.noop, notifications: [], markAsRead: fixture.noop, loading: false }) }));
vi.mock('../contexts/ThemeContext', () => ({ useTheme: () => ({ theme: fixture.theme, primaryColor: '#c33367', animationsEnabled: true, solidNavBg: true, toggleTheme: fixture.noop, updatePrimaryColor: fixture.noop, resetTheme: fixture.noop, updateAnimationsEnabled: fixture.noop, updateSolidNavBg: fixture.noop }) }));
vi.mock('../contexts/CouplesContext', () => ({ useCouples: () => new Proxy({ couple: fixture.couple, notes: fixture.notes, loading: false, isLoading: false, hasMoreNotes: false, partnerProfile: fixture.profile, partnerSettings: fixture.settings, partnerLogs: fixture.logs, partnerData: { profile: fixture.profile, settings: fixture.settings, logs: fixture.logs }, isSupporter: false, chatConnected: true, identityReady: true, isSyncRequired: false, hasCloudBackup: false, partnerPubKey: null, restorationState: { isRestoring: false } }, { get: (object, key) => key in object ? object[key as keyof typeof object] : fixture.noop }) }));
vi.mock('../contexts/CallContext', () => ({ useCall: () => ({ callStatus: 'idle', initiateCall: fixture.noop, acceptCall: fixture.noop, rejectCall: fixture.noop }) }));
vi.mock('../contexts/TutorialContext', () => ({ useTutorial: () => ({ openTutorial: fixture.noop }) }));
vi.mock('../contexts/AdminContext', () => ({ useAdmin: () => ({ users: [], recentLogs: [], stats: { totalUsers: 0, activeToday: 0 }, isLoading: false }) }));
vi.mock('../hooks/useNotifications', () => ({ useNotifications: () => ({ notifications: [], unreadCount: 0, markAsRead: fixture.noop, markAllAsRead: fixture.noop }) }));
vi.mock('../hooks/useToday', () => ({ useToday: () => '2026-10-26' }));
vi.mock('../lib/supabase', () => ({ supabase: {} }));
vi.mock('../components/ui/MotionPortal', () => ({ MotionPortal: ({ children }: any) => children }));
vi.mock('framer-motion', async () => {
  const React = await import('react');
  const tags = new Map();
  const motion = new Proxy({}, { get: (_, tag: string) => {
    if (!tags.has(tag)) tags.set(tag, React.forwardRef(({ initial, animate, exit, transition, variants, whileHover, whileTap, whileInView, viewport, layout, layoutId, ...props }: any, ref: any) => React.createElement(tag, { ...props, ref })));
    return tags.get(tag);
  } });
  return { motion, AnimatePresence: ({ children }: any) => children, useReducedMotion: () => true, useIsPresent: () => true, useMotionValue: (initial: number) => ({ get: () => initial, set: fixture.noop, jump: fixture.noop }), animate: () => ({ stop: fixture.noop }), useAnimation: () => ({ start: fixture.noop, stop: fixture.noop, set: fixture.noop }) };
});
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return { ...actual, ResponsiveContainer: ({ children }: { children: React.ReactElement }) => React.cloneElement(children as React.ReactElement<any>, { width: 320, height: 190 }) };
});

const routes: Record<string, string> = { Dashboard: '/dashboard', Calendar: '/calendar', Insights: '/insights', LoveLock: '/notes', Games: '/games', Settings: '/settings', LogDetails: '/log/details', CycleLengthSettings: '/settings/cycle-length', PeriodLengthSettings: '/settings/period-length', EditProfile: '/settings/profile', Login: '/login', SignUp: '/signup', ForgotPassword: '/forgot-password', Onboarding: '/onboarding', Welcome: '/welcome' };
const pages = import.meta.glob('../pages/**/*.tsx');
const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');

it('generates mockups of every page without a live account or network access', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-26T10:00:00'));
  vi.stubGlobal('fetch', () => { throw new Error('Network access is disabled in design previews'); });
  const frames: { title: string; group: string; theme: string; markup: string }[] = [];
  const errors: string[] = [];
  for (const [path, load] of Object.entries(pages)) {
    if (path.includes('AuthCallback')) continue; // A redirect endpoint has no standalone screen.
    const name = path.split('/').at(-1)!.replace('.tsx', '');
    try {
      fixture.game = path.includes('/games/');
      const { default: Page } = await load() as { default: React.ComponentType };
      for (const theme of ['light', 'dark']) {
      fixture.theme = theme;
      const partner = path.includes('/partner/');
      const standalone = /Welcome|Login|SignUp|ForgotPassword|Onboarding|SharedCard|TOS|PrivacyPolicy/.test(name);
      const route = routes[name] || (fixture.game ? '/games/' : partner ? '/partner/' : '/') + name.toLowerCase().replace(/^partner/, '');
      const content = standalone ? <Page/> : <Routes><Route element={<AppShell mode={partner ? 'partner' : path.includes('/Admin/') ? 'admin' : 'tracker'}/>}><Route path="*" element={<Page/>}/></Route></Routes>;
      const markup = renderToStaticMarkup(<MemoryRouter initialEntries={[route]}>{content}</MemoryRouter>);
      frames.push({ theme, title: name.replace(/([a-z])([A-Z])/g, '$1 $2'), group: path.includes('/partner/') ? 'Partner' : path.includes('/games/') ? 'Games' : path.includes('/Admin/') ? 'Admin' : path.includes('/legal/') ? 'Legal' : 'Your space', markup });
      }
    } catch (error) { errors.push(`${name}: ${error instanceof Error ? error.message : error}`); }
  }
  expect(errors).toEqual([]);
  expect(frames.length).toBeGreaterThan(45);
  const head = `<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/index.css?direct"><link rel="stylesheet" href="/styles/bloom.css?direct"><link rel="stylesheet" href="/styles/reference.css?direct"><link rel="stylesheet" href="/styles/spring.css?direct"><link rel="stylesheet" href="/styles/dark.css?direct"><link rel="stylesheet" href="/styles/refinements.css?direct"><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"><style>body{margin:0}.preview-page{height:100dvh;overflow:auto;background:var(--bg-base)}.preview-nav{position:fixed;bottom:0;left:0;right:0;display:flex;justify-content:space-around;padding:15px 7px;background:var(--bg-surface);border-radius:24px 24px 0 0;border:1px solid var(--border-color);font:11px 'Plus Jakarta Sans';color:var(--text-secondary)}.preview-nav span:first-child{color:var(--color-primary)}</style>`;
  const cards = frames.map(({ title, group, theme, markup }) => `<article data-theme="${theme}" ${theme === 'dark' ? 'hidden' : ''} data-group="${group}" data-title="${title.toLowerCase()}"><h2>${escape(title)} <small>${group}</small></h2><iframe title="${escape(title)} mockup" loading="lazy" sandbox="" srcdoc="${escape(`<!doctype html><html class="${theme === 'dark' ? 'dark' : ''}"><head>${head}</head><body><div class="preview-page">${markup}</div></body></html>`)}"></iframe></article>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Twilight · Design gallery</title><style>body{margin:0;background:#fff7fa;color:#211b37;font:14px system-ui}header{max-width:1280px;margin:0 auto;padding:40px 24px 24px}h1{font-size:32px;letter-spacing:-1px;margin:0 0 12px}p{color:#70647c;line-height:1.7;max-width:700px}label,button,select,input{font:inherit}input,select,button{background:#fff;border:1px solid #ead9e4;border-radius:14px;padding:12px;color:#463549}button{cursor:pointer}aside{display:flex;gap:12px;flex-wrap:wrap;margin-top:24px}main{max-width:1280px;display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:32px;margin:auto;padding:0 24px 40px}article{min-width:0}h2{font-size:14px;font-weight:600;display:flex;justify-content:space-between;max-width:390px;margin:0 auto 12px}small{color:#82748d;font-weight:400}iframe{display:block;width:100%;max-width:390px;height:810px;border:1px solid #ecdfe8;border-radius:32px;box-shadow:0 16px 40px -25px #b56489;background:#fff7fa;margin:auto}body.desktop main{display:block}body.desktop article{margin-bottom:40px}body.desktop iframe,body.desktop h2{max-width:1100px}article[hidden]{display:none}a{color:#a82454}</style></head><body><header><h1>A little space to bloom.</h1><p>Twilight Garden · ${frames.length / 2} pages in white and dark mode, rendered from the actual frontend. Fictional sample data. Games show ready-to-start lobbies. These are static layout previews; use the app to test buttons, live chat, and navigation. Redirect endpoints are omitted.</p><aside><input id="search" type="search" placeholder="Find a page…" aria-label="Find a page"><select id="appearance" aria-label="Appearance"><option value="light">White mode</option><option value="dark">Dark mode</option></select><select id="group" aria-label="Filter pages"><option>All pages</option><option>Your space</option><option>Partner</option><option>Games</option><option>Admin</option><option>Legal</option></select><button id="size">Desktop layout</button><a href="/#/dashboard">Open the app →</a></aside></header><main>${cards}</main><script>const search=document.querySelector('#search'),group=document.querySelector('#group'),appearance=document.querySelector('#appearance');function filter(){for(const card of document.querySelectorAll('article'))card.hidden=!(card.dataset.theme===appearance.value&&card.dataset.title.includes(search.value.toLowerCase())&&(group.value==='All pages'||card.dataset.group===group.value))}search.oninput=filter;group.onchange=filter;appearance.onchange=filter;document.querySelector('#size').onclick=e=>{document.body.classList.toggle('desktop');e.target.textContent=document.body.classList.contains('desktop')?'Phone layout':'Desktop layout'}</script></body></html>`;
  mkdirSync('tmp', { recursive: true });
  writeFileSync('tmp/design-preview.html', html);
  console.log(`Created ${frames.length} page mockups: http://127.0.0.1:3000/tmp/design-preview.html`);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
