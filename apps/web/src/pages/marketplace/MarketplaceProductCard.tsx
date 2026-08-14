import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card } from "../../components/ui/Card";
import type { Product } from "../../lib/api/types";

export interface MarketplaceProductCardProps {
  product: Product;
  /** Hide the SHG name/link — the storefront page already shows every card
   * under the one SHG being viewed, so repeating its name on each card would
   * be noise there. */
  showShg?: boolean;
}

/** Shared card used by both the marketplace home grid and a storefront's
 * product grid — mirrors ProductCataloguePage.tsx's card markup, minus the
 * edit/delete actions (this is a public, read-only view). */
export function MarketplaceProductCard({ product, showShg = true }: MarketplaceProductCardProps) {
  const { t } = useTranslation();

  return (
    <Link to={`/marketplace/products/${product.id}`} className="block">
      <Card padded={false} className="h-full overflow-hidden transition-shadow hover:shadow-raised">
        <div className="flex aspect-square w-full items-center justify-center bg-neutral-100 text-3xl text-neutral-300">
          {product.images[0] ? (
            <img
              src={product.images[0].thumbnailUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <span aria-hidden="true">🖼️</span>
          )}
        </div>
        <div className="p-3">
          <h3 className="line-clamp-2 text-sm font-semibold text-neutral-900">{product.name}</h3>
          {product.category && (
            <p className="mt-1 text-xs text-neutral-500">{product.category.name}</p>
          )}
          <p className="mt-1 text-base font-semibold text-brand-500">
            {t("catalogue.price")}: ₹{product.price}
          </p>
          {showShg && product.shg && (
            <p className="mt-1 text-xs text-neutral-500">
              {t("catalogue.byShg", { shg: product.shg.name })}
            </p>
          )}
        </div>
      </Card>
    </Link>
  );
}