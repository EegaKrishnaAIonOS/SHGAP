/**
 * Reactive view over the session interface/script.js writes on a successful
 * login through the "guidance-api" credential flow (see inference/route.py)
 * — a separate, simpler flow from tokenStore.ts's OTP/password session,
 * which requires real access/refresh tokens this flow never has. Read-only
 * from React's side by design: interface/*.html writes this key directly
 * (same convention as tokenStore.ts's own iframe-write comment), never via
 * a setter here.
 */

export interface GuidanceSessionInfo {
  avatar?: string;
  /** The AIONOS account (see inference/tools/database.py's
   * func__init_credential) has no `role` at all — only `organisation` — so
   * this is optional and callers fall back to `organisation` for it. */
  role?: string;
  mode?: string;
  name?: string;
  contact?: string;
  address?: string;
  pincode?: string;
  nationality?: string;
  /** District authority accounts have no `name` (see
   * inference/tools/database.py's func__init_credential) — this is the only
   * identifying field they carry, used to synthesize a display name. */
  district_name?: string;
  /** Set instead of `role` on the AIONOS account (see above). */
  organisation?: string;
}

export interface GuidanceSession {
  email: string;
  passkey: string;
  info: GuidanceSessionInfo;
}

const STORAGE_KEY = "shgap.guidanceSession.v1";

function parseStored(raw: string | null): GuidanceSession | null {
  try {
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GuidanceSession;
    if (!parsed?.email || !parsed?.info) return null;
    return parsed;
  } catch {
    return null;
  }
}

function loadFromStorage(): GuidanceSession | null {
  return parseStored(localStorage.getItem(STORAGE_KEY));
}

let current: GuidanceSession | null = typeof window !== "undefined" ? loadFromStorage() : null;
type Listener = () => void;
const listeners = new Set<Listener>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== null && event.key !== STORAGE_KEY) return;
    current = loadFromStorage();
    notify();
  });
}

export function getGuidanceSession(): GuidanceSession | null {
  return current;
}

export function clearGuidanceSession(): void {
  current = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  notify();
}

export function subscribeGuidanceSession(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
