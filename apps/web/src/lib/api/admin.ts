import { authFetch } from "./httpClient";
import type { AdminSummary, UserProfile } from "./types";

/** SHG/product/user counts for the admin home — scoped server-side to the caller's district/ULB. */
export function getAdminSummary(): Promise<AdminSummary> {
  return authFetch<AdminSummary>("/admin/summary");
}

/** Self-registered SHG/Distributor accounts awaiting approval — Consumer
 * self-registrations activate immediately and never appear here. */
export function getPendingUsers(): Promise<UserProfile[]> {
  return authFetch<UserProfile[]>("/admin/users/pending");
}

export function approveUser(id: string): Promise<UserProfile> {
  return authFetch<UserProfile>(`/admin/users/${id}/approve`, { method: "PATCH" });
}

export function rejectUser(id: string): Promise<UserProfile> {
  return authFetch<UserProfile>(`/admin/users/${id}/reject`, { method: "PATCH" });
}
