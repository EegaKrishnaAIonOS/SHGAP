import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { PageHeader } from "../../components/PageHeader";
import { StatCard } from "../../components/ui/Card";
import { getAdminSummary } from "../../lib/api/admin";
import type { AdminSummary } from "../../lib/api/types";

export function AdminOverviewPage() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAdminSummary()
      .then((result) => {
        if (!cancelled) setSummary(result);
      })
      .catch(() => {
        if (!cancelled) setError(t("admin.summaryLoadError"));
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  return (
    <div>
      <PageHeader
        title={t("admin.title")}
        subtitle={t("admin.overviewSubtitle")}
        wireframe={false}
      />

      {error && <p className="text-sm text-danger-500">{error}</p>}

      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label={t("admin.totalShgs")} value={summary.totalShgs} />
          <StatCard label={t("admin.activeShgs")} value={summary.activeShgs} />
          <StatCard label={t("admin.totalProducts")} value={summary.totalProducts} />
          <StatCard label={t("admin.availableProducts")} value={summary.availableProducts} />
          <StatCard label={t("admin.totalUsers")} value={summary.totalUsers} />
        </div>
      )}
    </div>
  );
}
