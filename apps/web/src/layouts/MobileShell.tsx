import { useEffect, useRef } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { cn } from "../lib/cn";
import { SyncStatusBanner } from "../components/SyncStatusBanner";
import { useAuth } from "../context/AuthContext";

// Exposes this shell's fixed bottom tab bar height as a CSS variable so
// other fixed-positioned, app-root-mounted elements (e.g. FloatingChatWidget,
// which renders outside this shell and has no other way to know the tab
// bar exists) can clear it instead of overlapping it.
const NAV_HEIGHT_VAR = "--mobile-shell-nav-height";

/**
 * Mobile-first app shell for SHG-member-facing screens (catalogue, voice
 * assistant). Optimised for low-end Android phones and
 * low-digital-literacy users: a single-column layout, a minimal top bar,
 * and a bottom tab bar with large icon + label touch targets instead of a
 * hidden hamburger menu (which tests poorly with first-time smartphone
 * users).
 */
export function MobileShell() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const navRef = useRef<HTMLElement>(null);

  const tabs = [
    { to: "/catalogue", icon: "🛒", label: "Product Catalogue" },
    { to: "/voice-assistant", icon: "🎙️", label: "Voice Assistant" },
  ];

  // Track the tab bar's real rendered height (it varies with label wrapping
  // across languages/screen sizes) rather than assuming a fixed value.
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const root = document.documentElement;
    const updateHeight = () => root.style.setProperty(NAV_HEIGHT_VAR, `${el.offsetHeight}px`);
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty(NAV_HEIGHT_VAR);
    };
  }, []);

  return (
    <div className="flex min-h-dvh flex-col bg-neutral-50">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3">
        <NavLink to="/" className="text-base font-semibold text-neutral-900">
          lakshmi
        </NavLink>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              void logout().finally(() => navigate("/login", { replace: true }));
            }}
            className="min-h-touch-sm px-2 text-sm font-medium text-neutral-500"
          >
            Log out
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-24 pt-4">
        <SyncStatusBanner />
        <Outlet />
      </main>

      <nav
        ref={navRef}
        aria-label="Dashboards"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-neutral-200 bg-white"
      >
        <ul className="mx-auto flex max-w-md">
          {tabs.map((tab) => (
            <li key={tab.to} className="flex-1">
              <NavLink
                to={tab.to}
                className={({ isActive }) =>
                  cn(
                    "flex min-h-touch-lg flex-col items-center justify-center gap-0.5 px-1 py-2 text-xs font-medium",
                    isActive ? "text-brand-400" : "text-neutral-500",
                  )
                }
              >
                <span className="text-xl" aria-hidden="true">
                  {tab.icon}
                </span>
                <span className="text-center leading-tight">{tab.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
