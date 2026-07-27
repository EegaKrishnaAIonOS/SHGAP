import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PageHeader } from "../../components/PageHeader";
import {
  DashboardFilters,
  dateRangeToDateFrom,
  type DateRangeValue,
} from "../../components/DashboardFilters";
import { StatCard } from "../../components/ui/Card";
import { DataTable, type Column } from "../../components/ui/Table";
import { Pagination } from "../../components/ui/Pagination";
import { SimpleBarChart, SimplePieChart } from "../../components/ui/ChartWrapper";
import { ExportButtons } from "../../components/ui/ExportButtons";
import { useAsyncData } from "../../lib/useAsyncData";
import { getCategorySales, getDistrictSales, getProducts } from "../../lib/api/analytics";
import type { ProductRollup } from "../../lib/api/types";

const PAGE_SIZE = 20;

export function ProductDashboardPage() {
  const { t } = useTranslation();
  const [dateRange, setDateRange] = useState<DateRangeValue>("30d");
  const [districtId, setDistrictId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [page, setPage] = useState(1);
  const dateFrom = useMemo(() => dateRangeToDateFrom(dateRange), [dateRange]);

  useEffect(() => {
    setPage(1);
  }, [dateRange, districtId, categoryId]);

  const { data: districts } = useAsyncData(() => getDistrictSales({ dateFrom }), [dateFrom]);
  const { data: categories } = useAsyncData(
    () => getCategorySales({ dateFrom, districtId: districtId || undefined }),
    [dateFrom, districtId],
  );

  const {
    data: products,
    loading,
    error,
  } = useAsyncData(
    () =>
      getProducts({
        dateFrom,
        districtId: districtId || undefined,
        categoryId: categoryId || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    [dateFrom, districtId, categoryId, page],
    t("productDashboard.loadError"),
  );

  const items = products?.items ?? [];
  const totalUnits = items.reduce((sum, p) => sum + p.unitsSold, 0);
  const avgPrice = items.length
    ? Math.round(items.reduce((sum, p) => sum + p.price, 0) / items.length)
    : 0;

  const columns: Column<ProductRollup>[] = [
    { key: "name", header: t("dashboard.name"), render: (row) => row.name },
    { key: "category", header: t("catalogue.title"), render: (row) => row.categoryName },
    { key: "shg", header: "SHG", render: (row) => row.shgName },
    { key: "price", header: t("catalogue.price"), render: (row) => `₹${row.price}` },
    {
      key: "unitsSold",
      header: t("dashboard.sales"),
      render: (row) => row.unitsSold.toLocaleString(),
    },
    {
      key: "revenue",
      header: t("dashboard.totalSales"),
      render: (row) => `₹${row.totalRevenue.toLocaleString()}`,
    },
  ];

  return (
    <div>
      <PageHeader
        title={t("productDashboard.title")}
        subtitle={t("productDashboard.subtitle")}
        wireframe={false}
      />
      <DashboardFilters
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        extra={[
          {
            key: "district",
            label: t("dashboard.district"),
            value: districtId,
            onChange: setDistrictId,
            options: [
              { value: "", label: t("dashboard.allDistricts") },
              ...(districts ?? []).map((d) => ({ value: d.districtId, label: d.districtName })),
            ],
          },
          {
            key: "category",
            label: t("catalogue.title"),
            value: categoryId,
            onChange: setCategoryId,
            options: [
              { value: "", label: t("dashboard.allCategories") },
              ...(categories ?? []).map((c) => ({ value: c.categoryId, label: c.categoryName })),
            ],
          },
        ]}
      />

      {error && <p className="mb-3 text-sm text-danger-500">{error}</p>}

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t("dashboard.productsListed")} value={products?.total ?? 0} />
        <StatCard label={t("dashboard.sales")} value={totalUnits.toLocaleString()} />
        <StatCard label={t("dashboard.topCategories")} value={(categories ?? []).length} />
        <StatCard label={t("catalogue.price")} value={`₹${avgPrice}`} />
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <SimpleBarChart
          title={t("dashboard.topProducts")}
          data={[...items]
            .sort((a, b) => b.unitsSold - a.unitsSold)
            .slice(0, 10)
            .map((p) => ({ name: p.name, unitsSold: p.unitsSold }))}
          xKey="name"
          series={[{ key: "unitsSold", label: t("dashboard.sales") }]}
        />
        <SimplePieChart
          title={t("dashboard.topCategories")}
          data={(categories ?? []).map((c) => ({ category: c.categoryName, value: c.totalAmount }))}
          nameKey="category"
          valueKey="value"
        />
      </div>

      <ExportButtons
        title={t("productDashboard.title")}
        columns={[
          { header: t("dashboard.name"), value: (r: ProductRollup) => r.name },
          { header: t("catalogue.title"), value: (r: ProductRollup) => r.categoryName },
          { header: "SHG", value: (r: ProductRollup) => r.shgName },
          { header: t("catalogue.price"), value: (r: ProductRollup) => r.price },
          { header: t("dashboard.sales"), value: (r: ProductRollup) => r.unitsSold },
          { header: t("dashboard.totalSales"), value: (r: ProductRollup) => r.totalRevenue },
        ]}
        rows={items}
        filename="product-list"
      />
      <DataTable
        columns={columns}
        rows={items}
        rowKey={(row) => row.id}
        caption={t("dashboard.topProducts")}
        emptyMessage={loading ? t("common.loading") : t("dashboard.noData")}
      />
      <Pagination
        page={page}
        totalPages={products?.totalPages ?? 1}
        total={products?.total ?? 0}
        onPageChange={setPage}
      />
    </div>
  );
}
