import { useEffect, useState } from "react";
import { PageHeader } from "../../components/PageHeader";
import { StatCard } from "../../components/ui/Card";
import { getAdminSummary } from "../../lib/api/admin";
import type { AdminSummary } from "../../lib/api/types";

export function AdminOverviewPage() {
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAdminSummary()
      .then((result) => {
        if (!cancelled) setSummary(result);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load the summary. Please try again.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <PageHeader
        title="Admin overview"
        subtitle="SHG, product and user counts for your area."
        wireframe={false}
      />

      {error && <p className="text-sm text-danger-500">{error}</p>}

      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="Total SHGs" value={summary.totalShgs} />
          <StatCard label="Active SHGs" value={summary.activeShgs} />
          <StatCard label="Total products" value={summary.totalProducts} />
          <StatCard label="Available products" value={summary.availableProducts} />
          <StatCard label="Total users" value={summary.totalUsers} />
        </div>
      )}
    </div>
  );
}
