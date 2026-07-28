/** One provider (an SHG) with its items (products), in the shape Beckn's
 * `on_search` catalog message actually expects (`bpp/providers[].items[]`
 * — field names match the real Beckn Retail v1.1 schema, snake_case
 * included, since a real BAP parses these keys literally). */
export interface BecknCatalogItem {
  id: string;
  descriptor: { name: string; short_desc?: string };
  price: { currency: 'INR'; value: string };
  category_id: string;
  quantity: { available: { count: number } };
}

export interface BecknCatalogProvider {
  id: string;
  descriptor: { name: string };
  locations: [{ id: string; gps?: string; district?: string }];
  items: BecknCatalogItem[];
}

export interface ProductForCatalog {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  categoryId: string;
  shgId: string;
  shgName: string;
  districtName: string;
  lat: number | null;
  lng: number | null;
}

/** Groups real, available products by their SHG into Beckn provider/item
 * records — no ONDC-side ingestion happens here; this is what a real BPP
 * adapter would hand back in response to a buyer app's `/search` call. */
export function buildCatalogProviders(
  products: ProductForCatalog[],
): BecknCatalogProvider[] {
  const byShg = new Map<string, ProductForCatalog[]>();
  for (const product of products) {
    const existing = byShg.get(product.shgId);
    if (existing) existing.push(product);
    else byShg.set(product.shgId, [product]);
  }

  return [...byShg.entries()].map(([shgId, shgProducts]) => ({
    id: shgId,
    descriptor: { name: shgProducts[0].shgName },
    locations: [
      {
        id: `${shgId}-loc-1`,
        district: shgProducts[0].districtName,
        gps:
          shgProducts[0].lat != null && shgProducts[0].lng != null
            ? `${shgProducts[0].lat},${shgProducts[0].lng}`
            : undefined,
      },
    ],
    items: shgProducts.map((product) => ({
      id: product.id,
      descriptor: {
        name: product.name,
        short_desc: product.description ?? undefined,
      },
      price: { currency: 'INR', value: product.price.toFixed(2) },
      category_id: product.categoryId,
      quantity: { available: { count: product.stock } },
    })),
  }));
}
