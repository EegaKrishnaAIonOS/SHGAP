import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const {
    data: shg,
    loading,
    error,
  } = useAsyncData(() => getShgDetail(shgId), [shgId], t("shgDashboard.loadError"));

  const columns: Column<ShgDetailRollup["products"][number]>[] = [
    { key: "name", header: t("dashboard.name"), render: (row) => row.name },
    { key: "category", header: t("catalogue.title"), render: (row) => row.categoryName },
    { key: "price", header: t("catalogue.price"), render: (row) => `₹${row.price}` },
    { key: "unitsSold", header: t("dashboard.sales"), render: (row) => row.unitsSold },
    {
      key: "revenue",
      header: t("dashboard.totalSales"),
      render: (row) => `₹${row.totalRevenue.toLocaleString()}`,
    },
  ];

  if (loading) {
    return <p className="text-sm text-neutral-500">{t("common.loading")}</p>;
  }
  if (error || !shg) {
    return <p className="text-sm text-danger-500">{error ?? t("shgDashboard.loadError")}</p>;
  }

  return (
    <div>
      <PageHeader
        title={`${t("shgDashboard.title")} — ${shg.name}`}
        subtitle={[shg.ulbName, shg.districtName].filter(Boolean).join(", ")}
        wireframe={false}
      />
      <p className="mb-4">
        <Link className="text-sm text-primary-600 hover:underline" to="/dashboards/shg">
          {t("dashboard.backToList")}
        </Link>
      </p>

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label={t("dashboard.totalSales")}
          value={`₹${shg.totalSalesAmount.toLocaleString()}`}
        />
        <StatCard label={t("dashboard.productsListed")} value={shg.products.length} />
        <StatCard label={t("dashboard.totalOrders")} value={shg.orderCount.toLocaleString()} />
        <StatCard label={t("dashboard.enquiries")} value={shg.enquiryCount.toLocaleString()} />
      </div>

      <ExportButtons
        title={shg.name}
        columns={[
          {
            header: t("dashboard.name"),
            value: (r: ShgDetailRollup["products"][number]) => r.name,
          },
          {
            header: t("catalogue.title"),
            value: (r: ShgDetailRollup["products"][number]) => r.categoryName,
          },
          {
            header: t("catalogue.price"),
            value: (r: ShgDetailRollup["products"][number]) => r.price,
          },
          {
            header: t("dashboard.sales"),
            value: (r: ShgDetailRollup["products"][number]) => r.unitsSold,
          },
          {
            header: t("dashboard.totalSales"),
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
        caption={t("dashboard.topProducts")}
        emptyMessage={t("dashboard.noData")}
      />
    </div>
  );
}

function ShgListView() {
  const { t } = useTranslation();
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
    t("shgDashboard.loadError"),
  );

  const totalSales = (shgs?.items ?? []).reduce((sum, s) => sum + s.totalSalesAmount, 0);
  const totalOrders = (shgs?.items ?? []).reduce((sum, s) => sum + s.orderCount, 0);

  const columns: Column<ShgRollup>[] = [
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
    { key: "district", header: t("dashboard.district"), render: (row) => row.districtName },
    { key: "ulb", header: t("nav.ulbDashboard"), render: (row) => row.ulbName ?? "—" },
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
        title={t("shgDashboard.title")}
        subtitle={t("shgDashboard.subtitle")}
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

      {error && <p className="mb-3 text-sm text-danger-500">{error}</p>}

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label={t("dashboard.totalSales")}
          value={`₹${(totalSales / 100000).toFixed(1)}L`}
        />
        <StatCard label={t("dashboard.totalOrders")} value={totalOrders.toLocaleString()} />
        <StatCard label={t("shgDashboard.title")} value={shgs?.total ?? 0} />
        <StatCard
          label={t("dashboard.productsListed")}
          value={(shgs?.items ?? []).reduce((sum, s) => sum + s.productCount, 0)}
        />
      </div>

      <div className="mb-5">
        <SimpleBarChart
          title={t("shgDashboard.title")}
          data={(shgs?.items ?? []).map((s) => ({ name: s.name, sales: s.totalSalesAmount }))}
          xKey="name"
          series={[{ key: "sales", label: t("dashboard.sales") }]}
        />
      </div>

      <ExportButtons
        title={t("shgDashboard.title")}
        columns={[
          { header: t("dashboard.name"), value: (r: ShgRollup) => r.name },
          { header: t("dashboard.district"), value: (r: ShgRollup) => r.districtName },
          { header: t("nav.ulbDashboard"), value: (r: ShgRollup) => r.ulbName ?? "" },
          { header: t("dashboard.productsListed"), value: (r: ShgRollup) => r.productCount },
          { header: t("dashboard.orders"), value: (r: ShgRollup) => r.orderCount },
          { header: t("dashboard.sales"), value: (r: ShgRollup) => r.totalSalesAmount },
        ]}
        rows={shgs?.items ?? []}
        filename="shg-list"
      />
      <DataTable
        columns={columns}
        rows={shgs?.items ?? []}
        rowKey={(row) => row.id}
        caption={t("shgDashboard.title")}
        emptyMessage={loading ? t("common.loading") : t("dashboard.noData")}
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
