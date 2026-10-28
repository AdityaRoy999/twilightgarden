import {useCouples} from '../contexts/CouplesContext';
import {ConnectionScreen} from './ConnectionScreen';
import React, { useEffect, useState } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { motion } from 'framer-motion';
import { useAppMotion } from '../hooks/useAppMotion';
import { springs, motionTransition } from '../lib/motion';
import {navigationSelected} from '../lib/navigation';
import { Outlet, useLocation, Link } from "react-router-dom";
import {
  CalendarDays,
  ChartNoAxesCombined,
  Gamepad2,
  Heart,
  House,
  Menu,
  MessageCircle,
  PanelLeftClose,
  Settings,
  Users,
  Flower2,
} from './ui/Icons';

type Mode = "tracker" | "partner" | "admin";
export default function AppShell({ mode = "tracker" }: { mode?: Mode }) {
  const location = useLocation();
  const { solidNavBg } = useTheme();
  const { reduced } = useAppMotion();
  const chatPage = /^\/(?:partner\/|admin\/)?notes\/?$/.test(location.pathname);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("navigation-collapsed") === "true",
  );
  const prefix =
    mode === "partner" ? "/partner" : mode === "admin" ? "/admin" : "";
  const items =
    mode === "admin"
      ? [
          { to: "/admin/users", label: "Users", Icon: Users },
          { to: "/admin/notes", label: "Chat", Icon: MessageCircle },
          { to: "/admin/games", label: "Games", Icon: Gamepad2 },
          { to: "/admin/logs", label: "Logs", Icon: ChartNoAxesCombined },
          { to: "/admin/profile", label: "Account", Icon: Settings },
        ]
      : [
          { to: prefix + "/dashboard", label: "Today", Icon: House },
          { to: prefix + "/calendar", label: "Calendar", Icon: CalendarDays },
          {
            to: prefix + "/insights",
            label: "Insights",
            Icon: ChartNoAxesCombined,
          },
          { to: prefix + "/notes", label: "Chat", Icon: MessageCircle },
          { to: prefix + "/wellness", label: "Wellness", Icon: Heart },
          { to: prefix + "/games", label: "Games", Icon: Gamepad2 },
          {
            to: mode === "partner" ? "/partner/profile" : "/settings",
            label: "Account",
            Icon: Settings,
          },
        ];
  const hide =
    /^\/(?:partner\/|admin\/)?games\//.test(location.pathname) ||
    [
      "/log/details",
      "/settings/cycle-length",
      "/settings/period-length",
      "/settings/profile",
    ].includes(location.pathname);
  useEffect(() => {
    localStorage.setItem("navigation-collapsed", String(collapsed));
  }, [collapsed]);
  const renderLink = (
    item: (typeof items)[number],
    compact = false,
  ) => {
    const { to, label, Icon } = item;
    const isCollapsed = collapsed && !compact;
    const isActive = navigationSelected(to,location.pathname);
    return (
      <Link
        key={to}
        to={to}
        aria-current={isActive ? 'page' : undefined}
        aria-label={label}
        title={label}
        className={
          `relative isolate flex min-h-12 items-center rounded-xl transition-colors ${compact ? "mobile-link flex-1 flex-col justify-center gap-1 px-1 py-2 text-[11px]" : "sidebar-link py-3 text-sm font-medium "} ${isActive ? "text-primary" : "text-gray-500 hover:bg-black/5 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white"}`
        }
      >
        {isActive && !compact && <span className="nav-spring-pill" aria-hidden="true"/>}
        <Icon
          size={compact ? 21 : 22}
          strokeWidth={1.8}
          aria-hidden="true"
          className="relative z-10 shrink-0"
        />
        <motion.span initial={false} className={`${compact ? 'mobile-link-label' : 'sidebar-link-label'} relative z-10`} aria-hidden={isCollapsed || undefined} animate={{ opacity: isCollapsed ? 0 : 1 }} transition={{duration:reduced?0:.1,delay:reduced||compact||collapsed?0:.12}}>{label}</motion.span>
      </Link>
    );
  };
  return (
    <div data-chat={chatPage} className="app-shell flex h-dvh min-h-0 w-full overflow-hidden bg-background-dark text-gray-900 dark:bg-background-dark dark:text-white">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:p-3 focus:text-black"
      >
        Skip to content
      </a>
      {!hide && (
        <motion.aside
          aria-label="Sidebar"
          data-collapsed={collapsed}
          initial={false}
          animate={{ width: collapsed ? 80 : 240 }}
          transition={{...motionTransition(springs.section, reduced),delay:reduced ? 0 : collapsed ? .07 : 0}}
          className="bloom-sidebar hidden h-full shrink-0 flex-col border-r md:flex"
        >
          <div
            className="sidebar-header relative mb-6 flex h-12 shrink-0 items-center"
          >
              <motion.div className="sidebar-brand" initial={false} animate={{ opacity: collapsed ? 0 : 1 }} transition={{duration:reduced?0:.1,delay:reduced||collapsed?0:.12}} inert={collapsed} aria-hidden={collapsed || undefined}><Link
                to={items[0].to}
                className="flex min-w-0 items-center gap-2 text-primary"
              >
                <Flower2 size={28} aria-hidden="true" />
                <span className="font-display text-lg font-bold">Twilight</span>
              </Link></motion.div>
            <button
              onClick={() => setCollapsed((v) => !v)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
              className="sidebar-toggle flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-gray-500 hover:bg-black/5 dark:text-gray-400 dark:hover:bg-white/5"
            >
              {collapsed ? <Menu size={21} /> : <PanelLeftClose size={21} />}
            </button>
          </div>
          <nav
            aria-label="Main navigation"
            className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto"
          >
            {items.map((item) => renderLink(item))}
          </nav>
            <motion.footer initial={false} animate={{ opacity: collapsed ? 0 : 1 }} transition={{duration:reduced?0:.1,delay:reduced||collapsed?0:.12}} inert={collapsed} aria-hidden={collapsed || undefined}><Flower2 size={25}/><strong>A little closer, every day</strong><p>{mode === "partner" ? "Small moments of care make a difference." : "Your body. Your rhythm. A space that grows with you."}</p></motion.footer>
        </motion.aside>
      )}
      <div
        data-has-nav={!hide}
        className="app-shell-content flex min-h-0 min-w-0 flex-1 flex-col"
      >
        <main
          id="main-content"
          data-chat={chatPage}
          className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain"
        >
          <motion.div key={location.pathname} className={`bloom-route mx-auto h-full min-h-full w-full ${chatPage ? '' : 'max-w-[1440px]'}`} initial={reduced ? false : { x: 10 }} animate={{ opacity: 1, x: 0 }} transition={motionTransition(springs.section, reduced)}>
            <React.Suspense fallback={<div className="route-loading" role="status">Opening your space…</div>}><ConnectionOutlet mode={mode} pathname={location.pathname}/></React.Suspense>
          </motion.div>
        </main>
      </div>
      {!hide && (
        <nav
          aria-label="Mobile navigation"
          data-solid={solidNavBg}
          className="bloom-mobile-nav fixed z-40 flex md:hidden"
        >
          {items.map((item) => renderLink(item, true))}
        </nav>
      )}

    </div>
  );
}

// Keep conversation updates from rerendering the navigation shell.
function ConnectionOutlet({mode,pathname}:{mode:Mode;pathname:string}){
 const {couple,loading}=useCouples();
 const sharedFeature=(mode==='partner'&&!/\/(?:profile|notifications)/.test(pathname))||/^\/games(?:\/|$)/.test(pathname);
 return mode!=='admin'&&!loading&&couple?.status!=='active'&&sharedFeature?<ConnectionScreen/>:<Outlet/>;
}
