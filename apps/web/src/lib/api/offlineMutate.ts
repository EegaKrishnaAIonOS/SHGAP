import { enqueueItem } from "../offlineQueue/db";
import { authFetch, isNetworkError } from "./httpClient";
import type { MutationResult } from "./types";

/**
 * Shared wrapper for every JSON-body mutation (SHG/product create, update,
 * delete): try the real request first; if it fails purely because the
 * network is unreachable (offline, connection refused — not a validation
 * or auth error from the server), persist it to the IndexedDB offline
 * queue instead of surfacing a hard failure. `src/lib/offlineQueue/sync.ts`
 * replays queued items, in order, once the browser is back online.
 */
export async function mutateJson<T>(
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  body: unknown,
  description: string,
): Promise<MutationResult<T>> {
  try {
    const data = await authFetch<T>(path, { method, body });
    return { status: "ok", data };
  } catch (err) {
    if (isNetworkError(err)) {
      await enqueueItem({ kind: "json", method, path, body, description });
      return { status: "queued" };
    }
    throw err;
  }
}
