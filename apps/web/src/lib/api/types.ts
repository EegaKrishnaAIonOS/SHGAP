export const SHG_TYPES = [
  "FOOD",
  "HANDICRAFTS",
  "HANDLOOM",
  "AGRICULTURE_ALLIED",
  "HOME_BASED_ENTERPRISE",
] as const;

export type ShgType = (typeof SHG_TYPES)[number];

export interface District {
  id: string;
  name: string;
  code: string;
}

export interface Ulb {
  id: string;
  name: string;
  code: string;
  districtId: string;
}

export interface Mandal {
  id: string;
  name: string;
  code: string;
  districtId: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  children?: Category[];
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface Shg {
  id: string;
  name: string;
  type: ShgType;
  mepmaRegistrationNumber: string | null;
  productionCapacityNote: string | null;
  bankAccountNumber: string | null;
  bankIfsc: string | null;
  districtId: string;
  ulbId: string | null;
  mandalId: string | null;
  district?: District;
  ulb?: Ulb | null;
  mandal?: Mandal | null;
  location: GeoPoint | null;
  contactUserId: string;
  isActive: boolean;
  createdAt: string;
}

export interface ProductImage {
  id: string;
  productId: string;
  url: string;
  thumbnailUrl: string;
  isPrimary: boolean;
  createdAt: string;
}

export interface Product {
  id: string;
  shgId: string;
  categoryId: string;
  name: string;
  description: string | null;
  unit: string;
  price: number;
  moq: number;
  stock: number;
  isAvailable: boolean;
  shg?: Shg;
  category?: Category;
  images: ProductImage[];
  location: GeoPoint | null;
  createdAt: string;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ReverseGeocodeResult {
  suggestedDistrictId: string | null;
  suggestedDistrictName: string | null;
  matchedAddressField: string | null;
  rawAddress: Record<string, string>;
}

export interface CategorySuggestion {
  categoryId: string;
  categoryName: string;
  parentCategoryName: string | null;
  score: number;
}

export interface UserProfile {
  id: string;
  phone: string;
  name: string | null;
  userRoles: Array<{ id: string; role: { name: string } }>;
}

/**
 * Common return shape for mutating registry calls (SHG/product create or
 * update). `"queued"` means the request couldn't reach the server (offline
 * or a network error) and has been persisted to the IndexedDB offline queue
 * instead — the caller should tell the user it will sync later rather than
 * treating it as a failure.
 */
export type MutationResult<T> = { status: "ok"; data: T } | { status: "queued" };
