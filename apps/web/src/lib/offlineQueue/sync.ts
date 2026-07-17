import { authFetch, isNetworkError } from "../api/httpClient";
import { uploadProductImageOnce } from "../api/products";
import { getQueueItems, removeQueueItem } from "./db";

let syncing = false;

/**
 * Replays the offline queue in FIFO order, one item at a time. Stops (and
 * leaves the remaining items queued) the moment an item fails again with a
 * network error — that just means we're still offline (or flaky), and the
 * `online` listener below or a manual retry will pick it up again later. A
 * non-network failure (e.g. the server now rejects the payload) also stops
 * the replay rather than silently dropping the item, since a POC has no
 * good place to surface "this queued change is permanently broken" yet —
 * it stays visible in the pending count until someone investigates.
 */
export async function replayQueue(): Promise<void> {
  if (syncing) return;
  syncing = true;
  try {
    for (;;) {
      const items = await getQueueItems();
      if (items.length === 0) break;
      const item = items[0];
      try {
        if (item.kind === "json") {
          await authFetch(item.path, {
            method: item.method,
            body: item.body,
          });
        } else {
          await uploadProductImageOnce(item.productId, item.blob, item.filename);
        }
        await removeQueueItem(item.id!);
      } catch (err) {
        if (isNetworkError(err)) {
          // Still offline / server unreachable — try again on the next
          // `online` event or manual "sync now" instead of busy-looping.
          break;
        }
        break;
      }
    }
  } finally {
    syncing = false;
  }
}

let initialised = false;

/** Wires up the `online` event (and an initial attempt if already online) to auto-replay the queue. Safe to call more than once — only attaches listeners the first time. */
export function initOfflineSync(): void {
  if (initialised) return;
  initialised = true;
  window.addEventListener("online", () => void replayQueue());
  if (navigator.onLine) void replayQueue();
}
