/**
 * Holds the current OTP-login token pair. This is a plain module (not a
 * React context) on purpose: the offline-queue replay logic (src/lib/
 * offlineQueue/sync.ts) and the low-level HTTP client both need to read/
 * write tokens outside of any component tree, and AuthContext.tsx wraps
 * this same store with React state via `useSyncExternalStore` so
 * components re-render when it changes.
 *
 * The access token is kept here in memory but also persisted (alongside
 * the refresh token) so a page reload doesn't force the member to log in
 * again. Refresh tokens rotate and are single-use server-side, so every
 * successful `/auth/refresh` call must replace the stored pair in full.
 */

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresInSeconds: number;
}

export interface StoredAuth extends TokenPair {
  /** Client-side timestamp (ms) the tokens were obtained, for reference/debugging only. */
  obtainedAt: number;
}

const STORAGE_KEY = "shgap.auth.v1";

function parseStored(raw: string | null): StoredAuth | null {
  try {
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAuth;
    if (!parsed?.accessToken || !parsed?.refreshToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

function loadFromStorage(): StoredAuth | null {
  // localStorage (persisted "remember me" / phone-OTP sessions) takes
  // precedence over sessionStorage (unchecked "remember me" — cleared when
  // the tab closes) in the unlikely case both are somehow populated.
  return (
    parseStored(localStorage.getItem(STORAGE_KEY)) ??
    parseStored(sessionStorage.getItem(STORAGE_KEY))
  );
}

let current: StoredAuth | null = loadFromStorage();
type Listener = () => void;
const listeners = new Set<Listener>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

// interface/*.html's own login flow (a separate vanilla-JS document running
// inside AppShell's iframe — see LandingPage.tsx) writes to this same
// storage key directly rather than calling setAuth() below, since it has no
// access to this module. The `storage` event is what lets this window pick
// that up: same-origin browsing contexts (a page and its same-origin iframe
// included) receive it on every OTHER context's write, never their own, so
// this only ever fires here in response to the iframe's login/logout.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== null && event.key !== STORAGE_KEY) return;
    current = loadFromStorage();
    notify();
  });
}

export function getAuth(): StoredAuth | null {
  return current;
}

/** `persist` controls where the token pair survives a page reload:
 * `"local"` (default — matches every existing call site, i.e. the phone-OTP
 * flow) keeps it until explicit logout; `"session"` (password login with
 * "remember me" unchecked) clears it as soon as the browser tab closes. */
export function setAuth(tokens: TokenPair, persist: "local" | "session" = "local"): void {
  current = { ...tokens, obtainedAt: Date.now() };
  const serialized = JSON.stringify(current);
  try {
    if (persist === "local") {
      localStorage.setItem(STORAGE_KEY, serialized);
      sessionStorage.removeItem(STORAGE_KEY);
    } else {
      sessionStorage.setItem(STORAGE_KEY, serialized);
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Storage unavailable (private browsing, quota) — keep in-memory only.
  }
  notify();
}

export function clearAuth(): void {
  current = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  notify();
}

export function subscribeAuth(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
