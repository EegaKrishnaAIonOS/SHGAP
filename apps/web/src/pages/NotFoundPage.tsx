import { Link } from "react-router-dom";

/** Catch-all route (T25) — previously the app just redirected unknown paths
 * to "/"; a real 404 page is clearer for a public marketing site. */
export function NotFoundPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <span className="text-5xl" aria-hidden="true">
        🔍
      </span>
      <h1 className="text-2xl font-semibold text-neutral-900">Page not found</h1>
      <p className="max-w-md text-neutral-600">
        The page you&apos;re looking for doesn&apos;t exist or may have moved.
      </p>
      <Link
        to="/"
        className="inline-flex h-11 items-center justify-center rounded-md bg-marketing-600 px-5 font-medium text-white hover:bg-marketing-700"
      >
        Go to homepage
      </Link>
    </div>
  );
}
