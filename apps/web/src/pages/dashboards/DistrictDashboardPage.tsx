import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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
  getUlbSales,
} from "../../lib/api/analytics";
import type { DistrictSalesRollup, UlbSalesRollup } from "../../lib/api/types";

export function DistrictDashboardPage() {
  const { t } = useTranslation();
  const [dateRange, setDateRange] = useState<DateRangeValue>("30d");
  const [districtId, setDistrictId] = useState("");
  const dateFrom = useMemo(() => dateRangeToDateFrom(dateRange), [dateRange]);

  const {
    data: districts,
    loading: districtsLoading,
    error: districtsError,
  } = useAsyncData(
    () => getDistrictSales({ dateFrom }),
    [dateFrom],
    t("districtDashboard.loadError"),
  );

  const { data: ulbs, loading: ulbsLoading } = useAsyncData(
    () => (districtId ? getUlbSales({ dateFrom, districtId }) : Promise.resolve([])),
    [dateFrom, districtId],
  );

  const { data: categories } = useAsyncData(
    () => getCategorySales({ dateFrom, districtId: districtId || undefined }),
    [dateFrom, districtId],
  );

  const { data: trend } = useAsyncData(
    () => getSalesTrend("month", { dateFrom, districtId: districtId || undefined }),
    [dateFrom, districtId],
  );

  const selectedDistrict = districts?.find((d) => d.districtId === districtId);
  const visibleRows = districtId
    ? (districts ?? []).filter((d) => d.districtId === districtId)
    : (districts ?? []);
  const totalSales = visibleRows.reduce((sum, d) => sum + d.totalAmount, 0);
  const totalOrders = visibleRows.reduce((sum, d) => sum + d.orderCount, 0);

  const districtColumns: Column<DistrictSalesRollup>[] = [
    { key: "name", header: t("dashboard.name"), render: (row) => row.districtName },
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

  const ulbColumns: Column<UlbSalesRollup>[] = [
    { key: "name", header: t("dashboard.name"), render: (row) => row.ulbName },
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

  return (
    <div>
      <PageHeader
        title={
          selectedDistrict
            ? `${t("districtDashboard.title")} — ${selectedDistrict.districtName}`
            : t("districtDashboard.title")
        }
        subtitle={t("districtDashboard.subtitle")}
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
        ]}
      />

      {districtsError && <p className="mb-3 text-sm text-danger-500">{districtsError}</p>}

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label={t("dashboard.totalSales")}
          value={`₹${(totalSales / 100000).toFixed(1)}L`}
        />
        <StatCard label={t("dashboard.totalOrders")} value={totalOrders.toLocaleString()} />
        <StatCard
          label={t("nav.ulbDashboard")}
          value={districtId ? (ulbs ?? []).length : (districts ?? []).length}
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

      {districtId ? (
        <>
          <ExportButtons
            title={t("dashboard.ulbBreakdown")}
            columns={[
              { header: t("dashboard.name"), value: (r: UlbSalesRollup) => r.ulbName },
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
            caption={t("dashboard.ulbBreakdown")}
            emptyMessage={ulbsLoading ? t("common.loading") : t("dashboard.noUlbData")}
          />
        </>
      ) : (
        <>
          <ExportButtons
            title={t("dashboard.districtBreakdown")}
            columns={[
              { header: t("dashboard.name"), value: (r: DistrictSalesRollup) => r.districtName },
              { header: t("dashboard.orders"), value: (r: DistrictSalesRollup) => r.orderCount },
              { header: t("dashboard.sales"), value: (r: DistrictSalesRollup) => r.totalAmount },
            ]}
            rows={districts ?? []}
            filename="district-breakdown"
          />
          <DataTable
            columns={districtColumns}
            rows={districts ?? []}
            rowKey={(row) => row.districtId}
            caption={t("dashboard.districtBreakdown")}
            emptyMessage={districtsLoading ? t("common.loading") : t("dashboard.noData")}
          />
        </>
      )}
    </div>
  );
}
