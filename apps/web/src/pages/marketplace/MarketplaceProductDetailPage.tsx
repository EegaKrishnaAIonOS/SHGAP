import { useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { useAuth } from "../../context/AuthContext";
import { useAsyncData } from "../../lib/useAsyncData";
import { getMarketplaceProduct } from "../../lib/api/marketplace";
import { EnquiryModal } from "./EnquiryModal";

/** Public (no login) single-product view — Phase 1. Reads
 * `GET /marketplace/products/:id`, the same underlying `ProductsService
 * .findOne` the authenticated product endpoint uses (see plan: reused
 * as-is, no PII/scoping concerns on a single product).
 *
 * Phase 2 adds the "Enquire" action here — logged-in opens `EnquiryModal`;
 * logged-out navigates to `/login` with `state.from` set to this page's own
 * path, reusing the exact redirect-back shape `ProtectedRoute`/`LoginPage`
 * already implement, so login lands the visitor right back here. */
export function MarketplaceProductDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [enquiryOpen, setEnquiryOpen] = useState(false);

  const { data: product, loading, error } = useAsyncData(
    () => getMarketplaceProduct(id!),
    [id],
    t("marketplace.productLoadError"),
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <p className="text-neutral-500">{t("common.loading")}</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <p className="text-danger-500">{error ?? t("marketplace.productLoadError")}</p>
        <Link to="/marketplace" className="mt-3 inline-block text-brand-500 underline">
          {t("marketplace.backToBrowse")}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link to="/marketplace" className="mb-4 inline-block text-sm text-brand-500 underline">
        {t("marketplace.backToBrowse")}
      </Link>

      <Card>
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="flex aspect-square items-center justify-center overflow-hidden rounded-md bg-neutral-100 text-5xl text-neutral-300">
            {product.images[0] ? (
              <img
                src={product.images[0].url}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <span aria-hidden="true">🖼️</span>
            )}
          </div>

          <div>
            <h1 className="text-xl font-semibold text-neutral-900">{product.name}</h1>
            {product.category && (
              <p className="mt-1 text-sm text-neutral-500">{product.category.name}</p>
            )}
            <p className="mt-3 text-2xl font-semibold text-brand-500">
              ₹{product.price} <span className="text-sm text-neutral-500">/ {product.unit}</span>
            </p>
            {product.description && (
              <p className="mt-3 text-neutral-700">{product.description}</p>
            )}
            <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <dt className="text-neutral-500">{t("catalogue.form.moq")}</dt>
              <dd className="text-neutral-900">{product.moq}</dd>
              <dt className="text-neutral-500">{t("catalogue.form.stock")}</dt>
              <dd className="text-neutral-900">{product.stock}</dd>
              <dt className="text-neutral-500">{t("common.status")}</dt>
              <dd className="text-neutral-900">
                {product.isAvailable ? t("catalogue.available") : t("catalogue.unavailable")}
              </dd>
            </dl>

            <div className="mt-4 flex flex-wrap gap-3">
              {product.shg && (
                <Link
                  to={`/marketplace/shgs/${product.shg.id}`}
                  className="inline-flex items-center rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
                >
                  {t("marketplace.viewStorefront", { shg: product.shg.name })}
                </Link>
              )}
              <Button
                onClick={() => {
                  if (isAuthenticated) {
                    setEnquiryOpen(true);
                  } else {
                    navigate("/login", { state: { from: location.pathname } });
                  }
                }}
              >
                {isAuthenticated
                  ? t("marketplace.enquiry.enquireButton")
                  : t("marketplace.enquiry.loginToEnquire")}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <EnquiryModal open={enquiryOpen} onClose={() => setEnquiryOpen(false)} product={product} />
    </div>
  );
}