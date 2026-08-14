import { publicFetch } from "./httpClient";
import type {
  Category,
  District,
  MarketplaceSortBy,
  MarketplaceStorefront,
  PaginatedResult,
  Product,
} from "./types";

// Every call here goes through `publicFetch` (no Authorization header) — the
// marketplace's `@Public()` core-api routes need none, unlike every other
// API module in this app, which goes through `authFetch`.

export interface ListMarketplaceProductsParams {
  page?: number;
  pageSize?: number;
  categoryId?: string;
  districtId?: string;
  shgId?: string;
  search?: string;
  sortBy?: MarketplaceSortBy;
}

export function getMarketplaceCategories(): Promise<Category[]> {
  return publicFetch<Category[]>("/marketplace/categories");
}

export function getMarketplaceDistricts(): Promise<District[]> {
  return publicFetch<District[]>("/marketplace/districts");
}

export function listMarketplaceProducts(
  params: ListMarketplaceProductsParams = {},
): Promise<PaginatedResult<Product>> {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.pageSize) qs.set("pageSize", String(params.pageSize));
  if (params.categoryId) qs.set("categoryId", params.categoryId);
  if (params.districtId) qs.set("districtId", params.districtId);
  if (params.shgId) qs.set("shgId", params.shgId);
  if (params.search) qs.set("search", params.search);
  if (params.sortBy) qs.set("sortBy", params.sortBy);
  const query = qs.toString();
  return publicFetch<PaginatedResult<Product>>(
    `/marketplace/products${query ? `?${query}` : ""}`,
  );
}

export function getMarketplaceProduct(id: string): Promise<Product> {
  return publicFetch<Product>(`/marketplace/products/${id}`);
}

export function getMarketplaceStorefront(shgId: string): Promise<MarketplaceStorefront> {
  return publicFetch<MarketplaceStorefront>(`/marketplace/shgs/${shgId}`);
}