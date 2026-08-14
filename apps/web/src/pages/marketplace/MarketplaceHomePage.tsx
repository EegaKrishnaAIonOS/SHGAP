import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Input, Select } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Pagination } from "../../components/ui/Pagination";
import { LanguageToggle } from "../../components/LanguageToggle";
import { useAuth } from "../../context/AuthContext";
import { cn } from "../../lib/cn";
import { useAsyncData } from "../../lib/useAsyncData";
import {
  getMarketplaceCategories,
  getMarketplaceDistricts,
  listMarketplaceProducts,
} from "../../lib/api/marketplace";
import type { MarketplaceSortBy } from "../../lib/api/types";
import { MarketplaceProductCard } from "./MarketplaceProductCard";

const SEARCH_DEBOUNCE_MS = 400;
const PAGE_SIZE = 20;

const SORT_OPTIONS: { value: MarketplaceSortBy; labelKey: string }[] = [
  { value: "newest", labelKey: "marketplace.sortNewest" },
  { value: "price_asc", labelKey: "marketplace.sortPriceAsc" },
  { value: "price_desc", labelKey: "marketplace.sortPriceDesc" },
];

/** Public (no login) marketplace homepage — Phase 1: category nav + search
 * + a paginated product grid, reading from the `@Public()` marketplace
 * endpoints. Mirrors AdminProductsPage.tsx's server-side pagination/search
 * pattern and ProductCataloguePage.tsx's category-chip filter, adapted to
 * `useAsyncData` (already built for this exact fetch/loading/error shape).
 *
 * Phase 3 adds a district filter and sort control (both already supported
 * server-side in Phase 1/3, just not exposed here until now), plus a
 * "Clear filters" empty state distinct from the plain "no products yet"
 * one. */
export function MarketplaceHomePage() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [districtId, setDistrictId] = useState<string>("");
  const [sortBy, setSortBy] = useState<MarketplaceSortBy>("newest");
  const [page, setPage] = useState(1);

  const { data: categories } = useAsyncData(
    () => getMarketplaceCategories(),
    [],
    t("marketplace.categoriesLoadError"),
  );

  const { data: districts } = useAsyncData(
    () => getMarketplaceDistricts(),
    [],
    t("marketplace.districtsLoadError"),
  );

  const {
    data: result,
    loading,
    error,
  } = useAsyncData(
    () =>
      listMarketplaceProducts({
        page,
        pageSize: PAGE_SIZE,
        categoryId: categoryId ?? undefined,
        districtId: districtId || undefined,
        search: search || undefined,
        sortBy,
      }),
    [page, categoryId, districtId, search, sortBy],
    t("marketplace.productsLoadError"),
  );

  // Debounce the free-text search box so every keystroke doesn't refetch —
  // same delay AdminProductsPage.tsx uses for the same reason.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const products = result?.items ?? [];
  const filtersActive = Boolean(search || categoryId || districtId);

  function clearFilters() {
    setSearchInput("");
    setSearch("");
    setCategoryId(null);
    setDistrictId("");
    setPage(1);
  }

  return (
    <div className="mx-auto min-h-dvh max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 sm:text-3xl">
            {t("marketplace.title")}
          </h1>
          <p className="mt-2 max-w-2xl text-neutral-600">{t("marketplace.subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          {isAuthenticated && (
            <Link to="/my-enquiries" className="text-sm text-brand-500 underline">
              {t("marketplace.myEnquiries.navLink")}
            </Link>
          )}
          <LanguageToggle />
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="max-w-sm flex-1">
          <Input
            label={t("common.search")}
            placeholder={t("marketplace.searchPlaceholder")}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <div className="w-48">
          <Select
            label={t("marketplace.districtLabel")}
            options={(districts ?? []).map((d) => ({ value: d.id, label: d.name }))}
            placeholder={t("marketplace.allDistricts")}
            value={districtId}
            onChange={(e) => {
              setDistrictId(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="w-48">
          <Select
            label={t("marketplace.sortBy")}
            options={SORT_OPTIONS.map((opt) => ({ value: opt.value, label: t(opt.labelKey) }))}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as MarketplaceSortBy)}
          />
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label={t("dashboard.filters")}>
        <button
          type="button"
          onClick={() => {
            setCategoryId(null);
            setPage(1);
          }}
          className={cn(
            "min-h-touch-sm rounded-full border px-4 text-sm font-medium",
            categoryId === null
              ? "border-brand-400 bg-brand-50 text-brand-500"
              : "border-neutral-300 text-neutral-600",
          )}
        >
          {t("catalogue.allCategories")}
        </button>
        {(categories ?? []).map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => {
              setCategoryId(cat.id);
              setPage(1);
            }}
            className={cn(
              "min-h-touch-sm rounded-full border px-4 text-sm font-medium",
              categoryId === cat.id
                ? "border-brand-400 bg-brand-50 text-brand-500"
                : "border-neutral-300 text-neutral-600",
            )}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {error && <p className="mb-3 text-sm text-danger-500">{error}</p>}

      {loading ? (
        <p className="text-neutral-500">{t("common.loading")}</p>
      ) : products.length === 0 ? (
        filtersActive ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-neutral-500">{t("marketplace.noProductsFiltered")}</p>
            <Button variant="outline" onClick={clearFilters}>
              {t("marketplace.clearFilters")}
            </Button>
          </div>
        ) : (
          <p className="text-neutral-500">{t("marketplace.noProducts")}</p>
        )
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <MarketplaceProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {result && (
        <Pagination
          page={result.page}
          totalPages={result.totalPages}
          total={result.total}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}