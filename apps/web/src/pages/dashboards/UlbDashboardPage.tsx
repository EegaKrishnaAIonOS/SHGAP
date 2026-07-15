import { useTranslation } from "react-i18next";
import { PageHeader } from "../../components/PageHeader";
import { DashboardFilters } from "../../components/DashboardFilters";
import { StatCard } from "../../components/ui/Card";
import { DataTable, type Column } from "../../components/ui/Table";
import { SimpleBarChart } from "../../components/ui/ChartWrapper";
import { ulbs, shgs, monthlySalesTrend } from "./mockData";

/** ULB officer's own ULB for this wireframe. */
const ulb = ulbs[0];
const ulbShgs = shgs.filter((s) => s.ulb === ulb.name);

export function UlbDashboardPage() {
  const { t } = useTranslation();

  const columns: Column<(typeof ulbShgs)[number]>[] = [
    { key: "name", header: t("dashboard.name"), render: (row) => row.name },
    { key: "members", header: t("dashboard.members"), render: (row) => row.members },
    {
      key: "sales",
      header: t("dashboard.sales"),
      render: (row) => `₹${row.sales.toLocaleString()}`,
    },
    {
      key: "status",
      header: t("common.status"),
      render: (row) => (
        <span
          className={
            row.status === "active"
              ? "rounded-full bg-success-50 px-2 py-0.5 text-xs font-medium text-success-700"
              : "rounded-full bg-warning-50 px-2 py-0.5 text-xs font-medium text-warning-700"
          }
        >
          {row.status}
        </span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={`${t("ulbDashboard.title")} — ${ulb.name}`}
        subtitle={t("ulbDashboard.subtitle")}
      />
      <DashboardFilters />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label={t("dashboard.totalSales")}
          value={`₹${(ulb.sales / 100000).toFixed(1)}L`}
        />
        <StatCard label={t("dashboard.activeShgs")} value={ulb.shgs} />
        <StatCard label={t("dashboard.activeMembers")} value={ulb.members.toLocaleString()} />
        <StatCard label={t("dashboard.totalOrders")} value="1,240" />
      </div>

      <div className="mb-5">
        <SimpleBarChart
          title={t("dashboard.salesTrend")}
          data={monthlySalesTrend}
          xKey="month"
          series={[{ key: "orders", label: t("dashboard.orders") }]}
        />
      </div>

      <DataTable
        columns={columns}
        rows={ulbShgs}
        rowKey={(row) => row.id}
        caption={t("dashboard.shgBreakdown")}
      />
    </div>
  );
}
