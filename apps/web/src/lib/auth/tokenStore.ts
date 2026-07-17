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

function loadFromStorage(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAuth;
    if (!parsed?.accessToken || !parsed?.refreshToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

let current: StoredAuth | null = loadFromStorage();
type Listener = () => void;
const listeners = new Set<Listener>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function getAuth(): StoredAuth | null {
  return current;
}

export function setAuth(tokens: TokenPair): void {
  current = { ...tokens, obtainedAt: Date.now() };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // localStorage unavailable (private browsing, quota) — keep in-memory only.
  }
  notify();
}

export function clearAuth(): void {
  current = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  notify();
}

export function subscribeAuth(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
