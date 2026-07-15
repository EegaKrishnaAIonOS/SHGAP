import { useTranslation } from "react-i18next";
import { PageHeader } from "../../components/PageHeader";
import { DashboardFilters } from "../../components/DashboardFilters";
import { StatCard } from "../../components/ui/Card";
import { DataTable, type Column } from "../../components/ui/Table";
import { SimpleBarChart, SimplePieChart } from "../../components/ui/ChartWrapper";
import { products, categoryBreakdown } from "./mockData";

export function ProductDashboardPage() {
  const { t } = useTranslation();

  const topProducts = [...products].sort((a, b) => b.unitsSold - a.unitsSold);
  const totalUnits = products.reduce((sum, p) => sum + p.unitsSold, 0);

  const columns: Column<(typeof products)[number]>[] = [
    { key: "name", header: t("dashboard.name"), render: (row) => row.name },
    { key: "category", header: t("catalogue.title"), render: (row) => row.category },
    { key: "shg", header: "SHG", render: (row) => row.shg },
    { key: "price", header: t("catalogue.price"), render: (row) => `₹${row.price}` },
    {
      key: "unitsSold",
      header: t("dashboard.sales"),
      render: (row) => row.unitsSold.toLocaleString(),
    },
  ];

  return (
    <div>
      <PageHeader title={t("productDashboard.title")} subtitle={t("productDashboard.subtitle")} />
      <DashboardFilters />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t("dashboard.productsListed")} value={products.length} />
        <StatCard label={t("dashboard.sales")} value={totalUnits.toLocaleString()} />
        <StatCard label={t("dashboard.topCategories")} value={categoryBreakdown.length} />
        <StatCard
          label={t("catalogue.price")}
          value={`₹${Math.round(products.reduce((s, p) => s + p.price, 0) / products.length)}`}
        />
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <SimpleBarChart
          title={t("dashboard.topProducts")}
          data={topProducts.map((p) => ({ name: p.name.split(" (")[0], unitsSold: p.unitsSold }))}
          xKey="name"
          series={[{ key: "unitsSold", label: t("dashboard.sales") }]}
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
        rows={topProducts}
        rowKey={(row) => row.id}
        caption={t("dashboard.topProducts")}
      />
    </div>
  );
}
