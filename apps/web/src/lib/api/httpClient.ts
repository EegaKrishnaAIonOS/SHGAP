import { clearAuth, getAuth, setAuth } from "../auth/tokenStore";
import type { TokenPair } from "../auth/tokenStore";

// Same-origin `/api` — proxied to core-api by Vite in both dev and preview
// (see vite.config.ts). Overridable via VITE_API_BASE_URL for a real
// deployment where core-api sits behind a different reverse-proxy path.
export const API_BASE: string = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api";

/** Mirrors the core-api global error shape: `{ statusCode, path, timestamp, message }`. */
export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

/** Thrown when `fetch` itself fails (offline, DNS, connection refused, CORS) rather than the server responding with an error status. */
export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NetworkError";
  }
}

export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError;
}

async function rawFetch(path: string, init: RequestInit): Promise<Response> {
  // Fail fast instead of waiting out a TCP timeout when the browser already
  // knows it's offline — this is what lets mutating calls fall through to
  // the offline queue quickly instead of hanging.
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new NetworkError("Browser is offline");
  }
  try {
    return await fetch(`${API_BASE}${path}`, init);
  } catch (err) {
    throw new NetworkError(err instanceof Error ? err.message : "Network request failed");
  }
}

async function parseResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : undefined;
  if (!res.ok) {
    const body = data as { message?: string | string[] } | undefined;
    const message = Array.isArray(body?.message)
      ? body.message.join(", ")
      : (body?.message ?? res.statusText);
    throw new ApiError(res.status, message, data);
  }
  return data as T;
}

export interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

function toRequestInit(options: RequestOptions): RequestInit {
  const { body, headers, ...rest } = options;
  return {
    ...rest,
    headers: { "Content-Type": "application/json", ...(headers ?? {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  };
}

/** For the two public auth endpoints (request-otp, verify-otp) and refresh/logout — no Authorization header. */
export async function publicFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const res = await rawFetch(path, toRequestInit(options));
  return parseResponse<T>(res);
}

let refreshPromise: Promise<TokenPair> | null = null;

async function performRefresh(): Promise<TokenPair> {
  const auth = getAuth();
  if (!auth?.refreshToken) {
    throw new ApiError(401, "Not authenticated", undefined);
  }
  const tokens = await publicFetch<TokenPair>("/auth/refresh", {
    method: "POST",
    body: { refreshToken: auth.refreshToken },
  });
  // Refresh tokens are single-use/rotating server-side — always persist the
  // full new pair returned here, never just the access token.
  setAuth(tokens);
  return tokens;
}

/** De-duplicates concurrent refresh attempts so parallel 401s only hit `/auth/refresh` once. */
function refreshTokens(): Promise<TokenPair> {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/** Authenticated JSON request. On a 401, refreshes once and retries; on refresh failure, clears the session so ProtectedRoute redirects to /login. */
export async function authFetch<T>(
  path: string,
  options: RequestOptions = {},
  _retried = false,
): Promise<T> {
  const auth = getAuth();
  if (!auth?.accessToken) {
    clearAuth();
    throw new ApiError(401, "Not authenticated", undefined);
  }

  const init = toRequestInit(options);
  const res = await rawFetch(path, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${auth.accessToken}` },
  });

  if (res.status === 401 && !_retried) {
    try {
      await refreshTokens();
    } catch {
      clearAuth();
      throw new ApiError(401, "Session expired", undefined);
    }
    return authFetch<T>(path, options, true);
  }

  return parseResponse<T>(res);
}

/** Current bearer token, for callers (e.g. the XHR-based image upload) that can't go through `authFetch`. Refreshes once if the token is missing/expired-looking, same as `authFetch`. */
export async function getAccessTokenForRequest(): Promise<string> {
  const auth = getAuth();
  if (!auth?.accessToken) {
    throw new ApiError(401, "Not authenticated", undefined);
  }
  return auth.accessToken;
}

export { refreshTokens };
