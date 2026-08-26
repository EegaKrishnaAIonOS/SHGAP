import { useMemo, useState } from "react";
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
    "Couldn't load ULB sales data. Please try again.",
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
    { key: "name", header: "Name", render: (row) => row.ulbName },
    { key: "district", header: "District", render: (row) => row.districtName },
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

  const shgColumns: Column<ShgRollup>[] = [
    {
      key: "name",
      header: "Name",
      render: (row) => (
        <Link
          className="font-medium text-primary-600 hover:underline"
          to={`/dashboards/shg?shgId=${row.id}`}
        >
          {row.name}
        </Link>
      ),
    },
    { key: "products", header: "Products listed", render: (row) => row.productCount },
    {
      key: "orders",
      header: "Orders",
      render: (row) => row.orderCount.toLocaleString(),
    },
    {
      key: "sales",
      header: "Sales",
      render: (row) => `₹${row.totalSalesAmount.toLocaleString()}`,
    },
  ];

  return (
    <div>
      <PageHeader
        title={selectedUlb ? `ULB Dashboard — ${selectedUlb.ulbName}` : "ULB Dashboard"}
        subtitle="Urban Local Body officer view — SHG and product performance within the ULB."
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
            onChange: (value) => {
              setDistrictId(value);
              setUlbId("");
            },
            options: [
              { value: "", label: "All districts" },
              ...(districts ?? []).map((d) => ({ value: d.districtId, label: d.districtName })),
            ],
          },
          {
            key: "ulb",
            label: "ULB Dashboard",
            value: ulbId,
            onChange: setUlbId,
            options: [
              { value: "", label: "All ULBs" },
              ...(ulbs ?? []).map((u) => ({ value: u.ulbId, label: u.ulbName })),
            ],
          },
        ]}
      />

      {ulbsError && <p className="mb-3 text-sm text-danger-500">{ulbsError}</p>}

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total sales" value={`₹${(totalSales / 100000).toFixed(1)}L`} />
        <StatCard label="Total orders" value={totalOrders.toLocaleString()} />
        <StatCard
          label={ulbId ? "Total SHGs" : "Total ULBs"}
          value={ulbId ? (shgs?.total ?? 0) : (ulbs ?? []).length}
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

      {ulbId ? (
        <>
          <ExportButtons
            title="SHG Dashboard"
            columns={[
              { header: "Name", value: (r: ShgRollup) => r.name },
              { header: "Products listed", value: (r: ShgRollup) => r.productCount },
              { header: "Orders", value: (r: ShgRollup) => r.orderCount },
              { header: "Sales", value: (r: ShgRollup) => r.totalSalesAmount },
            ]}
            rows={shgs?.items ?? []}
            filename="shg-breakdown"
          />
          <DataTable
            columns={shgColumns}
            rows={shgs?.items ?? []}
            rowKey={(row) => row.id}
            caption="SHG list"
            emptyMessage={shgsLoading ? "Loading..." : "No data for the selected filters yet."}
          />
        </>
      ) : (
        <>
          <ExportButtons
            title="ULB Dashboard"
            columns={[
              { header: "Name", value: (r: UlbSalesRollup) => r.ulbName },
              { header: "District", value: (r: UlbSalesRollup) => r.districtName },
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
            caption="ULB list"
            emptyMessage={ulbsLoading ? "Loading..." : "No data for the selected filters yet."}
          />
        </>
      )}
    </div>
  );
}
