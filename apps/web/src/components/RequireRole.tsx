import { Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ForbiddenPage } from "../pages/ForbiddenPage";

interface RequireRoleProps {
  roles: string[];
}

/**
 * Gates a route subtree to callers holding at least one of `roles` — used
 * for the admin portal (T09), which SHG members must never reach even if
 * they guess the URL (the backend also enforces this on every endpoint;
 * this is the UX-side mirror of that, not the source of truth). Must sit
 * inside `<ProtectedRoute>` so `isAuthenticated` is already true here.
 */
export function RequireRole({ roles }: RequireRoleProps) {
  const { profileLoading, hasRole } = useAuth();

  // Still resolving the profile fetch that determines role access — a brief
  // blank render avoids a flash of "forbidden" before we actually know,
  // and resolves in a single network round trip.
  if (profileLoading) return null;

  if (!hasRole(...roles)) {
    return <ForbiddenPage />;
  }

  return <Outlet />;
}
