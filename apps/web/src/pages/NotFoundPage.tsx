import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

/** Catch-all route (T25) — previously the app just redirected unknown paths
 * to "/"; a real 404 page is clearer for a public marketing site. */
export function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <span className="text-5xl" aria-hidden="true">
        🔍
      </span>
      <h1 className="text-2xl font-semibold text-neutral-900">{t("notFound.title")}</h1>
      <p className="max-w-md text-neutral-600">{t("notFound.body")}</p>
      <Link
        to="/"
        className="inline-flex h-11 items-center justify-center rounded-md bg-marketing-600 px-5 font-medium text-white hover:bg-marketing-700"
      >
        {t("notFound.goHome")}
      </Link>
    </div>
  );
}
