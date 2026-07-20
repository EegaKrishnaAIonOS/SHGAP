import { authFetch } from "./httpClient";
import type { AdminSummary } from "./types";

/** SHG/product/user counts for the admin home — scoped server-side to the caller's district/ULB. */
export function getAdminSummary(): Promise<AdminSummary> {
  return authFetch<AdminSummary>("/admin/summary");
}
