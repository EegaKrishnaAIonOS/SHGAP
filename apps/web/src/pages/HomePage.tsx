import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  BarChart3,
  Building2,
  Handshake,
  Landmark,
  LogIn,
  Mic,
  MessageSquare,
  Package,
  ShieldCheck,
  Smartphone,
  Store,
  UserPlus,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AccessibilityBar } from "../components/home/AccessibilityBar";
import { HomeCard, type BadgeKey } from "../components/home/HomeCard";
import { LanguageToggle } from "../components/LanguageToggle";
import { useAuth } from "../context/AuthContext";

interface PortalLink {
  to: string;
  icon: LucideIcon;
  label: string;
  description: string;
  badges: BadgeKey[];
}

/**
 * The app's "/" route — a developer/reviewer index linking to every screen,
 * restyled as an AP Government / MEPMA portal landing page rather than a
 * bare wireframe list. Two honest notes on what this is NOT: the AP
 * Government emblem in the utility bar is a placeholder (this repo has no
 * licensed emblem asset — see AccessibilityBar.tsx), and there are no
 * metric "quick stats" here, since this page makes no data calls of its
 * own — real numbers belong on the dashboards it links to, not invented
 * here.
 */
export function HomePage() {
  const { t } = useTranslation();
  const { isAuthenticated, profile } = useAuth();

  const shgLinks: PortalLink[] = [
    {
      to: "/marketplace",
      icon: Store,
      label: t("nav.marketplace"),
      description: t("marketplace.subtitle"),
      badges: ["mobileFirst", "publicAccess"],
    },
    {
      to: "/register",
      icon: UserPlus,
      label: t("nav.registration"),
      description: t("home.cardRegistrationDesc"),
      badges: ["mobileFirst", "loginRequired"],
    },
    {
      to: "/catalogue",
      icon: Package,
      label: t("nav.catalogue"),
      description: t("home.cardCatalogueDesc"),
      badges: ["mobileFirst", "loginRequired"],
    },
    {
      to: "/enquiries",
      icon: MessageSquare,
      label: t("nav.enquiriesReceived"),
      description: t("home.cardEnquiriesDesc"),
      badges: ["mobileFirst", "loginRequired"],
    },
    {
      to: "/voice-assistant",
      icon: Mic,
      label: t("nav.voiceAssistant"),
      description: t("home.cardVoiceDesc"),
      badges: ["mobileFirst", "loginRequired"],
    },
  ];

  const officialLinks: PortalLink[] = [
    {
      to: "/dashboards/district",
      icon: Building2,
      label: t("nav.districtDashboard"),
      description: t("districtDashboard.subtitle"),
      badges: ["desktopFirst", "officerLogin"],
    },
    {
      to: "/dashboards/ulb",
      icon: Users,
      label: t("nav.ulbDashboard"),
      description: t("ulbDashboard.subtitle"),
      badges: ["desktopFirst", "officerLogin"],
    },
    {
      to: "/dashboards/shg",
      icon: Handshake,
      label: t("nav.shgDashboard"),
      description: t("shgDashboard.subtitle"),
      badges: ["desktopFirst", "officerLogin"],
    },
    {
      to: "/dashboards/product",
      icon: BarChart3,
      label: t("nav.productDashboard"),
      description: t("productDashboard.subtitle"),
      badges: ["desktopFirst", "officerLogin"],
    },
    {
      to: "/dashboards/buyer",
      icon: Store,
      label: t("nav.buyerDashboard"),
      description: t("buyerDashboard.subtitle"),
      badges: ["desktopFirst", "officerLogin"],
    },
    {
      to: "/dashboards/government",
      icon: Landmark,
      label: t("nav.governmentDashboard"),
      description: t("governmentDashboard.subtitle"),
      badges: ["desktopFirst", "officerLogin"],
    },
    {
      to: "/admin",
      icon: ShieldCheck,
      label: t("nav.admin"),
      description: t("admin.overviewSubtitle"),
      badges: ["desktopFirst", "officerLogin"],
    },
  ];

  return (
    <div className="min-h-dvh bg-slate-50">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:shadow-modal"
      >
        {t("home.skipToContent")}
      </a>

      <AccessibilityBar />

      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-800 text-amber-400"
              aria-hidden="true"
            >
              <Landmark size={20} strokeWidth={2} />
            </span>
            <div>
              <p className="text-base font-bold leading-tight text-slate-900 sm:text-lg">
                {t("common.appName")}
              </p>
              <p className="text-xs font-medium text-emerald-800">{t("home.department")}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            {isAuthenticated ? (
              <span className="text-sm font-medium text-slate-700">
                {profile?.name ?? profile?.phone}
              </span>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-800 px-4 py-1.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
              >
                <LogIn size={15} strokeWidth={2.5} aria-hidden="true" />
                {t("login.title")}
              </Link>
            )}
          </div>
        </div>
      </header>

      <main id="main-content">
        {/* Hero banner — deep green-to-navy gradient, subtle dot pattern, no
            fabricated stats: this page has no data connection of its own. */}
        <section className="relative overflow-hidden bg-gradient-to-br from-emerald-800 via-emerald-800 to-indigo-900 px-4 py-14 text-white sm:px-6">
          <div
            className="absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage:
                "radial-gradient(circle, #ffffff 1px, transparent 1px)",
              backgroundSize: "22px 22px",
            }}
            aria-hidden="true"
          />
          <div className="relative mx-auto max-w-3xl text-center">
            <span className="mb-4 inline-block rounded-full border border-amber-400/60 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-300">
              {t("home.heroEyebrow")}
            </span>
            <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{t("home.title")}</h1>
            <p className="mx-auto mt-3 max-w-2xl text-emerald-50">{t("home.subtitle")}</p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/marketplace"
                className="rounded-full bg-amber-400 px-6 py-2.5 text-sm font-semibold text-indigo-950 shadow-sm transition-transform hover:-translate-y-0.5"
              >
                {t("home.browseMarketplaceCta")}
              </Link>
              <Link
                to="/login"
                className="rounded-full border border-white/40 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                {t("home.officerLoginCta")}
              </Link>
            </div>
          </div>
        </section>

        {/* Ambient background layer for the card sections below — the
            utility bar/header/hero above are all deliberately opaque brand
            surfaces, so this glow is only ever visible here, not "through"
            them. Pure decoration: aria-hidden, no interactive content. */}
        <div className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px]" aria-hidden="true">
            <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-emerald-900/5 blur-3xl" />
            <div className="absolute -right-32 top-0 h-96 w-96 rounded-full bg-indigo-900/5 blur-3xl" />
            <div
              className="absolute inset-0 opacity-5"
              style={{
                backgroundImage: "radial-gradient(circle, #0f172a 1px, transparent 1px)",
                backgroundSize: "24px 24px",
              }}
            />
          </div>

          <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6">
            <section className="mb-12">
              <div className="mb-1 flex items-center gap-2.5">
                <h2 className="text-2xl font-bold text-slate-900">
                  {t("home.shgFacingHeading")}
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                  <Smartphone size={12} strokeWidth={2.5} aria-hidden="true" />
                  {t("home.sectionPillMember")}
                </span>
              </div>
              <p className="mb-5 text-sm text-slate-500">{t("home.shgFacingSubheading")}</p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {shgLinks.map((link) => (
                  <HomeCard
                    key={link.to}
                    to={link.to}
                    icon={link.icon}
                    title={link.label}
                    description={link.description}
                    badges={link.badges}
                    accent="shg"
                  />
                ))}
              </div>
            </section>

            <section>
              <div className="mb-1 flex items-center gap-2.5">
                <h2 className="text-2xl font-bold text-slate-900">
                  {t("home.officialFacingHeading")}
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-800">
                  <Landmark size={12} strokeWidth={2.5} aria-hidden="true" />
                  {t("home.sectionPillOfficial")}
                </span>
              </div>
              <p className="mb-5 text-sm text-slate-500">{t("home.officialFacingSubheading")}</p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {officialLinks.map((link) => (
                  <HomeCard
                    key={link.to}
                    to={link.to}
                    icon={link.icon}
                    title={link.label}
                    description={link.description}
                    badges={link.badges}
                    accent="official"
                  />
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
        {t("home.footerNote")}
      </footer>
    </div>
  );
}