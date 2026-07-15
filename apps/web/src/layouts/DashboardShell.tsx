import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cn } from "../lib/cn";
import { LanguageToggle } from "../components/LanguageToggle";

/**
 * Desktop-oriented shell for official / power-user screens (the five
 * Module-5 dashboards, the Module-7 government dashboard, and admin).
 * Unlike the SHG-facing MobileShell, this favours information density: a
 * persistent sidebar on desktop (collapsible behind a toggle on small
 * viewports) and a wide content area instead of a single centred column.
 */
export function DashboardShell() {
  const { t } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const links = [
    { to: "/dashboards/district", label: t("nav.districtDashboard") },
    { to: "/dashboards/ulb", label: t("nav.ulbDashboard") },
    { to: "/dashboards/shg", label: t("nav.shgDashboard") },
    { to: "/dashboards/product", label: t("nav.productDashboard") },
    { to: "/dashboards/buyer", label: t("nav.buyerDashboard") },
    { to: "/dashboards/government", label: t("nav.governmentDashboard") },
    { to: "/admin", label: t("nav.admin") },
  ];

  return (
    <div className="min-h-dvh bg-neutral-50 lg:flex">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3 lg:hidden">
        <button
          type="button"
          onClick={() => setSidebarOpen((open) => !open)}
          aria-expanded={sidebarOpen}
          aria-controls="dashboard-sidebar"
          className="rounded-md p-2 text-neutral-600 hover:bg-neutral-100"
        >
          <span aria-hidden="true">☰</span>
          <span className="sr-only">{t("nav.dashboards")}</span>
        </button>
        <span className="font-semibold text-neutral-900">{t("common.appName")}</span>
        <LanguageToggle />
      </header>

      <aside
        id="dashboard-sidebar"
        className={cn(
          "border-b border-neutral-200 bg-white lg:sticky lg:top-0 lg:h-dvh lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r",
          sidebarOpen ? "block" : "hidden lg:block",
        )}
      >
        <div className="hidden items-center justify-between px-4 py-4 lg:flex">
          <NavLink to="/" className="font-semibold text-neutral-900">
            {t("common.appName")}
          </NavLink>
        </div>
        <nav aria-label={t("nav.dashboards")} className="p-3">
          <ul className="flex flex-col gap-1">
            {links.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "block rounded-md px-3 py-2 text-sm font-medium",
                      isActive
                        ? "bg-brand-50 text-brand-500"
                        : "text-neutral-600 hover:bg-neutral-100",
                    )
                  }
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="hidden px-4 py-4 lg:block">
          <LanguageToggle />
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
