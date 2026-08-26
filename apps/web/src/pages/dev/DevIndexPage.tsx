import { Link } from "react-router-dom";
import { Card, CardDescription, CardTitle } from "../../components/ui/Card";
import { WireframeBanner } from "../../components/WireframeBanner";

interface WireframeLink {
  to: string;
  label: string;
  description: string;
}

/**
 * Developer/reviewer index page linking out to every route, so the
 * deliverable can be reviewed end-to-end without knowing the URLs. Used to
 * live at "/" (the app's root); moved to /_dev once "/" became the real
 * marketing landing page (T25) so the QA/dev team doesn't lose this tool.
 */
export function DevIndexPage() {
  const shgLinks: WireframeLink[] = [
    { to: "/catalogue", label: "Product Catalogue", description: "Product Catalogue" },
    { to: "/voice-assistant", label: "Voice Assistant", description: "Voice Assistant" },
  ];

  const officialLinks: WireframeLink[] = [
    {
      to: "/dashboards/district",
      label: "District Dashboard",
      description: "MEPMA district officer view — SHG performance across ULBs and mandals.",
    },
    {
      to: "/dashboards/ulb",
      label: "ULB Dashboard",
      description: "Urban Local Body officer view — SHG and product performance within the ULB.",
    },
    {
      to: "/dashboards/shg",
      label: "SHG Dashboard",
      description:
        "Per-SHG monitoring view — membership, product mix and sales for a single group.",
    },
    {
      to: "/dashboards/product",
      label: "Product Dashboard",
      description: "Catalogue-wide view — category performance, pricing and inventory signals.",
    },
    {
      to: "/dashboards/buyer",
      label: "Buyer Dashboard",
      description: "Buyer engagement view — registered buyers, repeat orders and demand trends.",
    },
    {
      to: "/dashboards/government",
      label: "Government Dashboard",
      description:
        "State-level (MEPMA HQ) view across all districts — Module 7 policy & monitoring dashboard.",
    },
    { to: "/admin", label: "Admin", description: "SHG, product and user counts for your area." },
  ];

  return (
    <div className="mx-auto min-h-dvh max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900 sm:text-3xl">
          SHG Smart Market Linkage Platform
        </h1>
        <p className="mt-2 max-w-2xl text-neutral-600">
          Sprint 0 wireframes (T04) — SHG-facing screens and official dashboards, implemented as
          real routed pages instead of Figma.
        </p>
      </div>

      <WireframeBanner />

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-neutral-900">
          SHG member screens (mobile-first)
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
          Official dashboards (desktop-first)
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
