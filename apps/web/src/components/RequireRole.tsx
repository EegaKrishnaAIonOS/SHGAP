import { Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";

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
  const { t } = useTranslation();

  // Still resolving the profile fetch that determines role access — a brief
  // blank render avoids a flash of "forbidden" before we actually know,
  // and resolves in a single network round trip.
  if (profileLoading) return null;

  if (!hasRole(...roles)) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6 text-center">
        <p className="text-neutral-500">{t("common.forbidden")}</p>
      </div>
    );
  }

  return <Outlet />;
}
