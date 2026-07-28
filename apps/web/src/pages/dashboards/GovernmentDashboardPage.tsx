import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PageHeader } from "../../components/PageHeader";
import {
  DashboardFilters,
  dateRangeToDateFrom,
  type DateRangeValue,
} from "../../components/DashboardFilters";
import { StatCard, Card, CardTitle } from "../../components/ui/Card";
import { DataTable, type Column } from "../../components/ui/Table";
import { SimpleBarChart, SimplePieChart } from "../../components/ui/ChartWrapper";
import { ExportButtons } from "../../components/ui/ExportButtons";
import { ActivityMap } from "../../components/ui/ActivityMap";
import { useAsyncData } from "../../lib/useAsyncData";
import {
  getDistrictSales,
  getEnquirySummary,
  getGeoActivity,
  getProducts,
  getRecommendationSummary,
  getShgs,
} from "../../lib/api/analytics";
import { getHealth } from "../../lib/api/health";
import type { BuyerActivityPoint, DistrictSalesRollup, ProductRollup } from "../../lib/api/types";

const EMPTY_PRODUCTS = {
  items: [] as ProductRollup[],
  page: 1,
  pageSize: 10,
  total: 0,
  totalPages: 0,
};

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * Module-7 government dashboard (T19/T20): state (MEPMA HQ) level roll-up
 * across all districts — platform KPIs, district/product rankings, market
 * linkage + recommendation-quality panels, and a real geo-activity map
 * (ADR-0028/0029) — discrete, value-scaled markers over the platform's
 * actual geo-tagged SHGs/buyers rather than a smoothed heat-density layer,
 * since the pilot only has a handful of real geo-tagged points today.
 */
export function GovernmentDashboardPage() {
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
    t("governmentDashboard.loadError"),
  );

  const { data: recommendations } = useAsyncData(
    () => getRecommendationSummary({ dateFrom, districtId: districtId || undefined }),
    [dateFrom, districtId],
  );

  const { data: enquiries } = useAsyncData(
    () => getEnquirySummary({ dateFrom, districtId: districtId || undefined }),
    [dateFrom, districtId],
  );

  const { data: shgs } = useAsyncData(
    () => getShgs({ dateFrom, districtId: districtId || undefined, page: 1, pageSize: 1 }),
    [dateFrom, districtId],
  );

  const { data: products } = useAsyncData(
    () =>
      getProducts({ dateFrom, districtId: districtId || undefined, page: 1, pageSize: 10 }).catch(
        () => EMPTY_PRODUCTS,
      ),
    [dateFrom, districtId],
  );

  const { data: health } = useAsyncData(() => getHealth(), []);

  const { data: geoActivity } = useAsyncData(
    () => getGeoActivity({ dateFrom, districtId: districtId || undefined }),
    [dateFrom, districtId],
  );

  const visibleDistricts = districtId
    ? (districts ?? []).filter((d) => d.districtId === districtId)
    : (districts ?? []);
  const totalSales = visibleDistricts.reduce((sum, d) => sum + d.totalAmount, 0);
  const totalOrders = visibleDistricts.reduce((sum, d) => sum + d.orderCount, 0);

  const districtColumns: Column<DistrictSalesRollup & { rank: number }>[] = [
    { key: "rank", header: "#", render: (row) => row.rank },
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
  // Districts already arrive sorted by total_amount DESC from the backend
  // (analytics.service.ts), so the rank is just the row's position.
  const rankedDistricts = visibleDistricts.map((d, i) => ({ ...d, rank: i + 1 }));

  const productColumns: Column<ProductRollup & { rank: number }>[] = [
    { key: "rank", header: "#", render: (row) => row.rank },
    { key: "name", header: t("dashboard.name"), render: (row) => row.name },
    { key: "shg", header: "SHG", render: (row) => row.shgName },
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
  const rankedProducts = (products?.items ?? []).map((p, i) => ({ ...p, rank: i + 1 }));

  const topBuyers = [...(geoActivity?.buyerPoints ?? [])]
    .sort((a, b) => b.recommendationsReceived - a.recommendationsReceived)
    .slice(0, 5);

  const recommendationBreakdown = recommendations
    ? [
        { status: t("dashboard.pending"), value: recommendations.pending },
        { status: t("dashboard.accepted"), value: recommendations.accepted },
        { status: t("dashboard.rejected"), value: recommendations.rejected },
        { status: t("dashboard.expired"), value: recommendations.expired },
      ]
    : [];

  return (
    <div>
      <PageHeader
        title={t("governmentDashboard.title")}
        subtitle={t("governmentDashboard.subtitle")}
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

      <h2 className="mb-3 text-lg font-semibold text-neutral-900">
        {t("governmentDashboard.platformKpis")}
      </h2>
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label={t("governmentDashboard.registeredShgs")} value={shgs?.total ?? 0} />
        <StatCard label={t("dashboard.productsListed")} value={products?.total ?? 0} />
        <StatCard
          label={t("governmentDashboard.enquiriesGenerated")}
          value={enquiries?.total ?? 0}
        />
        <StatCard
          label={t("governmentDashboard.apiUptime")}
          value={health ? formatUptime(health.uptimeSeconds) : "—"}
          delta={t("governmentDashboard.uptimeCaveat")}
        />
        <StatCard
          label={t("governmentDashboard.satisfaction")}
          value="—"
          delta={t("governmentDashboard.satisfactionCaveat")}
        />
      </div>

      <h2 className="mb-3 text-lg font-semibold text-neutral-900">
        {t("governmentDashboard.stateOverview")}
      </h2>
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard
          label={t("dashboard.totalSales")}
          value={`₹${(totalSales / 10000000).toFixed(2)} Cr`}
        />
        <StatCard label={t("dashboard.totalOrders")} value={totalOrders.toLocaleString()} />
        <StatCard label={t("districtDashboard.title")} value={visibleDistricts.length} />
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <SimpleBarChart
          title={t("governmentDashboard.districtComparison")}
          data={visibleDistricts.map((d) => ({ district: d.districtName, sales: d.totalAmount }))}
          xKey="district"
          series={[{ key: "sales", label: t("dashboard.sales") }]}
        />
        <SimpleBarChart
          title={t("governmentDashboard.productPerformance")}
          data={rankedProducts.map((p) => ({ name: p.name, revenue: p.totalRevenue }))}
          xKey="name"
          series={[{ key: "revenue", label: t("dashboard.totalSales") }]}
        />
      </div>

      <h2 className="mb-3 text-lg font-semibold text-neutral-900">
        {t("governmentDashboard.marketLinkage")}
      </h2>
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label={t("governmentDashboard.shgsLinked")}
          value={recommendations?.shgsLinked ?? 0}
        />
        <StatCard
          label={t("governmentDashboard.buyersLinked")}
          value={recommendations?.buyersLinked ?? 0}
        />
        <StatCard
          label={t("dashboard.acceptanceRate")}
          value={
            recommendations?.acceptanceRate == null
              ? "—"
              : `${(recommendations.acceptanceRate * 100).toFixed(0)}%`
          }
        />
        <StatCard
          label={t("governmentDashboard.avgMatchScore")}
          value={
            recommendations?.avgMatchScore == null
              ? "—"
              : `${(recommendations.avgMatchScore * 100).toFixed(0)}%`
          }
        />
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <SimplePieChart
          title={t("governmentDashboard.recommendationSummary")}
          data={recommendationBreakdown}
          nameKey="status"
          valueKey="value"
        />
        <Card>
          <CardTitle className="mb-3">{t("governmentDashboard.topBuyers")}</CardTitle>
          <ul className="divide-y divide-neutral-100 text-sm">
            {topBuyers.length === 0 && (
              <li className="py-3 text-neutral-400">{t("dashboard.noData")}</li>
            )}
            {topBuyers.map((b: BuyerActivityPoint) => (
              <li key={b.id} className="flex items-center justify-between py-2">
                <span className="font-medium text-neutral-800">{b.name}</span>
                <span className="text-neutral-500">
                  {b.recommendationsReceived} {t("dashboard.recommendations").toLowerCase()}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle className="mb-3">{t("governmentDashboard.shgActivityMap")}</CardTitle>
          <ActivityMap
            color="#aa3bff"
            points={(geoActivity?.shgPoints ?? []).map((p) => ({
              id: p.id,
              lat: p.lat,
              lng: p.lng,
              label: `${p.name} (${p.districtName})`,
              value: p.totalSalesAmount,
              valueLabel: `₹${p.totalSalesAmount.toLocaleString()} ${t("dashboard.sales").toLowerCase()}`,
            }))}
          />
        </Card>
        <Card>
          <CardTitle className="mb-3">{t("governmentDashboard.buyerActivityMap")}</CardTitle>
          <ActivityMap
            color="#0ea5e9"
            points={(geoActivity?.buyerPoints ?? []).map((p) => ({
              id: p.id,
              lat: p.lat,
              lng: p.lng,
              label: `${p.name} (${p.type})`,
              value: p.recommendationsReceived,
              valueLabel: `${p.recommendationsReceived} ${t("dashboard.recommendations").toLowerCase()}`,
            }))}
          />
        </Card>
      </div>

      <h2 className="mb-3 text-lg font-semibold text-neutral-900">
        {t("governmentDashboard.districtRanking")}
      </h2>
      <ExportButtons
        title={t("governmentDashboard.districtRanking")}
        columns={[
          { header: "#", value: (r: DistrictSalesRollup & { rank: number }) => r.rank },
          { header: t("dashboard.name"), value: (r: DistrictSalesRollup) => r.districtName },
          { header: t("dashboard.orders"), value: (r: DistrictSalesRollup) => r.orderCount },
          { header: t("dashboard.sales"), value: (r: DistrictSalesRollup) => r.totalAmount },
        ]}
        rows={rankedDistricts}
        filename="district-ranking"
      />
      <div className="mb-5">
        <DataTable
          columns={districtColumns}
          rows={rankedDistricts}
          rowKey={(row) => row.districtId}
          caption={t("governmentDashboard.districtRanking")}
          emptyMessage={districtsLoading ? t("common.loading") : t("dashboard.noData")}
        />
      </div>

      <h2 className="mb-3 text-lg font-semibold text-neutral-900">
        {t("governmentDashboard.productPerformance")}
      </h2>
      <ExportButtons
        title={t("governmentDashboard.productPerformance")}
        columns={[
          { header: "#", value: (r: ProductRollup & { rank: number }) => r.rank },
          { header: t("dashboard.name"), value: (r: ProductRollup) => r.name },
          { header: "SHG", value: (r: ProductRollup) => r.shgName },
          { header: t("dashboard.sales"), value: (r: ProductRollup) => r.unitsSold },
          { header: t("dashboard.totalSales"), value: (r: ProductRollup) => r.totalRevenue },
        ]}
        rows={rankedProducts}
        filename="product-performance"
      />
      <DataTable
        columns={productColumns}
        rows={rankedProducts}
        rowKey={(row) => row.id}
        caption={t("governmentDashboard.productPerformance")}
        emptyMessage={t("dashboard.noData")}
      />
    </div>
  );
}
