import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../../components/PageHeader";
import {
  DashboardFilters,
  dateRangeToDateFrom,
  type DateRangeValue,
} from "../../components/DashboardFilters";
import { StatCard } from "../../components/ui/Card";
import { DataTable, type Column } from "../../components/ui/Table";
import { Pagination } from "../../components/ui/Pagination";
import { SimpleBarChart } from "../../components/ui/ChartWrapper";
import { ExportButtons } from "../../components/ui/ExportButtons";
import { useAsyncData } from "../../lib/useAsyncData";
import { getBuyers, getDistrictSales } from "../../lib/api/analytics";
import type { BuyerRollup } from "../../lib/api/types";

const PAGE_SIZE = 20;

export function BuyerDashboardPage() {
  const [dateRange, setDateRange] = useState<DateRangeValue>("30d");
  const [districtId, setDistrictId] = useState("");
  const [page, setPage] = useState(1);
  const dateFrom = useMemo(() => dateRangeToDateFrom(dateRange), [dateRange]);

  useEffect(() => {
    setPage(1);
  }, [dateRange, districtId]);

  const { data: districts } = useAsyncData(() => getDistrictSales({ dateFrom }), [dateFrom]);

  const {
    data: buyers,
    loading,
    error,
  } = useAsyncData(
    () => getBuyers({ dateFrom, districtId: districtId || undefined, page, pageSize: PAGE_SIZE }),
    [dateFrom, districtId, page],
    "Couldn't load buyer data. Please try again.",
  );

  const items = buyers?.items ?? [];
  const totalOrders = items.reduce((sum, b) => sum + b.orderCount, 0);
  const totalSpend = items.reduce((sum, b) => sum + b.totalSpend, 0);
  const totalRecommendations = items.reduce((sum, b) => sum + b.recommendationsReceived, 0);
  const ordersByType = Object.values(
    items.reduce<Record<string, { type: string; orders: number }>>((acc, b) => {
      acc[b.type] ??= { type: b.type, orders: 0 };
      acc[b.type].orders += b.orderCount;
      return acc;
    }, {}),
  );

  const columns: Column<BuyerRollup>[] = [
    { key: "name", header: "Name", render: (row) => row.name },
    { key: "type", header: "Product Catalogue", render: (row) => row.type },
    { key: "orders", header: "Orders", render: (row) => row.orderCount },
    {
      key: "totalSpend",
      header: "Total sales",
      render: (row) => `₹${row.totalSpend.toLocaleString()}`,
    },
    {
      key: "recommendations",
      header: "Recommendations",
      render: (row) => `${row.recommendationsAccepted}/${row.recommendationsReceived}`,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Buyer Dashboard"
        subtitle="Buyer engagement view — registered buyers, repeat orders and demand trends."
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

      {error && <p className="mb-3 text-sm text-danger-500">{error}</p>}

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Registered buyers" value={buyers?.total ?? 0} />
        <StatCard label="Total orders" value={totalOrders.toLocaleString()} />
        <StatCard label="Total sales" value={`₹${(totalSpend / 100000).toFixed(1)}L`} />
        <StatCard label="Recommendations" value={totalRecommendations.toLocaleString()} />
      </div>

      <div className="mb-5">
        <SimpleBarChart
          title="Orders"
          data={ordersByType}
          xKey="type"
          series={[{ key: "orders", label: "Orders" }]}
        />
      </div>

      <ExportButtons
        title="Buyer Dashboard"
        columns={[
          { header: "Name", value: (r: BuyerRollup) => r.name },
          { header: "Product Catalogue", value: (r: BuyerRollup) => r.type },
          { header: "Orders", value: (r: BuyerRollup) => r.orderCount },
          { header: "Total sales", value: (r: BuyerRollup) => r.totalSpend },
          {
            header: "Recommendations",
            value: (r: BuyerRollup) => `${r.recommendationsAccepted}/${r.recommendationsReceived}`,
          },
        ]}
        rows={items}
        filename="buyer-list"
      />
      <DataTable
        columns={columns}
        rows={items}
        rowKey={(row) => row.id}
        caption="Recent orders"
        emptyMessage={loading ? "Loading..." : "No data for the selected filters yet."}
      />
      <Pagination
        page={page}
        totalPages={buyers?.totalPages ?? 1}
        total={buyers?.total ?? 0}
        onPageChange={setPage}
      />
    </div>
  );
}
