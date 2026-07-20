import { authFetch } from "./httpClient";
import { mutateJson } from "./offlineMutate";
import type { MutationResult, PaginatedResult, Shg, ShgType } from "./types";

export interface CreateShgInput {
  name: string;
  type: ShgType;
  mepmaRegistrationNumber?: string;
  productionCapacityNote?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  districtId: string;
  ulbId?: string;
  mandalId?: string;
  lat?: number;
  lng?: number;
}

export type UpdateShgInput = Partial<CreateShgInput> & { isActive?: boolean };

export interface ListShgsParams {
  page?: number;
  pageSize?: number;
  districtId?: string;
  type?: ShgType;
  search?: string;
}

export function listShgs(params: ListShgsParams = {}): Promise<PaginatedResult<Shg>> {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.pageSize) qs.set("pageSize", String(params.pageSize));
  if (params.districtId) qs.set("districtId", params.districtId);
  if (params.type) qs.set("type", params.type);
  if (params.search) qs.set("search", params.search);
  const query = qs.toString();
  return authFetch<PaginatedResult<Shg>>(`/shgs${query ? `?${query}` : ""}`);
}

/** Convenience helper for the SHG-facing screens: a plain SHG member's `GET /shgs` is auto-scoped to their own group(s), so the first result is "my SHG". */
export async function getMyShg(): Promise<Shg | null> {
  const result = await listShgs({ page: 1, pageSize: 1 });
  return result.items[0] ?? null;
}

export function getShg(id: string): Promise<Shg> {
  return authFetch<Shg>(`/shgs/${id}`);
}

export function createShg(input: CreateShgInput): Promise<MutationResult<Shg>> {
  return mutateJson<Shg>("POST", "/shgs", input, `Register SHG "${input.name}"`);
}

export function updateShg(id: string, input: UpdateShgInput): Promise<MutationResult<Shg>> {
  return mutateJson<Shg>("PATCH", `/shgs/${id}`, input, "Update SHG details");
}
