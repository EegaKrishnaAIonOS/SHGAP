import { authFetch } from "./httpClient";
import type { Category, District, FestivalCalendarEntry, Mandal, Ulb } from "./types";

export function getDistricts(): Promise<District[]> {
  return authFetch<District[]>("/master-data/districts");
}

export function getUlbs(districtId: string): Promise<Ulb[]> {
  return authFetch<Ulb[]>(`/master-data/districts/${districtId}/ulbs`);
}

export function getMandals(districtId: string): Promise<Mandal[]> {
  return authFetch<Mandal[]>(`/master-data/districts/${districtId}/mandals`);
}

/** Top-level categories with `children` nested (2-level taxonomy). */
export function getCategories(): Promise<Category[]> {
  return authFetch<Category[]>("/master-data/categories");
}

// ---------------------------------------------------------------------
// Admin CRUD (T09) — every write below requires the ADMIN role; the
// backend enforces this regardless of what the UI shows.
// ---------------------------------------------------------------------

export interface DistrictInput {
  name: string;
  code: string;
}

export function createDistrict(input: DistrictInput): Promise<District> {
  return authFetch<District>("/master-data/districts", { method: "POST", body: input });
}

export function updateDistrict(id: string, input: Partial<DistrictInput>): Promise<District> {
  return authFetch<District>(`/master-data/districts/${id}`, { method: "PATCH", body: input });
}

export function deleteDistrict(id: string): Promise<void> {
  return authFetch<void>(`/master-data/districts/${id}`, { method: "DELETE" });
}

export interface UlbInput {
  name: string;
  code: string;
  districtId: string;
}

/** Flat list across every district (for the admin CRUD table) — distinct from `getUlbs`, which is per-district. */
export function listAllUlbs(): Promise<Ulb[]> {
  return authFetch<Ulb[]>("/master-data/ulbs");
}

export function createUlb(input: UlbInput): Promise<Ulb> {
  return authFetch<Ulb>("/master-data/ulbs", { method: "POST", body: input });
}

export function updateUlb(id: string, input: Partial<UlbInput>): Promise<Ulb> {
  return authFetch<Ulb>(`/master-data/ulbs/${id}`, { method: "PATCH", body: input });
}

export function deleteUlb(id: string): Promise<void> {
  return authFetch<void>(`/master-data/ulbs/${id}`, { method: "DELETE" });
}

export interface MandalInput {
  name: string;
  code: string;
  districtId: string;
}

/** Flat list across every district (for the admin CRUD table) — distinct from `getMandals`, which is per-district. */
export function listAllMandals(): Promise<Mandal[]> {
  return authFetch<Mandal[]>("/master-data/mandals");
}

export function createMandal(input: MandalInput): Promise<Mandal> {
  return authFetch<Mandal>("/master-data/mandals", { method: "POST", body: input });
}

export function updateMandal(id: string, input: Partial<MandalInput>): Promise<Mandal> {
  return authFetch<Mandal>(`/master-data/mandals/${id}`, { method: "PATCH", body: input });
}

export function deleteMandal(id: string): Promise<void> {
  return authFetch<void>(`/master-data/mandals/${id}`, { method: "DELETE" });
}

export interface CategoryInput {
  name: string;
  slug: string;
  parentId?: string;
}

export function createCategory(input: CategoryInput): Promise<Category> {
  return authFetch<Category>("/master-data/categories", { method: "POST", body: input });
}

export function updateCategory(id: string, input: Partial<CategoryInput>): Promise<Category> {
  return authFetch<Category>(`/master-data/categories/${id}`, { method: "PATCH", body: input });
}

export function deleteCategory(id: string): Promise<void> {
  return authFetch<void>(`/master-data/categories/${id}`, { method: "DELETE" });
}

export interface FestivalCalendarInput {
  name: string;
  startDate: string;
  endDate: string;
  recurring?: boolean;
  districtId?: string;
  description?: string;
}

export function getFestivalCalendar(): Promise<FestivalCalendarEntry[]> {
  return authFetch<FestivalCalendarEntry[]>("/master-data/festival-calendar");
}

export function createFestivalCalendarEntry(
  input: FestivalCalendarInput,
): Promise<FestivalCalendarEntry> {
  return authFetch<FestivalCalendarEntry>("/master-data/festival-calendar", {
    method: "POST",
    body: input,
  });
}

export function updateFestivalCalendarEntry(
  id: string,
  input: Partial<FestivalCalendarInput>,
): Promise<FestivalCalendarEntry> {
  return authFetch<FestivalCalendarEntry>(`/master-data/festival-calendar/${id}`, {
    method: "PATCH",
    body: input,
  });
}

export function deleteFestivalCalendarEntry(id: string): Promise<void> {
  return authFetch<void>(`/master-data/festival-calendar/${id}`, { method: "DELETE" });
}
