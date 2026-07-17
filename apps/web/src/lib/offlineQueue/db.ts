import { openDB } from "idb";
import type { DBSchema, IDBPDatabase } from "idb";

/**
 * A queued JSON mutation (SHG/product create or update) — replayed via
 * `authFetch` with the same method/path/body once connectivity returns.
 */
export interface JsonQueueItem {
  id?: number;
  kind: "json";
  method: "POST" | "PATCH" | "PUT" | "DELETE";
  path: string;
  body?: unknown;
  description: string;
  createdAt: number;
}

/**
 * A queued product-image upload. The captured/picked Blob is stored
 * directly in IndexedDB (idb/IndexedDB support storing Blobs natively) so
 * the photo survives even if the tab is closed before connectivity returns.
 */
export interface ImageQueueItem {
  id?: number;
  kind: "image";
  productId: string;
  blob: Blob;
  filename: string;
  description: string;
  createdAt: number;
}

export type QueueItem = JsonQueueItem | ImageQueueItem;

// `Omit<QueueItem, ...>` would collapse the union down to its shared keys
// only (Omit isn't distributive over unions) — a distributed union of the
// per-variant Omits is what actually preserves "json needs method/path,
// image needs productId/blob/filename" as a discriminated union.
export type QueueItemInput =
  Omit<JsonQueueItem, "id" | "createdAt"> | Omit<ImageQueueItem, "id" | "createdAt">;

interface OfflineDBSchema extends DBSchema {
  queue: { key: number; value: QueueItem };
}

const DB_NAME = "shgap-offline";
const STORE_NAME = "queue";

let dbPromise: Promise<IDBPDatabase<OfflineDBSchema>> | null = null;

function getDb(): Promise<IDBPDatabase<OfflineDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<OfflineDBSchema>(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      },
    });
  }
  return dbPromise;
}

type Listener = () => void;
const listeners = new Set<Listener>();
/** Synchronous cache of the queue length so React can read it via `useSyncExternalStore` (which requires a sync snapshot) without every render round-tripping through IndexedDB. */
let cachedCount = 0;

function notify(): void {
  listeners.forEach((listener) => listener());
}

async function refreshCachedCount(): Promise<void> {
  const db = await getDb();
  cachedCount = await db.count(STORE_NAME);
  notify();
}

export function subscribeQueue(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCachedQueueCount(): number {
  return cachedCount;
}

// Prime the cache on module load.
void refreshCachedCount();

export async function enqueueItem(item: QueueItemInput): Promise<void> {
  const db = await getDb();
  await db.add(STORE_NAME, { ...item, createdAt: Date.now() } as QueueItem);
  await refreshCachedCount();
}

export async function getQueueItems(): Promise<QueueItem[]> {
  const db = await getDb();
  return db.getAll(STORE_NAME);
}

export async function removeQueueItem(id: number): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_NAME, id);
  await refreshCachedCount();
}
