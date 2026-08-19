import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { LanguageToggle } from "../../components/LanguageToggle";
import { Modal } from "../../components/ui/Modal";

type AuthView = "login" | "register";

const AUTH_IFRAME_SRC: Record<AuthView, string> = {
  login: "/interface/login.html",
  register: "/interface/signup.html",
};

const USER_TYPE_ICONS = ["🧺", "📦", "🛍️"] as const;
const STEP_NUMBERS = [1, 2, 3] as const;

/** Public marketing landing page at `/` — introduces the SHG platform to
 * all three personas before they pick an account type at /signup. Not
 * gated behind auth; the previous "/" dev/QA route index now lives at
 * /_dev (see DevIndexPage). */
export function LandingPage() {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [authView, setAuthView] = useState<AuthView | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // Lets /login and /signup|/register (App.tsx) deep-link straight into the
  // popup instead of the old dedicated pages.
  useEffect(() => {
    const requested = searchParams.get("auth");
    if (requested === "login" || requested === "register") {
      setAuthView(requested);
      setSearchParams(
        (params) => {
          params.delete("auth");
          return params;
        },
        { replace: true },
      );
    }
  }, [searchParams, setSearchParams]);

  function openAuth(view: AuthView) {
    setMenuOpen(false);
    setAuthView(view);
  }

  const navLinks = [
    { href: "#about", label: t("nav.about") },
    { href: "#how-it-works", label: t("nav.howItWorks") },
  ];

  return (
    <div className="min-h-dvh bg-white text-neutral-900">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="text-lg font-semibold text-marketing-700">
            {t("common.appName")}
          </Link>

          <nav className="hidden items-center gap-6 md:flex" aria-label={t("nav.primary")}>
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-neutral-600 hover:text-marketing-700"
              >
                {link.label}
              </a>
            ))}
            <button
              type="button"
              onClick={() => openAuth("login")}
              className="text-sm font-medium text-neutral-600 hover:text-marketing-700"
            >
              {t("nav.login")}
            </button>
            <button
              type="button"
              onClick={() => openAuth("register")}
              className="inline-flex h-9 items-center justify-center rounded-md bg-marketing-600 px-4 text-sm font-medium text-white hover:bg-marketing-700"
            >
              {t("nav.register")}
            </button>
          </nav>

          <div className="flex items-center gap-2 md:hidden">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-label={t("nav.toggleMenu")}
              className="flex h-10 w-10 items-center justify-center rounded-md text-neutral-700 hover:bg-neutral-100"
            >
              <span aria-hidden="true" className="text-2xl leading-none">
                {menuOpen ? "✕" : "☰"}
              </span>
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav
            aria-label={t("nav.primary")}
            className="flex flex-col gap-1 border-t border-neutral-200 px-4 py-3 md:hidden"
          >
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="min-h-touch flex items-center rounded-md px-2 text-base font-medium text-neutral-700 hover:bg-neutral-50"
              >
                {link.label}
              </a>
            ))}
            <button
              type="button"
              onClick={() => openAuth("login")}
              className="min-h-touch flex items-center rounded-md px-2 text-base font-medium text-neutral-700 hover:bg-neutral-50"
            >
              {t("nav.login")}
            </button>
            <button
              type="button"
              onClick={() => openAuth("register")}
              className="min-h-touch mt-1 flex items-center justify-center rounded-md bg-marketing-600 px-2 text-base font-medium text-white hover:bg-marketing-700"
            >
              {t("nav.register")}
            </button>
            <div className="mt-2 flex justify-center">
              <LanguageToggle />
            </div>
          </nav>
        )}
      </header>

      <section className="bg-marketing-50">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-16 text-center sm:px-6 lg:py-24">
          <h1 className="max-w-3xl text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl lg:text-5xl">
            {t("landing.hero.headline")}
          </h1>
          <p className="max-w-2xl text-lg text-neutral-600">{t("landing.hero.subtext")}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => openAuth("login")}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-neutral-300 px-5 text-lg font-medium text-neutral-800 hover:bg-neutral-50"
            >
              {t("nav.login")}
            </button>
            <button
              type="button"
              onClick={() => openAuth("register")}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-marketing-600 px-5 text-lg font-medium text-white hover:bg-marketing-700"
            >
              {t("nav.register")}
            </button>
          </div>
        </div>
      </section>

      <section id="about" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="mb-8 text-center text-2xl font-semibold text-neutral-900">
          {t("landing.userTypes.heading")}
        </h2>
        <div className="grid gap-6 sm:grid-cols-3">
          {(["shg", "distributor", "consumer"] as const).map((key, i) => (
            <div key={key} className="rounded-lg border border-neutral-200 p-6 text-center">
              <span className="text-4xl" aria-hidden="true">
                {USER_TYPE_ICONS[i]}
              </span>
              <h3 className="mt-3 text-lg font-semibold text-neutral-900">
                {t(`landing.userTypes.${key}.title`)}
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                {t(`landing.userTypes.${key}.description`)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="bg-neutral-50 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="mb-8 text-center text-2xl font-semibold text-neutral-900">
            {t("landing.howItWorks.heading")}
          </h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {STEP_NUMBERS.map((step) => (
              <div key={step} className="flex flex-col items-center gap-3 text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-marketing-600 text-lg font-semibold text-white">
                  {step}
                </span>
                <h3 className="text-lg font-semibold text-neutral-900">
                  {t(`landing.howItWorks.step${step}.title`)}
                </h3>
                <p className="max-w-xs text-sm text-neutral-600">
                  {t(`landing.howItWorks.step${step}.description`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-neutral-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-neutral-500 sm:px-6">
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            <span className="font-semibold text-neutral-700">{t("common.appName")}</span>
            <a href="#about" className="hover:text-marketing-700">
              {t("nav.about")}
            </a>
            <a href="#" className="hover:text-marketing-700">
              {t("landing.footer.contact")}
            </a>
            <a href="#" className="hover:text-marketing-700">
              {t("landing.footer.terms")}
            </a>
            <a href="#" className="hover:text-marketing-700">
              {t("landing.footer.privacy")}
            </a>
          </div>
          <p className="mt-4 text-center text-neutral-400">
            {t("landing.footer.copyright", { year: new Date().getFullYear() })}
          </p>
        </div>
      </footer>

      <Modal
        open={authView !== null}
        onClose={() => setAuthView(null)}
        title={authView === "register" ? t("nav.register") : t("nav.login")}
        blurBackdrop
        className="max-w-xl"
      >
        {authView && (
          <iframe
            key={authView}
            id="auth-popup-iframe"
            src={AUTH_IFRAME_SRC[authView]}
            title={authView === "register" ? t("nav.register") : t("nav.login")}
            className="h-[75vh] w-full rounded-md border-0"
          />
        )}
      </Modal>
    </div>
  );
}
