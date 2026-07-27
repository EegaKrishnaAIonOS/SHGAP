import { useEffect, useState } from "react";

export interface AsyncDataState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * Generic version of the fetch/loading/error/cancelled-flag pattern every
 * data-connected page in this app repeats inline (see
 * `AdminProductsPage.tsx`) — pulled out once here since T19 needed the exact
 * same shape across 6 dashboard pages rather than a 7th copy-paste.
 *
 * `fetcher` re-runs whenever `deps` changes (like `useEffect`'s own dep
 * array) — pass the filter values the page's fetch depends on. A stale
 * response (from a superseded call, e.g. the user changed filters again
 * before the first request returned) is silently dropped via the same
 * `cancelled` flag convention used everywhere else in this codebase.
 */
export function useAsyncData<T>(
  fetcher: () => Promise<T>,
  deps: React.DependencyList,
  errorMessage = "Something went wrong loading this data.",
): AsyncDataState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetcher()
      .then((result) => {
        if (cancelled) return;
        setData(result);
      })
      .catch(() => {
        if (!cancelled) setError(errorMessage);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error };
}
