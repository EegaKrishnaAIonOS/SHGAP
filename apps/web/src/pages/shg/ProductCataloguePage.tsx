import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Card, CardFooter } from "../../components/ui/Card";
import { WireframeBanner } from "../../components/WireframeBanner";
import { cn } from "../../lib/cn";

interface Product {
  id: string;
  name: string;
  price: number;
  shg: string;
  category: string;
}

// Placeholder catalogue data — replaced by the product-service API in T06+.
const PRODUCTS: Product[] = [
  { id: "p1", name: "Turmeric Powder (500g)", price: 120, shg: "Jyothi SHG", category: "Spices" },
  { id: "p2", name: "Palm Leaf Basket", price: 250, shg: "Sneha SHG", category: "Handicrafts" },
  {
    id: "p3",
    name: "Cotton Handloom Saree",
    price: 1400,
    shg: "Lakshmi SHG",
    category: "Textiles",
  },
  { id: "p4", name: "Millet Snack Mix (250g)", price: 90, shg: "Jyothi SHG", category: "Food" },
  { id: "p5", name: "Bamboo Craft Lamp", price: 550, shg: "Sneha SHG", category: "Handicrafts" },
  {
    id: "p6",
    name: "Red Chilli Powder (500g)",
    price: 140,
    shg: "Lakshmi SHG",
    category: "Spices",
  },
];

const CATEGORIES = ["Spices", "Handicrafts", "Textiles", "Food"];

/**
 * Product catalogue wireframe. Mobile-first grid of large product cards
 * (image placeholder + name + price + SHG), a category chip filter instead
 * of a dropdown (fewer taps, easier to scan), and a voice-search entry
 * point that routes to the Voice Assistant screen — reflecting how a
 * low-literacy user is expected to search primarily by speaking.
 */
export function ProductCataloguePage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      PRODUCTS.filter((p) => {
        const matchesQuery = p.name.toLowerCase().includes(query.toLowerCase());
        const matchesCategory = !category || p.category === category;
        return matchesQuery && matchesCategory;
      }),
    [query, category],
  );

  return (
    <div>
      <WireframeBanner />
      <h1 className="mb-3 text-xl font-semibold text-neutral-900">{t("catalogue.title")}</h1>

      <div className="mb-3 flex items-center gap-2">
        <div className="flex-1">
          <Input
            label={t("common.search")}
            placeholder={t("catalogue.searchPlaceholder")}
            fieldSize="touch"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Link
          to="/voice-assistant"
          aria-label={t("catalogue.voiceSearchLabel")}
          className="flex h-touch w-touch items-center justify-center rounded-full bg-brand-50 text-xl text-brand-500"
        >
          <span aria-hidden="true">🎙️</span>
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label={t("dashboard.filters")}>
        <button
          type="button"
          onClick={() => setCategory(null)}
          className={cn(
            "min-h-touch-sm rounded-full border px-4 text-sm font-medium",
            category === null
              ? "border-brand-400 bg-brand-50 text-brand-500"
              : "border-neutral-300 text-neutral-600",
          )}
        >
          {t("catalogue.allCategories")}
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            className={cn(
              "min-h-touch-sm rounded-full border px-4 text-sm font-medium",
              category === cat
                ? "border-brand-400 bg-brand-50 text-brand-500"
                : "border-neutral-300 text-neutral-600",
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {filtered.map((product) => (
          <Card key={product.id} padded={false} className="overflow-hidden">
            <div
              className="flex aspect-square items-center justify-center bg-neutral-100 text-3xl text-neutral-300"
              aria-hidden="true"
            >
              🖼️
            </div>
            <div className="p-3">
              <h2 className="line-clamp-2 text-sm font-semibold text-neutral-900">
                {product.name}
              </h2>
              <p className="mt-1 text-xs text-neutral-500">
                {t("catalogue.byShg", { shg: product.shg })}
              </p>
              <p className="mt-1 text-base font-semibold text-brand-500">
                {t("catalogue.price")}: ₹{product.price}
              </p>
              <CardFooter className="mt-2 border-t-0 p-0">
                <Button size="sm" fullWidth>
                  {t("catalogue.enquire")}
                </Button>
              </CardFooter>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
