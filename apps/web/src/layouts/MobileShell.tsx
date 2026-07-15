import { NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cn } from "../lib/cn";
import { LanguageToggle } from "../components/LanguageToggle";

/**
 * Mobile-first app shell for SHG-member-facing screens (registration,
 * catalogue, voice assistant). Optimised for low-end Android phones and
 * low-digital-literacy users: a single-column layout, a minimal top bar,
 * and a bottom tab bar with large icon + label touch targets instead of a
 * hidden hamburger menu (which tests poorly with first-time smartphone
 * users).
 */
export function MobileShell() {
  const { t } = useTranslation();

  const tabs = [
    { to: "/register", icon: "📝", label: t("nav.registration") },
    { to: "/catalogue", icon: "🛒", label: t("nav.catalogue") },
    { to: "/voice-assistant", icon: "🎙️", label: t("nav.voiceAssistant") },
  ];

  return (
    <div className="flex min-h-dvh flex-col bg-neutral-50">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3">
        <NavLink to="/" className="text-base font-semibold text-neutral-900">
          {t("common.appName")}
        </NavLink>
        <LanguageToggle size="touch" />
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-24 pt-4">
        <Outlet />
      </main>

      <nav
        aria-label={t("nav.dashboards") ?? "primary"}
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
