import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card } from "../../components/ui/Card";
import { useAsyncData } from "../../lib/useAsyncData";
import { getMarketplaceStorefront } from "../../lib/api/marketplace";
import { MarketplaceProductCard } from "./MarketplaceProductCard";

/** Public (no login) SHG storefront — Phase 1. Reads
 * `GET /marketplace/shgs/:id`, which composes `ShgsService.findPublicSummary`
 * (no bank/PII fields — see plan) with that SHG's available products. */
export function MarketplaceStorefrontPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();

  const { data: storefront, loading, error } = useAsyncData(
    () => getMarketplaceStorefront(id!),
    [id],
    t("marketplace.storefrontLoadError"),
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <p className="text-neutral-500">{t("common.loading")}</p>
      </div>
    );
  }

  if (error || !storefront) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <p className="text-danger-500">{error ?? t("marketplace.storefrontLoadError")}</p>
        <Link to="/marketplace" className="mt-3 inline-block text-brand-500 underline">
          {t("marketplace.backToBrowse")}
        </Link>
      </div>
    );
  }

  const { shg, products } = storefront;
  const locationLabel = [shg.mandal?.name, shg.ulb?.name, shg.district?.name]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Link to="/marketplace" className="mb-4 inline-block text-sm text-brand-500 underline">
        {t("marketplace.backToBrowse")}
      </Link>

      <Card className="mb-6">
        <h1 className="text-xl font-semibold text-neutral-900">{shg.name}</h1>
        {locationLabel && <p className="mt-1 text-sm text-neutral-500">{locationLabel}</p>}
        {shg.productionCapacityNote && (
          <p className="mt-2 text-neutral-700">{shg.productionCapacityNote}</p>
        )}
      </Card>

      <h2 className="mb-3 text-lg font-semibold text-neutral-900">
        {t("marketplace.storefrontProducts")}
      </h2>
      {products.length === 0 ? (
        <p className="text-neutral-500">{t("marketplace.noProducts")}</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <MarketplaceProductCard key={product.id} product={product} showShg={false} />
          ))}
        </div>
      )}
    </div>
  );
}