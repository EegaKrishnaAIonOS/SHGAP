import { useMemo, useState } from "react";
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
    "Couldn't load district sales data. Please try again.",
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
    { key: "name", header: "Name", render: (row) => row.districtName },
    {
      key: "orders",
      header: "Orders",
      render: (row) => row.orderCount.toLocaleString(),
    },
    {
      key: "sales",
      header: "Sales",
      render: (row) => `₹${row.totalAmount.toLocaleString()}`,
    },
  ];

  const ulbColumns: Column<UlbSalesRollup>[] = [
    { key: "name", header: "Name", render: (row) => row.ulbName },
    {
      key: "orders",
      header: "Orders",
      render: (row) => row.orderCount.toLocaleString(),
    },
    {
      key: "sales",
      header: "Sales",
      render: (row) => `₹${row.totalAmount.toLocaleString()}`,
    },
  ];

  return (
    <div>
      <PageHeader
        title={
          selectedDistrict
            ? `District Dashboard — ${selectedDistrict.districtName}`
            : "District Dashboard"
        }
        subtitle="MEPMA district officer view — SHG performance across ULBs and mandals."
        wireframe={false}
      />
      <DashboardFilters
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        extra={[
          {
            key: "district",
            label: "District",
            value: districtId,
            onChange: setDistrictId,
            options: [
              { value: "", label: "All districts" },
              ...(districts ?? []).map((d) => ({ value: d.districtId, label: d.districtName })),
            ],
          },
        ]}
      />

      {districtsError && <p className="mb-3 text-sm text-danger-500">{districtsError}</p>}

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total sales" value={`₹${(totalSales / 100000).toFixed(1)}L`} />
        <StatCard label="Total orders" value={totalOrders.toLocaleString()} />
        <StatCard
          label="ULB Dashboard"
          value={districtId ? (ulbs ?? []).length : (districts ?? []).length}
        />
        <StatCard label="Top categories" value={(categories ?? []).length} />
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <SimpleLineChart
          title="Sales trend"
          data={(trend ?? []).map((p) => ({
            month: new Date(p.bucket).toLocaleDateString(undefined, {
              month: "short",
              year: "2-digit",
            }),
            sales: p.totalAmount,
          }))}
          xKey="month"
          series={[{ key: "sales", label: "Sales" }]}
        />
        <SimplePieChart
          title="Top categories"
          data={(categories ?? []).map((c) => ({ category: c.categoryName, value: c.totalAmount }))}
          nameKey="category"
          valueKey="value"
        />
      </div>

      {districtId ? (
        <>
          <ExportButtons
            title="ULB-wise breakdown"
            columns={[
              { header: "Name", value: (r: UlbSalesRollup) => r.ulbName },
              { header: "Orders", value: (r: UlbSalesRollup) => r.orderCount },
              { header: "Sales", value: (r: UlbSalesRollup) => r.totalAmount },
            ]}
            rows={ulbs ?? []}
            filename="ulb-breakdown"
          />
          <DataTable
            columns={ulbColumns}
            rows={ulbs ?? []}
            rowKey={(row) => row.ulbId}
            caption="ULB-wise breakdown"
            emptyMessage={ulbsLoading ? "Loading..." : "No ULB data for the selected filters yet."}
          />
        </>
      ) : (
        <>
          <ExportButtons
            title="District-wise breakdown"
            columns={[
              { header: "Name", value: (r: DistrictSalesRollup) => r.districtName },
              { header: "Orders", value: (r: DistrictSalesRollup) => r.orderCount },
              { header: "Sales", value: (r: DistrictSalesRollup) => r.totalAmount },
            ]}
            rows={districts ?? []}
            filename="district-breakdown"
          />
          <DataTable
            columns={districtColumns}
            rows={districts ?? []}
            rowKey={(row) => row.districtId}
            caption="District-wise breakdown"
            emptyMessage={districtsLoading ? "Loading..." : "No data for the selected filters yet."}
          />
        </>
      )}
    </div>
  );
}
