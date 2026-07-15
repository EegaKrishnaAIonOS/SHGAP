import { useTranslation } from "react-i18next";
import { PageHeader } from "../../components/PageHeader";
import { DashboardFilters } from "../../components/DashboardFilters";
import { StatCard } from "../../components/ui/Card";
import { DataTable, type Column } from "../../components/ui/Table";
import { SimpleLineChart } from "../../components/ui/ChartWrapper";
import { shgs, products, monthlySalesTrend } from "./mockData";

/** Single SHG being monitored in this wireframe. */
const shg = shgs[2];
const shgProducts = products.filter((p) => p.shg === shg.name);

export function ShgDashboardPage() {
  const { t } = useTranslation();

  const columns: Column<(typeof shgProducts)[number]>[] = [
    { key: "name", header: t("dashboard.name"), render: (row) => row.name },
    { key: "category", header: t("catalogue.title"), render: (row) => row.category },
    { key: "price", header: t("catalogue.price"), render: (row) => `₹${row.price}` },
    { key: "unitsSold", header: t("dashboard.sales"), render: (row) => row.unitsSold },
  ];

  return (
    <div>
      <PageHeader
        title={`${t("shgDashboard.title")} — ${shg.name}`}
        subtitle={t("shgDashboard.subtitle")}
      />
      <DashboardFilters />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t("dashboard.totalSales")} value={`₹${shg.sales.toLocaleString()}`} />
        <StatCard label={t("dashboard.members")} value={shg.members} />
        <StatCard label={t("dashboard.productsListed")} value={shg.products} />
        <StatCard label={t("common.status")} value={shg.status} />
      </div>

      <div className="mb-5">
        <SimpleLineChart
          title={t("dashboard.salesTrend")}
          data={monthlySalesTrend}
          xKey="month"
          series={[{ key: "sales", label: t("dashboard.sales") }]}
        />
      </div>

      <DataTable
        columns={columns}
        rows={shgProducts}
        rowKey={(row) => row.id}
        caption={t("dashboard.topProducts")}
      />
    </div>
  );
}
