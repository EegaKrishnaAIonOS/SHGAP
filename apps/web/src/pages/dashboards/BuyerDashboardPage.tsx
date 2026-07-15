import { useTranslation } from "react-i18next";
import { PageHeader } from "../../components/PageHeader";
import { DashboardFilters } from "../../components/DashboardFilters";
import { StatCard } from "../../components/ui/Card";
import { DataTable, type Column } from "../../components/ui/Table";
import { SimpleBarChart } from "../../components/ui/ChartWrapper";
import { buyers } from "./mockData";

export function BuyerDashboardPage() {
  const { t } = useTranslation();

  const totalOrders = buyers.reduce((sum, b) => sum + b.orders, 0);
  const totalSpend = buyers.reduce((sum, b) => sum + b.totalSpend, 0);
  const ordersByType = Object.values(
    buyers.reduce<Record<string, { type: string; orders: number }>>((acc, b) => {
      acc[b.type] ??= { type: b.type, orders: 0 };
      acc[b.type].orders += b.orders;
      return acc;
    }, {}),
  );

  const columns: Column<(typeof buyers)[number]>[] = [
    { key: "name", header: t("dashboard.name"), render: (row) => row.name },
    { key: "type", header: t("catalogue.title"), render: (row) => row.type },
    { key: "orders", header: t("dashboard.orders"), render: (row) => row.orders },
    {
      key: "totalSpend",
      header: t("dashboard.totalSales"),
      render: (row) => `₹${row.totalSpend.toLocaleString()}`,
    },
  ];

  return (
    <div>
      <PageHeader title={t("buyerDashboard.title")} subtitle={t("buyerDashboard.subtitle")} />
      <DashboardFilters />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t("dashboard.registeredBuyers")} value={buyers.length} />
        <StatCard label={t("dashboard.totalOrders")} value={totalOrders.toLocaleString()} />
        <StatCard
          label={t("dashboard.totalSales")}
          value={`₹${(totalSpend / 100000).toFixed(1)}L`}
        />
        <StatCard label={t("dashboard.growth")} value="+6.4%" deltaTone="positive" />
      </div>

      <div className="mb-5">
        <SimpleBarChart
          title={t("dashboard.orders")}
          data={ordersByType}
          xKey="type"
          series={[{ key: "orders", label: t("dashboard.orders") }]}
        />
      </div>

      <DataTable
        columns={columns}
        rows={buyers}
        rowKey={(row) => row.id}
        caption={t("dashboard.recentOrders")}
      />
    </div>
  );
}
