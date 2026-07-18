import { authFetch } from "./httpClient";
import type { CategorySuggestion } from "./types";

/**
 * Best-effort "this product looks like it belongs in <category>" suggestion
 * for the product form (T08) — never authoritative. The caller must still
 * let the user confirm/override via the category pickers.
 */
export function suggestCategories(
  name: string,
  description: string | undefined,
): Promise<CategorySuggestion[]> {
  return authFetch<CategorySuggestion[]>("/categorization/suggest", {
    method: "POST",
    body: { name, description },
  });
}
