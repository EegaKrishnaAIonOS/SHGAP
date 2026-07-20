import { authFetch } from "./httpClient";
import type { PaginatedResult, UserProfile } from "./types";

export interface ListUsersParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

export function listUsers(params: ListUsersParams = {}): Promise<PaginatedResult<UserProfile>> {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.pageSize) qs.set("pageSize", String(params.pageSize));
  if (params.search) qs.set("search", params.search);
  const query = qs.toString();
  return authFetch<PaginatedResult<UserProfile>>(`/users${query ? `?${query}` : ""}`);
}

export function updateUserStatus(id: string, status: "ACTIVE" | "SUSPENDED"): Promise<UserProfile> {
  return authFetch<UserProfile>(`/users/${id}`, { method: "PATCH", body: { status } });
}
