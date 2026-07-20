import { enqueueItem } from "../offlineQueue/db";
import {
  API_BASE,
  ApiError,
  NetworkError,
  authFetch,
  getAccessTokenForRequest,
  isNetworkError,
  refreshTokens,
} from "./httpClient";
import { mutateJson } from "./offlineMutate";
import type { MutationResult, PaginatedResult, Product, ProductImage } from "./types";

export interface CreateProductInput {
  shgId: string;
  categoryId: string;
  name: string;
  description?: string;
  unit: string;
  price: number;
  moq?: number;
  stock?: number;
  isAvailable?: boolean;
  lat?: number;
  lng?: number;
}

export type UpdateProductInput = Partial<Omit<CreateProductInput, "shgId">>;

export interface ListProductsParams {
  page?: number;
  pageSize?: number;
  categoryId?: string;
  shgId?: string;
  districtId?: string;
  isAvailable?: boolean;
  search?: string;
}

export function listProducts(params: ListProductsParams = {}): Promise<PaginatedResult<Product>> {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.pageSize) qs.set("pageSize", String(params.pageSize));
  if (params.categoryId) qs.set("categoryId", params.categoryId);
  if (params.shgId) qs.set("shgId", params.shgId);
  if (params.districtId) qs.set("districtId", params.districtId);
  if (params.isAvailable !== undefined) qs.set("isAvailable", String(params.isAvailable));
  if (params.search) qs.set("search", params.search);
  const query = qs.toString();
  return authFetch<PaginatedResult<Product>>(`/products${query ? `?${query}` : ""}`);
}

export function getProduct(id: string): Promise<Product> {
  return authFetch<Product>(`/products/${id}`);
}

export function createProduct(input: CreateProductInput): Promise<MutationResult<Product>> {
  return mutateJson<Product>("POST", "/products", input, `Add product "${input.name}"`);
}

export function updateProduct(
  id: string,
  input: UpdateProductInput,
): Promise<MutationResult<Product>> {
  return mutateJson<Product>("PATCH", `/products/${id}`, input, "Update product");
}

export function deleteProduct(id: string): Promise<MutationResult<void>> {
  return mutateJson<void>("DELETE", `/products/${id}`, undefined, "Delete product");
}

export function deleteProductImage(
  productId: string,
  imageId: string,
): Promise<MutationResult<void>> {
  return mutateJson<void>(
    "DELETE",
    `/products/${productId}/images/${imageId}`,
    undefined,
    "Delete product photo",
  );
}

export type UploadProgressHandler = (percent: number) => void;

function xhrUploadOnce(
  productId: string,
  blob: Blob,
  filename: string,
  token: string,
  onProgress?: UploadProgressHandler,
): Promise<ProductImage> {
  return new Promise<ProductImage>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append("file", blob, filename);

    xhr.open("POST", `${API_BASE}/products/${productId}/images`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      let data: unknown;
      try {
        data = xhr.responseText ? (JSON.parse(xhr.responseText) as unknown) : undefined;
      } catch {
        data = undefined;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data as ProductImage);
        return;
      }
      const body = data as { message?: string | string[] } | undefined;
      const message = Array.isArray(body?.message)
        ? body.message.join(", ")
        : (body?.message ?? xhr.statusText);
      reject(new ApiError(xhr.status, message, data));
    };

    xhr.onerror = () => reject(new NetworkError("Image upload network error"));
    xhr.ontimeout = () => reject(new NetworkError("Image upload timed out"));

    xhr.send(form);
  });
}

/** Single upload attempt (XHR, so upload progress is observable), with one 401-refresh-and-retry — the same policy `authFetch` applies to JSON requests. Used both by the public retry+queue wrapper below and by the offline-queue replay logic. */
export async function uploadProductImageOnce(
  productId: string,
  blob: Blob,
  filename: string,
  onProgress?: UploadProgressHandler,
  _retried = false,
): Promise<ProductImage> {
  const token = await getAccessTokenForRequest();
  try {
    return await xhrUploadOnce(productId, blob, filename, token, onProgress);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401 && !_retried) {
      await refreshTokens();
      return uploadProductImageOnce(productId, blob, filename, onProgress, true);
    }
    throw err;
  }
}

const UPLOAD_RETRY_DELAYS_MS = [1000, 2000];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Public entry point used by the camera/gallery UI: attempts the upload,
 * retrying a couple of times with backoff on flaky-connection failures,
 * and finally falling back to the IndexedDB offline queue (Blob included)
 * if every attempt fails with a network error. A genuine server rejection
 * (422 infected file, 400 wrong type/too large) is NOT retried or queued —
 * it's surfaced immediately since retrying won't change the outcome.
 */
export async function uploadProductImage(
  productId: string,
  blob: Blob,
  filename: string,
  onProgress?: UploadProgressHandler,
): Promise<MutationResult<ProductImage>> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    await enqueueItem({
      kind: "image",
      productId,
      blob,
      filename,
      description: "Upload product photo",
    });
    return { status: "queued" };
  }

  for (let attempt = 0; attempt <= UPLOAD_RETRY_DELAYS_MS.length; attempt++) {
    try {
      const image = await uploadProductImageOnce(productId, blob, filename, onProgress);
      return { status: "ok", data: image };
    } catch (err) {
      if (!isNetworkError(err)) throw err;
      if (attempt < UPLOAD_RETRY_DELAYS_MS.length) {
        await delay(UPLOAD_RETRY_DELAYS_MS[attempt]);
      }
    }
  }

  await enqueueItem({
    kind: "image",
    productId,
    blob,
    filename,
    description: "Upload product photo",
  });
  return { status: "queued" };
}
