import { authFetch } from "./httpClient";
import type { Category, District, Mandal, Ulb } from "./types";

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
