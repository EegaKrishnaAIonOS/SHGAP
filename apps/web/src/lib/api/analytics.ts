import { authFetch } from "./httpClient";
import type {
  BuyerRollup,
  CategorySalesRollup,
  DistrictSalesRollup,
  EnquirySummary,
  GeoActivity,
  MarketPriceRecord,
  PaginatedResult,
  ProductRollup,
  RecommendationSummary,
  SalesTrendPoint,
  ShgDetailRollup,
  ShgRollup,
  UlbSalesRollup,
} from "./types";

/** Shared drill-down filters every T18 analytics endpoint accepts — mirrors
 * `AnalyticsFilterDto` on the core-api side exactly. */
export interface AnalyticsFilters {
  districtId?: string;
  ulbId?: string;
  categoryId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  pageSize?: number;
}

function buildQuery(filters: AnalyticsFilters, extra: Record<string, string> = {}): string {
  const qs = new URLSearchParams();
  if (filters.districtId) qs.set("districtId", filters.districtId);
  if (filters.ulbId) qs.set("ulbId", filters.ulbId);
  if (filters.categoryId) qs.set("categoryId", filters.categoryId);
  if (filters.dateFrom) qs.set("dateFrom", filters.dateFrom.toISOString());
  if (filters.dateTo) qs.set("dateTo", filters.dateTo.toISOString());
  if (filters.page) qs.set("page", String(filters.page));
  if (filters.pageSize) qs.set("pageSize", String(filters.pageSize));
  for (const [key, value] of Object.entries(extra)) qs.set(key, value);
  const query = qs.toString();
  return query ? `?${query}` : "";
}

export function getDistrictSales(filters: AnalyticsFilters = {}): Promise<DistrictSalesRollup[]> {
  return authFetch(`/analytics/sales/districts${buildQuery(filters)}`);
}

export function getUlbSales(filters: AnalyticsFilters = {}): Promise<UlbSalesRollup[]> {
  return authFetch(`/analytics/sales/ulbs${buildQuery(filters)}`);
}

export function getCategorySales(filters: AnalyticsFilters = {}): Promise<CategorySalesRollup[]> {
  return authFetch(`/analytics/sales/categories${buildQuery(filters)}`);
}

export type SalesTrendBucket = "day" | "week" | "month";

export function getSalesTrend(
  bucket: SalesTrendBucket = "month",
  filters: AnalyticsFilters = {},
): Promise<SalesTrendPoint[]> {
  return authFetch(`/analytics/sales/trend${buildQuery(filters, { bucket })}`);
}

export function getRecommendationSummary(
  filters: AnalyticsFilters = {},
): Promise<RecommendationSummary> {
  return authFetch(`/analytics/recommendations/summary${buildQuery(filters)}`);
}

export function getShgs(filters: AnalyticsFilters = {}): Promise<PaginatedResult<ShgRollup>> {
  return authFetch(`/analytics/shgs${buildQuery(filters)}`);
}

export function getShgDetail(id: string): Promise<ShgDetailRollup> {
  return authFetch(`/analytics/shgs/${id}`);
}

export function getProducts(
  filters: AnalyticsFilters = {},
): Promise<PaginatedResult<ProductRollup>> {
  return authFetch(`/analytics/products${buildQuery(filters)}`);
}

export function getBuyers(filters: AnalyticsFilters = {}): Promise<PaginatedResult<BuyerRollup>> {
  return authFetch(`/analytics/buyers${buildQuery(filters)}`);
}

export function getGeoActivity(filters: AnalyticsFilters = {}): Promise<GeoActivity> {
  return authFetch(`/analytics/geo/activity${buildQuery(filters)}`);
}

export function getEnquirySummary(filters: AnalyticsFilters = {}): Promise<EnquirySummary> {
  return authFetch(`/analytics/enquiries/summary${buildQuery(filters)}`);
}

export interface MarketPricesFilters {
  district?: string;
  commodity?: string;
  limit?: number;
}

export function getMarketPrices(filters: MarketPricesFilters = {}): Promise<MarketPriceRecord[]> {
  const qs = new URLSearchParams();
  if (filters.district) qs.set("district", filters.district);
  if (filters.commodity) qs.set("commodity", filters.commodity);
  if (filters.limit) qs.set("limit", String(filters.limit));
  const query = qs.toString();
  return authFetch(`/analytics/market-prices${query ? `?${query}` : ""}`);
}

export function refreshAnalyticsViews(): Promise<{ refreshedAt: string; views: string[] }> {
  return authFetch("/analytics/refresh-views", { method: "POST" });
}
