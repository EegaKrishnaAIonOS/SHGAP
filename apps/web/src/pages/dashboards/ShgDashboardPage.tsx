import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
import { getDistrictSales, getShgDetail, getShgs, getUlbSales } from "../../lib/api/analytics";
import type { ShgDetailRollup, ShgRollup } from "../../lib/api/types";

const PAGE_SIZE = 20;

function ShgDetailView({ shgId }: { shgId: string }) {
  const {
    data: shg,
    loading,
    error,
  } = useAsyncData(() => getShgDetail(shgId), [shgId], "Couldn't load SHG data. Please try again.");

  const columns: Column<ShgDetailRollup["products"][number]>[] = [
    { key: "name", header: "Name", render: (row) => row.name },
    { key: "category", header: "Product Catalogue", render: (row) => row.categoryName },
    { key: "price", header: "Price", render: (row) => `₹${row.price}` },
    { key: "unitsSold", header: "Sales", render: (row) => row.unitsSold },
    {
      key: "revenue",
      header: "Total sales",
      render: (row) => `₹${row.totalRevenue.toLocaleString()}`,
    },
  ];

  if (loading) {
    return <p className="text-sm text-neutral-500">Loading...</p>;
  }
  if (error || !shg) {
    return (
      <p className="text-sm text-danger-500">
        {error ?? "Couldn't load SHG data. Please try again."}
      </p>
    );
  }

  return (
    <div>
      <PageHeader
        title={`SHG Dashboard — ${shg.name}`}
        subtitle={[shg.ulbName, shg.districtName].filter(Boolean).join(", ")}
        wireframe={false}
      />
      <p className="mb-4">
        <Link className="text-sm text-primary-600 hover:underline" to="/dashboards/shg">
          ← Back to list
        </Link>
      </p>

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total sales" value={`₹${shg.totalSalesAmount.toLocaleString()}`} />
        <StatCard label="Products listed" value={shg.products.length} />
        <StatCard label="Total orders" value={shg.orderCount.toLocaleString()} />
        <StatCard label="Enquiries" value={shg.enquiryCount.toLocaleString()} />
      </div>

      <ExportButtons
        title={shg.name}
        columns={[
          {
            header: "Name",
            value: (r: ShgDetailRollup["products"][number]) => r.name,
          },
          {
            header: "Product Catalogue",
            value: (r: ShgDetailRollup["products"][number]) => r.categoryName,
          },
          {
            header: "Price",
            value: (r: ShgDetailRollup["products"][number]) => r.price,
          },
          {
            header: "Sales",
            value: (r: ShgDetailRollup["products"][number]) => r.unitsSold,
          },
          {
            header: "Total sales",
            value: (r: ShgDetailRollup["products"][number]) => r.totalRevenue,
          },
        ]}
        rows={shg.products}
        filename={`shg-${shg.id}-products`}
      />
      <DataTable
        columns={columns}
        rows={shg.products}
        rowKey={(row) => row.id}
        caption="Top products"
        emptyMessage="No data for the selected filters yet."
      />
    </div>
  );
}

function ShgListView() {
  const [dateRange, setDateRange] = useState<DateRangeValue>("30d");
  const [districtId, setDistrictId] = useState("");
  const [ulbId, setUlbId] = useState("");
  const [page, setPage] = useState(1);
  const dateFrom = useMemo(() => dateRangeToDateFrom(dateRange), [dateRange]);

  useEffect(() => {
    setPage(1);
  }, [dateRange, districtId, ulbId]);

  const { data: districts } = useAsyncData(() => getDistrictSales({ dateFrom }), [dateFrom]);
  const { data: ulbs } = useAsyncData(
    () => getUlbSales({ dateFrom, districtId: districtId || undefined }),
    [dateFrom, districtId],
  );

  const {
    data: shgs,
    loading,
    error,
  } = useAsyncData(
    () =>
      getShgs({
        dateFrom,
        districtId: districtId || undefined,
        ulbId: ulbId || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    [dateFrom, districtId, ulbId, page],
    "Couldn't load SHG data. Please try again.",
  );

  const totalSales = (shgs?.items ?? []).reduce((sum, s) => sum + s.totalSalesAmount, 0);
  const totalOrders = (shgs?.items ?? []).reduce((sum, s) => sum + s.orderCount, 0);

  const columns: Column<ShgRollup>[] = [
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
    { key: "district", header: "District", render: (row) => row.districtName },
    { key: "ulb", header: "ULB Dashboard", render: (row) => row.ulbName ?? "—" },
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
        title="SHG Dashboard"
        subtitle="Per-SHG monitoring view — membership, product mix and sales for a single group."
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

      {error && <p className="mb-3 text-sm text-danger-500">{error}</p>}

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total sales" value={`₹${(totalSales / 100000).toFixed(1)}L`} />
        <StatCard label="Total orders" value={totalOrders.toLocaleString()} />
        <StatCard label="Total SHGs" value={shgs?.total ?? 0} />
        <StatCard
          label="Products listed"
          value={(shgs?.items ?? []).reduce((sum, s) => sum + s.productCount, 0)}
        />
      </div>

      <div className="mb-5">
        <SimpleBarChart
          title="Sales by SHG"
          data={(shgs?.items ?? []).map((s) => ({ name: s.name, sales: s.totalSalesAmount }))}
          xKey="name"
          series={[{ key: "sales", label: "Sales" }]}
        />
      </div>

      <ExportButtons
        title="SHG Dashboard"
        columns={[
          { header: "Name", value: (r: ShgRollup) => r.name },
          { header: "District", value: (r: ShgRollup) => r.districtName },
          { header: "ULB Dashboard", value: (r: ShgRollup) => r.ulbName ?? "" },
          { header: "Products listed", value: (r: ShgRollup) => r.productCount },
          { header: "Orders", value: (r: ShgRollup) => r.orderCount },
          { header: "Sales", value: (r: ShgRollup) => r.totalSalesAmount },
        ]}
        rows={shgs?.items ?? []}
        filename="shg-list"
      />
      <DataTable
        columns={columns}
        rows={shgs?.items ?? []}
        rowKey={(row) => row.id}
        caption="SHG list"
        emptyMessage={loading ? "Loading..." : "No data for the selected filters yet."}
      />
      <Pagination
        page={page}
        totalPages={shgs?.totalPages ?? 1}
        total={shgs?.total ?? 0}
        onPageChange={setPage}
      />
    </div>
  );
}

export function ShgDashboardPage() {
  const [searchParams] = useSearchParams();
  const shgId = searchParams.get("shgId");
  return shgId ? <ShgDetailView shgId={shgId} /> : <ShgListView />;
}
