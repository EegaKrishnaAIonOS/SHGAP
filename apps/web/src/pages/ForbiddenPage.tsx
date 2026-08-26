/** Rendered by RequireRole (T25) when the caller is authenticated but lacks
 * the roles a route requires — previously an inline message inside
 * RequireRole itself; pulled out to a real page per the auth-system spec's
 * "unauthorized/forbidden page" requirement. */
export function ForbiddenPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <span className="text-5xl" aria-hidden="true">
        🚫
      </span>
      <p className="max-w-md text-neutral-600">You don&apos;t have access to this page.</p>
    </div>
  );
}
