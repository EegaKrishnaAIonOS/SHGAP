import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card, CardDescription, CardTitle } from "../components/ui/Card";
import { LanguageToggle } from "../components/LanguageToggle";
import { WireframeBanner } from "../components/WireframeBanner";

interface WireframeLink {
  to: string;
  label: string;
  description: string;
}

/**
 * Not one of the T04 wireframe screens itself — this is a developer/reviewer
 * index page (the app's "/" route) linking out to every wireframe route, so
 * the deliverable can be reviewed end-to-end without knowing the URLs.
 */
export function HomePage() {
  const { t } = useTranslation();

  const shgLinks: WireframeLink[] = [
    { to: "/register", label: t("nav.registration"), description: t("registration.title") },
    { to: "/catalogue", label: t("nav.catalogue"), description: t("catalogue.title") },
    { to: "/voice-assistant", label: t("nav.voiceAssistant"), description: t("voice.title") },
  ];

  const officialLinks: WireframeLink[] = [
    {
      to: "/dashboards/district",
      label: t("nav.districtDashboard"),
      description: t("districtDashboard.subtitle"),
    },
    {
      to: "/dashboards/ulb",
      label: t("nav.ulbDashboard"),
      description: t("ulbDashboard.subtitle"),
    },
    {
      to: "/dashboards/shg",
      label: t("nav.shgDashboard"),
      description: t("shgDashboard.subtitle"),
    },
    {
      to: "/dashboards/product",
      label: t("nav.productDashboard"),
      description: t("productDashboard.subtitle"),
    },
    {
      to: "/dashboards/buyer",
      label: t("nav.buyerDashboard"),
      description: t("buyerDashboard.subtitle"),
    },
    {
      to: "/dashboards/government",
      label: t("nav.governmentDashboard"),
      description: t("governmentDashboard.subtitle"),
    },
    { to: "/admin", label: t("nav.admin"), description: t("admin.subtitle") },
  ];

  return (
    <div className="mx-auto min-h-dvh max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 sm:text-3xl">{t("home.title")}</h1>
          <p className="mt-2 max-w-2xl text-neutral-600">{t("home.subtitle")}</p>
        </div>
        <LanguageToggle />
      </div>

      <WireframeBanner />

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-neutral-900">
          {t("home.shgFacingHeading")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {shgLinks.map((link) => (
            <Link key={link.to} to={link.to} className="block">
              <Card className="h-full transition-shadow hover:shadow-raised">
                <CardTitle>{link.label}</CardTitle>
                <CardDescription>{link.description}</CardDescription>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-neutral-900">
          {t("home.officialFacingHeading")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {officialLinks.map((link) => (
            <Link key={link.to} to={link.to} className="block">
              <Card className="h-full transition-shadow hover:shadow-raised">
                <CardTitle>{link.label}</CardTitle>
                <CardDescription>{link.description}</CardDescription>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
