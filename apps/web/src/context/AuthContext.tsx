import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import * as authApi from "../lib/api/auth";
import { clearAuth, getAuth, setAuth, subscribeAuth } from "../lib/auth/tokenStore";

interface AuthContextValue {
  /** True once we have a persisted/in-memory token pair. Doesn't guarantee the access token hasn't expired yet — `authFetch` handles that transparently via refresh-on-401. */
  isAuthenticated: boolean;
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

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: Boolean(auth?.accessToken),
      requestOtp,
      verifyOtp,
      logout,
    }),
    [auth, requestOtp, verifyOtp, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
