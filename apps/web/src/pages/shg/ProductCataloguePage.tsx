import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Card, CardFooter } from "../../components/ui/Card";
import { cn } from "../../lib/cn";
import { getCategories } from "../../lib/api/masterData";
import { deleteProduct, listProducts } from "../../lib/api/products";
import { getMyShg } from "../../lib/api/shgs";
import { ApiError } from "../../lib/api/httpClient";
import type { Category, Product, Shg } from "../../lib/api/types";
import { ProductFormModal } from "./ProductFormModal";

/** Maps every leaf (child) category id to its top-level parent id, so the chip filter (which only shows the 5 top-level groups) can match products by their leaf `categoryId`. */
function buildCategoryLookup(categories: Category[]) {
  const topLevelIdByCategoryId = new Map<string, string>();
  const nameByCategoryId = new Map<string, string>();
  for (const parent of categories) {
    nameByCategoryId.set(parent.id, parent.name);
    topLevelIdByCategoryId.set(parent.id, parent.id);
    for (const child of parent.children ?? []) {
      nameByCategoryId.set(child.id, child.name);
      topLevelIdByCategoryId.set(child.id, parent.id);
    }
  }
  return { topLevelIdByCategoryId, nameByCategoryId };
}

/**
 * Real product catalogue for the signed-in member's own SHG: fetches the
 * caller's SHG (self-scoped `GET /shgs`), its products, and the category
 * taxonomy, with client-side search + category-group filter chips, and
 * add/edit/delete wired to the live product-registry endpoints. Camera/
 * gallery photo capture lives in `ProductFormModal` -> `ProductImageCapture`.
 */
export function ProductCataloguePage() {
  const { t } = useTranslation();
  const [shg, setShg] = useState<Shg | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [pageNotice, setPageNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const [myShg, cats] = await Promise.all([getMyShg(), getCategories()]);
        if (cancelled) return;
        setShg(myShg);
        setCategories(cats);
        if (myShg) {
          const result = await listProducts({ shgId: myShg.id, pageSize: 100 });
          if (!cancelled) setProducts(result.items);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof ApiError ? err.message : t("catalogue.loadFailed"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const { topLevelIdByCategoryId, nameByCategoryId } = useMemo(
    () => buildCategoryLookup(categories),
    [categories],
  );

  const filtered = useMemo(
    () =>
      products.filter((p) => {
        const matchesQuery = p.name.toLowerCase().includes(query.toLowerCase());
        const matchesCategory =
          !categoryFilter || topLevelIdByCategoryId.get(p.categoryId) === categoryFilter;
        return matchesQuery && matchesCategory;
      }),
    [products, query, categoryFilter, topLevelIdByCategoryId],
  );

  function handleSaved(product: Product) {
    setProducts((prev) => {
      const exists = prev.some((p) => p.id === product.id);
      return exists ? prev.map((p) => (p.id === product.id ? product : p)) : [product, ...prev];
    });
  }

  async function handleDelete(product: Product) {
    if (!window.confirm(t("catalogue.confirmDelete", { name: product.name }))) return;
    const result = await deleteProduct(product.id);
    setProducts((prev) => prev.filter((p) => p.id !== product.id));
    if (result.status === "queued") {
      setPageNotice(t("catalogue.deleteQueued"));
    }
  }

  if (loading) {
    return <p className="text-neutral-500">{t("common.loading")}</p>;
  }

  if (!shg) {
    return (
      <Card className="text-center">
        <span className="mb-2 block text-4xl" aria-hidden="true">
          🏷️
        </span>
        <p className="mb-4 text-neutral-600">{t("catalogue.registerFirst")}</p>
        <Link
          to="/register"
          className="inline-flex min-h-touch items-center justify-center rounded-md bg-brand-400 px-6 text-lg font-medium text-white"
        >
          {t("catalogue.registerFirstCta")}
        </Link>
      </Card>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-neutral-900">{t("catalogue.title")}</h1>
        <Button
          size="sm"
          onClick={() => {
            setEditingProduct(null);
            setModalOpen(true);
          }}
        >
          + {t("catalogue.addProduct")}
        </Button>
      </div>

      {loadError && <p className="mb-3 text-sm text-danger-500">{loadError}</p>}
      {pageNotice && <p className="mb-3 text-sm text-warning-700">{pageNotice}</p>}

      <div className="mb-3">
        <Input
          label={t("common.search")}
          placeholder={t("catalogue.searchPlaceholder")}
          fieldSize="touch"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label={t("dashboard.filters")}>
        <button
          type="button"
          onClick={() => setCategoryFilter(null)}
          className={cn(
            "min-h-touch-sm rounded-full border px-4 text-sm font-medium",
            categoryFilter === null
              ? "border-brand-400 bg-brand-50 text-brand-500"
              : "border-neutral-300 text-neutral-600",
          )}
        >
          {t("catalogue.allCategories")}
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setCategoryFilter(cat.id)}
            className={cn(
              "min-h-touch-sm rounded-full border px-4 text-sm font-medium",
              categoryFilter === cat.id
                ? "border-brand-400 bg-brand-50 text-brand-500"
                : "border-neutral-300 text-neutral-600",
            )}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-neutral-500">{t("catalogue.noProducts")}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((product) => (
            <Card key={product.id} padded={false} className="overflow-hidden">
              <button
                type="button"
                className="flex aspect-square w-full items-center justify-center bg-neutral-100 text-3xl text-neutral-300"
                onClick={() => {
                  setEditingProduct(product);
                  setModalOpen(true);
                }}
                aria-label={t("catalogue.edit")}
              >
                {product.images[0] ? (
                  <img
                    src={product.images[0].thumbnailUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span aria-hidden="true">🖼️</span>
                )}
              </button>
              <div className="p-3">
                <h2 className="line-clamp-2 text-sm font-semibold text-neutral-900">
                  {product.name}
                </h2>
                <p className="mt-1 text-xs text-neutral-500">
                  {nameByCategoryId.get(product.categoryId) ?? ""}
                </p>
                <p className="mt-1 text-base font-semibold text-brand-500">
                  {t("catalogue.price")}: ₹{product.price}
                </p>
                <p className="mt-0.5 text-xs text-neutral-500">
                  {t("catalogue.form.stock")}: {product.stock} ·{" "}
                  {product.isAvailable ? t("catalogue.available") : t("catalogue.unavailable")}
                </p>
                <CardFooter className="mt-2 flex gap-2 border-t-0 p-0">
                  <Button
                    size="sm"
                    variant="outline"
                    fullWidth
                    onClick={() => {
                      setEditingProduct(product);
                      setModalOpen(true);
                    }}
                  >
                    {t("catalogue.edit")}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    fullWidth
                    onClick={() => void handleDelete(product)}
                  >
                    {t("catalogue.delete")}
                  </Button>
                </CardFooter>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ProductFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        shgId={shg.id}
        categories={categories}
        product={editingProduct}
        onSaved={handleSaved}
      />
    </div>
  );
}
