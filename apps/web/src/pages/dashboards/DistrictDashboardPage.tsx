import { useTranslation } from "react-i18next";
import { PageHeader } from "../../components/PageHeader";
import { DashboardFilters } from "../../components/DashboardFilters";
import { StatCard } from "../../components/ui/Card";
import { DataTable, type Column } from "../../components/ui/Table";
import { SimpleLineChart, SimplePieChart } from "../../components/ui/ChartWrapper";
import { districts, monthlySalesTrend, categoryBreakdown, ulbs } from "./mockData";

/** District officer's own district for this wireframe (Guntur). */
const district = districts[0];
const districtUlbs = ulbs.filter((u) => u.district === district.name);

export function DistrictDashboardPage() {
  const { t } = useTranslation();

  const columns: Column<(typeof districtUlbs)[number]>[] = [
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
  ];

  return (
    <div>
      <PageHeader
        title={`${t("districtDashboard.title")} — ${district.name}`}
        subtitle={t("districtDashboard.subtitle")}
      />
      <DashboardFilters
        extra={[
          {
            label: t("dashboard.ulbBreakdown"),
            options: districtUlbs.map((u) => ({ value: u.id, label: u.name })),
          },
        ]}
      />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label={t("dashboard.totalSales")}
          value={`₹${(district.sales / 100000).toFixed(1)}L`}
          delta={district.growth}
          deltaTone="positive"
        />
        <StatCard label={t("dashboard.activeShgs")} value={district.shgs} />
        <StatCard label={t("dashboard.activeMembers")} value={district.members.toLocaleString()} />
        <StatCard label={t("nav.ulbDashboard")} value={district.ulbs} />
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <SimpleLineChart
          title={t("dashboard.salesTrend")}
          data={monthlySalesTrend}
          xKey="month"
          series={[{ key: "sales", label: t("dashboard.sales") }]}
        />
        <SimplePieChart
          title={t("dashboard.topCategories")}
          data={categoryBreakdown}
          nameKey="category"
          valueKey="value"
        />
      </div>

      <DataTable
        columns={columns}
        rows={districtUlbs}
        rowKey={(row) => row.id}
        caption={t("dashboard.ulbBreakdown")}
      />
    </div>
  );
}
