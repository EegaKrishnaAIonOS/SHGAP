import { useEffect, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { getCachedQueueCount, subscribeQueue } from "../lib/offlineQueue/db";
import { replayQueue } from "../lib/offlineQueue/sync";

/**
 * Surfaces offline-queue status on every SHG-facing screen: how many
 * changes (SHG/product create-or-update, image uploads) are waiting to
 * sync, whether the browser currently thinks it's offline, and a manual
 * "sync now" action for when the automatic `online` event listener isn't
 * enough (e.g. flaky Wi-Fi that never cleanly fires the event).
 */
export function SyncStatusBanner() {
  const { t } = useTranslation();
  const pending = useSyncExternalStore(subscribeQueue, getCachedQueueCount);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (pending === 0 && isOnline) return null;

  return (
    <div
      role="status"
      className="mb-4 flex items-center justify-between gap-3 rounded-md border border-warning-500 bg-warning-50 px-3 py-2 text-sm text-warning-700"
    >
      <span>
        {!isOnline && pending > 0
          ? t("sync.offlineWithPending", { count: pending })
          : !isOnline
            ? t("sync.offline")
            : t("sync.pending", { count: pending })}
      </span>
      {pending > 0 && isOnline && (
        <button
          type="button"
          disabled={syncing}
          onClick={() => {
            setSyncing(true);
            void replayQueue().finally(() => setSyncing(false));
          }}
          className="shrink-0 font-medium underline underline-offset-2 disabled:opacity-60"
        >
          {syncing ? t("common.loading") : t("sync.syncNow")}
        </button>
      )}
    </div>
  );
}
