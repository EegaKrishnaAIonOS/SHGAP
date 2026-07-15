import { useTranslation } from "react-i18next";
import { PageHeader } from "../../components/PageHeader";
import { DashboardFilters } from "../../components/DashboardFilters";
import { StatCard, Card, CardTitle } from "../../components/ui/Card";
import { DataTable, type Column } from "../../components/ui/Table";
import { SimpleBarChart } from "../../components/ui/ChartWrapper";
import { districts, districtComparison } from "./mockData";

/**
 * Module-7 government dashboard: state (MEPMA HQ) level roll-up across all
 * districts. The district heat-map is a placeholder box — a real mapping
 * library (e.g. Leaflet/Mapbox with AP district GeoJSON) is out of scope
 * for this wireframe sprint.
 */
export function GovernmentDashboardPage() {
  const { t } = useTranslation();

  const totalSales = districts.reduce((sum, d) => sum + d.sales, 0);
  const totalShgs = districts.reduce((sum, d) => sum + d.shgs, 0);
  const totalMembers = districts.reduce((sum, d) => sum + d.members, 0);

  const columns: Column<(typeof districts)[number]>[] = [
    { key: "name", header: t("dashboard.name"), render: (row) => row.name },
    { key: "shgs", header: t("dashboard.activeShgs"), render: (row) => row.shgs },
    {
      key: "members",
      header: t("dashboard.members"),
      render: (row) => row.members.toLocaleString(),
    },
    {
      key: "sales",
      header: t("dashboard.sales"),
      render: (row) => `₹${row.sales.toLocaleString()}`,
    },
    { key: "growth", header: t("dashboard.growth"), render: (row) => row.growth },
  ];

  return (
    <div>
      <PageHeader
        title={t("governmentDashboard.title")}
        subtitle={t("governmentDashboard.subtitle")}
      />
      <DashboardFilters
        extra={[
          {
            label: t("dashboard.district"),
            options: districts.map((d) => ({ value: d.id, label: d.name })),
          },
        ]}
      />

      <h2 className="mb-3 text-lg font-semibold text-neutral-900">
        {t("governmentDashboard.stateOverview")}
      </h2>
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label={t("dashboard.totalSales")}
          value={`₹${(totalSales / 10000000).toFixed(2)} Cr`}
        />
        <StatCard label={t("dashboard.activeShgs")} value={totalShgs.toLocaleString()} />
        <StatCard label={t("dashboard.activeMembers")} value={totalMembers.toLocaleString()} />
        <StatCard label={t("districtDashboard.title")} value={districts.length} />
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <SimpleBarChart
          title={t("governmentDashboard.districtComparison")}
          data={districtComparison}
          xKey="district"
          series={[{ key: "sales", label: t("dashboard.sales") }]}
        />
        <Card>
          <CardTitle className="mb-3">{t("governmentDashboard.districtComparison")}</CardTitle>
          <div
            className="flex h-[280px] items-center justify-center rounded-md border border-dashed border-neutral-300 bg-neutral-50 text-center text-sm text-neutral-400"
            role="img"
            aria-label={t("governmentDashboard.mapPlaceholder")}
          >
            🗺️
            <span className="sr-only">{t("governmentDashboard.mapPlaceholder")}</span>
          </div>
          <p className="mt-2 text-xs text-neutral-400">{t("governmentDashboard.mapPlaceholder")}</p>
        </Card>
      </div>

      <DataTable
        columns={columns}
        rows={districts}
        rowKey={(row) => row.id}
        caption={t("dashboard.districtBreakdown")}
      />
    </div>
  );
}
