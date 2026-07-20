import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import * as authApi from "../lib/api/auth";
import { clearAuth, getAuth, setAuth, subscribeAuth } from "../lib/auth/tokenStore";
import type { UserProfile } from "../lib/api/types";

interface AuthContextValue {
  /** True once we have a persisted/in-memory token pair. Doesn't guarantee the access token hasn't expired yet — `authFetch` handles that transparently via refresh-on-401. */
  isAuthenticated: boolean;
  /** The caller's own profile (including role assignments), fetched once per session. Null until it's loaded. */
  profile: UserProfile | null;
  /** True while the initial profile fetch (for role-gating) is in flight — avoids a flash of "forbidden" before roles are known. */
  profileLoading: boolean;
  /** Whether the caller holds any of the given roles (e.g. `hasRole('ADMIN', 'STATE_OFFICIAL')`). */
  hasRole: (...roles: string[]) => boolean;
  requestOtp: (phone: string) => Promise<void>;
  verifyOtp: (phone: string, otp: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Reactive view over the plain (non-React) token store in src/lib/auth/tokenStore.ts,
  // so the whole app re-renders (e.g. ProtectedRoute redirecting to /login)
  // the moment tokens are set/cleared — including when a background 401
  // refresh fails inside authFetch, not just on explicit login/logout calls.
  const auth = useSyncExternalStore(subscribeAuth, getAuth);
  const isAuthenticated = Boolean(auth?.accessToken);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Re-fetches whenever auth flips from signed-out to signed-in (login,
  // token refresh after a reload) — role-gated routes (e.g. /admin) need
  // this before they can decide access, not just isAuthenticated.
  useEffect(() => {
    if (!isAuthenticated) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    setProfileLoading(true);
    authApi
      .getMe()
      .then((me) => {
        if (!cancelled) setProfile(me);
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const requestOtp = useCallback(async (phone: string) => {
    await authApi.requestOtp(phone);
  }, []);

  const verifyOtp = useCallback(async (phone: string, otp: string) => {
    const tokens = await authApi.verifyOtp(phone, otp);
    setAuth(tokens);
  }, []);

  const logout = useCallback(async () => {
    const current = getAuth();
    clearAuth();
    if (current?.refreshToken) {
      try {
        await authApi.logout(current.refreshToken);
      } catch {
        // Best-effort revoke — the session is already cleared client-side either way.
      }
    }
  }, []);

  const hasRole = useCallback(
    (...roles: string[]) => (profile?.userRoles ?? []).some((ur) => roles.includes(ur.role.name)),
    [profile],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated,
      profile,
      profileLoading,
      hasRole,
      requestOtp,
      verifyOtp,
      logout,
    }),
    [isAuthenticated, profile, profileLoading, hasRole, requestOtp, verifyOtp, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
