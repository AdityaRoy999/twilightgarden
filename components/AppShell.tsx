import React, { useEffect, useRef, useState } from "react";
import { useDialogFocus } from "../hooks/useDialogFocus";
import { NavLink, Outlet, useLocation, Link } from "react-router-dom";
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
  X,
  Ellipsis,
  Flower2,
} from "lucide-react";

type Mode = "tracker" | "partner" | "admin";
export default function AppShell({ mode = "tracker" }: { mode?: Mode }) {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("navigation-collapsed") === "true",
  );
  const [more, setMore] = useState(false);
  const dialog = useRef<HTMLElement>(null);
  useDialogFocus(dialog, more);
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
  const primary = items.slice(0, 4),
    secondary = items.slice(4);
  const hide =
    /^\/(?:partner\/|admin\/)?games\//.test(location.pathname) ||
    [
      "/log/details",
      "/settings/cycle-length",
      "/settings/period-length",
      "/settings/profile",
    ].includes(location.pathname);
  useEffect(() => {
    setMore(false);
  }, [location.pathname]);
  useEffect(() => {
    localStorage.setItem("navigation-collapsed", String(collapsed));
  }, [collapsed]);
  useEffect(() => {
    if (!more) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMore(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [more]);
  const renderLink = (
    item: (typeof items)[number],
    compact = false,
    reveal = false,
  ) => {
    const { to, label, Icon } = item;
    const isCollapsed = collapsed && !compact && !reveal;
    return (
      <NavLink
        key={to}
        to={to}
        end
        aria-label={label}
        title={label}
        className={({ isActive }) =>
          `flex min-h-12 items-center rounded-xl transition-colors focus-visible:outline-primary ${compact ? "flex-1 flex-col justify-center gap-1 px-1 py-2 text-[11px]" : "gap-3 px-3 py-3 text-sm font-medium " + (isCollapsed ? "justify-center" : "")} ${isActive ? "bg-primary/15 text-primary" : "text-gray-500 hover:bg-black/5 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white"}`
        }
      >
        <Icon
          size={compact ? 21 : 22}
          strokeWidth={1.8}
          aria-hidden="true"
          className="shrink-0"
        />
        <span className={isCollapsed ? "sr-only" : ""}>{label}</span>
      </NavLink>
    );
  };
  return (
    <div className="app-shell flex h-dvh min-h-0 w-full overflow-hidden bg-background-dark text-gray-900 dark:bg-background-dark dark:text-white">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:p-3 focus:text-black"
      >
        Skip to content
      </a>
      {!hide && (
        <aside
          aria-label="Sidebar"
          data-collapsed={collapsed}
          className={`bloom-sidebar hidden h-full shrink-0 flex-col border-r md:flex ${collapsed ? "w-20" : "w-60"}`}
        >
          <div
            className={`mb-6 flex h-12 shrink-0 items-center ${collapsed ? "justify-center" : "justify-between gap-2 px-1"}`}
          >
            {!collapsed && (
              <Link
                to={items[0].to}
                className="flex min-w-0 items-center gap-2 text-primary"
              >
                <Flower2 size={28} aria-hidden="true" />
                <span className="font-display text-lg font-bold">Twilight</span>
              </Link>
            )}
            <button
              onClick={() => setCollapsed((v) => !v)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-gray-500 hover:bg-black/5 dark:text-gray-400 dark:hover:bg-white/5"
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
          {!collapsed && (
            <footer><Flower2 size={25}/><strong>A little closer, every day</strong><p>{mode === "partner" ? "Small moments of care make a difference." : "Your body. Your rhythm. A space that grows with you."}</p></footer>
          )}
        </aside>
      )}
      <div
        className={`flex min-h-0 min-w-0 flex-1 flex-col ${!hide ? "pb-[calc(68px+env(safe-area-inset-bottom))] md:pb-0" : ""}`}
      >
        <main
          id="main-content"
          className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain"
        >
          <div key={location.pathname} className="bloom-route mx-auto h-full min-h-full w-full max-w-[1440px]">
            <Outlet />
          </div>
        </main>
      </div>
      {!hide && (
        <nav
          aria-label="Mobile navigation"
          className="bloom-mobile-nav fixed inset-x-0 bottom-0 z-40 flex min-h-[68px] items-center px-2 pb-[env(safe-area-inset-bottom)] md:hidden"
        >
          {primary.map((item) => renderLink(item, true))}
          <button
            aria-label="More navigation"
            aria-expanded={more}
            onClick={() => setMore((v) => !v)}
            className="flex min-h-12 flex-1 flex-col items-center justify-center gap-1 rounded-xl py-2 text-[11px] text-gray-500 dark:text-gray-400"
          >
            <Ellipsis size={21} />
            <span>More</span>
          </button>
        </nav>
      )}
      {more && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/40 md:hidden"
          onClick={() => setMore(false)}
        >
          <section
            ref={dialog}
            role="dialog"
            aria-modal="true"
            aria-label="More destinations"
            onClick={(event) => event.stopPropagation()}
            className="bloom-sheet w-full rounded-t-3xl bg-white p-5 pb-[calc(24px+env(safe-area-inset-bottom))] dark:bg-surface-dark"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">More</h2>
              <button
                autoFocus
                onClick={() => setMore(false)}
                aria-label="Close navigation"
                className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5"
              >
                <X size={20} />
              </button>
            </div>
            <nav
              aria-label="Additional navigation"
              className="flex flex-col gap-2"
            >
              {secondary.map((item) => renderLink(item, false, true))}
            </nav>
          </section>
        </div>
      )}
    </div>
  );
}
