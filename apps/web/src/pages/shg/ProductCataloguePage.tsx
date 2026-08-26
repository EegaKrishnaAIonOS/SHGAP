import { useEffect, useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Card, CardFooter } from "../../components/ui/Card";
import { getCategories } from "../../lib/api/masterData";
import { deleteProduct, listProducts } from "../../lib/api/products";
import { getMyShg } from "../../lib/api/shgs";
import { ApiError } from "../../lib/api/httpClient";
import type { Category, Product, Shg } from "../../lib/api/types";
import { ProductFormModal } from "./ProductFormModal";

/** Maps every leaf (child) category id to its display name and slug, so products can be labeled and filtered by their leaf `categoryId`. */
function buildCategoryLookup(categories: Category[]) {
  const nameByCategoryId = new Map<string, string>();
  const slugByCategoryId = new Map<string, string>();
  for (const parent of categories) {
    nameByCategoryId.set(parent.id, parent.name);
    slugByCategoryId.set(parent.id, parent.slug);
    for (const child of parent.children ?? []) {
      nameByCategoryId.set(child.id, child.name);
      slugByCategoryId.set(child.id, child.slug);
    }
  }
  return { nameByCategoryId, slugByCategoryId };
}

// Launch scope is pickles-only for now — remove this filter once other categories go live.
const LAUNCH_CATEGORY_SLUG = "pickles";

/**
 * Real product catalogue for the signed-in member's own SHG: fetches the
 * caller's SHG (self-scoped `GET /shgs`), its products, and the category
 * taxonomy, with client-side search (scoped to pickles only for now — see
 * LAUNCH_CATEGORY_SLUG), and add/edit/delete wired to the live
 * product-registry endpoints. Camera/gallery photo capture lives in
 * `ProductFormModal` -> `ProductImageCapture`.
 */
export function ProductCataloguePage() {
  const [shg, setShg] = useState<Shg | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState("");
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
          setLoadError(
            err instanceof ApiError
              ? err.message
              : "Couldn't load your catalogue. Please try again.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const { nameByCategoryId, slugByCategoryId } = useMemo(
    () => buildCategoryLookup(categories),
    [categories],
  );

  const filtered = useMemo(
    () =>
      products.filter((p) => {
        const matchesQuery = p.name.toLowerCase().includes(query.toLowerCase());
        const matchesLaunchScope = slugByCategoryId.get(p.categoryId) === LAUNCH_CATEGORY_SLUG;
        return matchesQuery && matchesLaunchScope;
      }),
    [products, query, slugByCategoryId],
  );

  function handleSaved(product: Product) {
    setProducts((prev) => {
      const exists = prev.some((p) => p.id === product.id);
      return exists ? prev.map((p) => (p.id === product.id ? product : p)) : [product, ...prev];
    });
  }

  async function handleDelete(product: Product) {
    if (!window.confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
    const result = await deleteProduct(product.id);
    setProducts((prev) => prev.filter((p) => p.id !== product.id));
    if (result.status === "queued") {
      setPageNotice("You're offline — the delete will complete once you're back online.");
    }
  }

  if (loading) {
    return <p className="text-neutral-500">Loading...</p>;
  }

  if (!shg) {
    return (
      <Card className="text-center">
        <span className="mb-2 block text-4xl" aria-hidden="true">
          🏷️
        </span>
        <p className="text-neutral-600">
          Register your SHG before adding products to the catalogue.
        </p>
      </Card>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-neutral-900">Product Catalogue</h1>
        <Button
          size="sm"
          onClick={() => {
            setEditingProduct(null);
            setModalOpen(true);
          }}
        >
          + Add product
        </Button>
      </div>

      {loadError && <p className="mb-3 text-sm text-danger-500">{loadError}</p>}
      {pageNotice && <p className="mb-3 text-sm text-warning-700">{pageNotice}</p>}

      <div className="mb-3">
        <Input
          label="Search"
          placeholder="Search products..."
          fieldSize="touch"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-neutral-500">
          No products yet. Tap "Add product" to list your first one.
        </p>
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
                aria-label="Edit"
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
                  Price: ₹{product.price}
                </p>
                <p className="mt-0.5 text-xs text-neutral-500">
                  Stock: {product.stock} · {product.isAvailable ? "Available" : "Unavailable"}
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
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    fullWidth
                    onClick={() => void handleDelete(product)}
                  >
                    Delete
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
