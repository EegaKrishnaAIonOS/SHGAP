import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import {
  DashboardFilters,
  dateRangeToDateFrom,
  type DateRangeValue,
} from "../../components/DashboardFilters";
import { StatCard } from "../../components/ui/Card";
import { DataTable, type Column } from "../../components/ui/Table";
import { SimpleLineChart, SimplePieChart } from "../../components/ui/ChartWrapper";
import { ExportButtons } from "../../components/ui/ExportButtons";
import { useAsyncData } from "../../lib/useAsyncData";
import {
  getCategorySales,
  getDistrictSales,
  getSalesTrend,
  getShgs,
  getUlbSales,
} from "../../lib/api/analytics";
import type { PaginatedResult, ShgRollup, UlbSalesRollup } from "../../lib/api/types";

const EMPTY_SHGS: PaginatedResult<ShgRollup> = {
  items: [],
  page: 1,
  pageSize: 20,
  total: 0,
  totalPages: 0,
};

export function UlbDashboardPage() {
  const { t } = useTranslation();
  const [dateRange, setDateRange] = useState<DateRangeValue>("30d");
  const [districtId, setDistrictId] = useState("");
  const [ulbId, setUlbId] = useState("");
  const dateFrom = useMemo(() => dateRangeToDateFrom(dateRange), [dateRange]);

  const { data: districts } = useAsyncData(() => getDistrictSales({ dateFrom }), [dateFrom]);

  const {
    data: ulbs,
    loading: ulbsLoading,
    error: ulbsError,
  } = useAsyncData(
    () => getUlbSales({ dateFrom, districtId: districtId || undefined }),
    [dateFrom, districtId],
    t("ulbDashboard.loadError"),
  );

  const { data: shgs, loading: shgsLoading } = useAsyncData(
    () =>
      ulbId
        ? getShgs({ dateFrom, districtId: districtId || undefined, ulbId, page: 1, pageSize: 20 })
        : Promise.resolve(EMPTY_SHGS),
    [dateFrom, districtId, ulbId],
  );

  const { data: categories } = useAsyncData(
    () =>
      getCategorySales({
        dateFrom,
        districtId: districtId || undefined,
        ulbId: ulbId || undefined,
      }),
    [dateFrom, districtId, ulbId],
  );

  const { data: trend } = useAsyncData(
    () =>
      getSalesTrend("month", {
        dateFrom,
        districtId: districtId || undefined,
        ulbId: ulbId || undefined,
      }),
    [dateFrom, districtId, ulbId],
  );

  const selectedUlb = ulbs?.find((u) => u.ulbId === ulbId);
  const visibleRows = ulbId ? (ulbs ?? []).filter((u) => u.ulbId === ulbId) : (ulbs ?? []);
  const totalSales = visibleRows.reduce((sum, u) => sum + u.totalAmount, 0);
  const totalOrders = visibleRows.reduce((sum, u) => sum + u.orderCount, 0);

  const ulbColumns: Column<UlbSalesRollup>[] = [
    { key: "name", header: t("dashboard.name"), render: (row) => row.ulbName },
    { key: "district", header: t("dashboard.district"), render: (row) => row.districtName },
    {
      key: "orders",
      header: t("dashboard.orders"),
      render: (row) => row.orderCount.toLocaleString(),
    },
    {
      key: "sales",
      header: t("dashboard.sales"),
      render: (row) => `₹${row.totalAmount.toLocaleString()}`,
    },
  ];

  const shgColumns: Column<ShgRollup>[] = [
    {
      key: "name",
      header: t("dashboard.name"),
      render: (row) => (
        <Link
          className="font-medium text-primary-600 hover:underline"
          to={`/dashboards/shg?shgId=${row.id}`}
        >
          {row.name}
        </Link>
      ),
    },
    { key: "products", header: t("dashboard.productsListed"), render: (row) => row.productCount },
    {
      key: "orders",
      header: t("dashboard.orders"),
      render: (row) => row.orderCount.toLocaleString(),
    },
    {
      key: "sales",
      header: t("dashboard.sales"),
      render: (row) => `₹${row.totalSalesAmount.toLocaleString()}`,
    },
  ];

  return (
    <div>
      <PageHeader
        title={
          selectedUlb
            ? `${t("ulbDashboard.title")} — ${selectedUlb.ulbName}`
            : t("ulbDashboard.title")
        }
        subtitle={t("ulbDashboard.subtitle")}
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
            onChange: (value) => {
              setDistrictId(value);
              setUlbId("");
            },
            options: [
              { value: "", label: t("dashboard.allDistricts") },
              ...(districts ?? []).map((d) => ({ value: d.districtId, label: d.districtName })),
            ],
          },
          {
            key: "ulb",
            label: t("nav.ulbDashboard"),
            value: ulbId,
            onChange: setUlbId,
            options: [
              { value: "", label: t("dashboard.allUlbs") },
              ...(ulbs ?? []).map((u) => ({ value: u.ulbId, label: u.ulbName })),
            ],
          },
        ]}
      />

      {ulbsError && <p className="mb-3 text-sm text-danger-500">{ulbsError}</p>}

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label={t("dashboard.totalSales")}
          value={`₹${(totalSales / 100000).toFixed(1)}L`}
        />
        <StatCard label={t("dashboard.totalOrders")} value={totalOrders.toLocaleString()} />
        <StatCard
          label={ulbId ? t("shgDashboard.totalShgs") : t("ulbDashboard.totalUlbs")}
          value={ulbId ? (shgs?.total ?? 0) : (ulbs ?? []).length}
        />
        <StatCard label={t("dashboard.topCategories")} value={(categories ?? []).length} />
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <SimpleLineChart
          title={t("dashboard.salesTrend")}
          data={(trend ?? []).map((p) => ({
            month: new Date(p.bucket).toLocaleDateString(undefined, {
              month: "short",
              year: "2-digit",
            }),
            sales: p.totalAmount,
          }))}
          xKey="month"
          series={[{ key: "sales", label: t("dashboard.sales") }]}
        />
        <SimplePieChart
          title={t("dashboard.topCategories")}
          data={(categories ?? []).map((c) => ({ category: c.categoryName, value: c.totalAmount }))}
          nameKey="category"
          valueKey="value"
        />
      </div>

      {ulbId ? (
        <>
          <ExportButtons
            title={t("shgDashboard.title")}
            columns={[
              { header: t("dashboard.name"), value: (r: ShgRollup) => r.name },
              { header: t("dashboard.productsListed"), value: (r: ShgRollup) => r.productCount },
              { header: t("dashboard.orders"), value: (r: ShgRollup) => r.orderCount },
              { header: t("dashboard.sales"), value: (r: ShgRollup) => r.totalSalesAmount },
            ]}
            rows={shgs?.items ?? []}
            filename="shg-breakdown"
          />
          <DataTable
            columns={shgColumns}
            rows={shgs?.items ?? []}
            rowKey={(row) => row.id}
            caption={t("shgDashboard.listCaption")}
            emptyMessage={shgsLoading ? t("common.loading") : t("dashboard.noData")}
          />
        </>
      ) : (
        <>
          <ExportButtons
            title={t("ulbDashboard.title")}
            columns={[
              { header: t("dashboard.name"), value: (r: UlbSalesRollup) => r.ulbName },
              { header: t("dashboard.district"), value: (r: UlbSalesRollup) => r.districtName },
              { header: t("dashboard.orders"), value: (r: UlbSalesRollup) => r.orderCount },
              { header: t("dashboard.sales"), value: (r: UlbSalesRollup) => r.totalAmount },
            ]}
            rows={ulbs ?? []}
            filename="ulb-breakdown"
          />
          <DataTable
            columns={ulbColumns}
            rows={ulbs ?? []}
            rowKey={(row) => row.ulbId}
            caption={t("ulbDashboard.listCaption")}
            emptyMessage={ulbsLoading ? t("common.loading") : t("dashboard.noData")}
          />
        </>
      )}
    </div>
  );
}
