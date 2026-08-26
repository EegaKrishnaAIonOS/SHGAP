import { useMemo, useState } from "react";
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
  getMarketPrices,
  getProducts,
  getRecommendationSummary,
  getShgs,
} from "../../lib/api/analytics";
import { getHealth } from "../../lib/api/health";
import type {
  BuyerActivityPoint,
  DistrictSalesRollup,
  MarketPriceRecord,
  ProductRollup,
} from "../../lib/api/types";

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
    "Couldn't load state overview data. Please try again.",
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

  const selectedDistrictName = (districts ?? []).find(
    (d) => d.districtId === districtId,
  )?.districtName;

  const { data: marketPrices, loading: marketPricesLoading } = useAsyncData(
    () => getMarketPrices({ district: selectedDistrictName, limit: 20 }),
    [selectedDistrictName],
  );

  const visibleDistricts = districtId
    ? (districts ?? []).filter((d) => d.districtId === districtId)
    : (districts ?? []);
  const totalSales = visibleDistricts.reduce((sum, d) => sum + d.totalAmount, 0);
  const totalOrders = visibleDistricts.reduce((sum, d) => sum + d.orderCount, 0);

  const districtColumns: Column<DistrictSalesRollup & { rank: number }>[] = [
    { key: "rank", header: "#", render: (row) => row.rank },
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
  // Districts already arrive sorted by total_amount DESC from the backend
  // (analytics.service.ts), so the rank is just the row's position.
  const rankedDistricts = visibleDistricts.map((d, i) => ({ ...d, rank: i + 1 }));

  const productColumns: Column<ProductRollup & { rank: number }>[] = [
    { key: "rank", header: "#", render: (row) => row.rank },
    { key: "name", header: "Name", render: (row) => row.name },
    { key: "shg", header: "SHG", render: (row) => row.shgName },
    {
      key: "unitsSold",
      header: "Sales",
      render: (row) => row.unitsSold.toLocaleString(),
    },
    {
      key: "revenue",
      header: "Total sales",
      render: (row) => `₹${row.totalRevenue.toLocaleString()}`,
    },
  ];
  const rankedProducts = (products?.items ?? []).map((p, i) => ({ ...p, rank: i + 1 }));

  const marketPriceColumns: Column<MarketPriceRecord>[] = [
    { key: "district", header: "District", render: (row) => row.district },
    {
      key: "commodity",
      header: "Commodity",
      render: (row) => row.commodity,
    },
    { key: "date", header: "Date", render: (row) => row.arrivalDate },
    {
      key: "modalPrice",
      header: "Modal price",
      render: (row) => `₹${row.modalPrice.toLocaleString()}`,
    },
    {
      key: "range",
      header: "Price range",
      render: (row) => `₹${row.minPrice.toLocaleString()} – ₹${row.maxPrice.toLocaleString()}`,
    },
  ];

  const topBuyers = [...(geoActivity?.buyerPoints ?? [])]
    .sort((a, b) => b.recommendationsReceived - a.recommendationsReceived)
    .slice(0, 5);

  const recommendationBreakdown = recommendations
    ? [
        { status: "Pending", value: recommendations.pending },
        { status: "Accepted", value: recommendations.accepted },
        { status: "Rejected", value: recommendations.rejected },
        { status: "Expired", value: recommendations.expired },
      ]
    : [];

  return (
    <div>
      <PageHeader
        title="Government Dashboard"
        subtitle="State-level (MEPMA HQ) view across all districts — Module 7 policy & monitoring dashboard."
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

      <h2 className="mb-3 text-lg font-semibold text-neutral-900">Platform KPIs</h2>
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Registered SHGs" value={shgs?.total ?? 0} />
        <StatCard label="Products listed" value={products?.total ?? 0} />
        <StatCard label="Enquiries generated" value={enquiries?.total ?? 0} />
        <StatCard
          label="API uptime"
          value={health ? formatUptime(health.uptimeSeconds) : "—"}
          delta="Since last deploy — no SLA monitoring yet"
        />
        <StatCard
          label="SHG/buyer satisfaction"
          value="—"
          delta="Not tracked yet — no survey data exists"
        />
      </div>

      <h2 className="mb-3 text-lg font-semibold text-neutral-900">State overview</h2>
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Total sales" value={`₹${(totalSales / 10000000).toFixed(2)} Cr`} />
        <StatCard label="Total orders" value={totalOrders.toLocaleString()} />
        <StatCard label="Districts covered" value={visibleDistricts.length} />
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <SimpleBarChart
          title="District comparison"
          data={visibleDistricts.map((d) => ({ district: d.districtName, sales: d.totalAmount }))}
          xKey="district"
          series={[{ key: "sales", label: "Sales" }]}
        />
        <SimpleBarChart
          title="Product performance"
          data={rankedProducts.map((p) => ({ name: p.name, revenue: p.totalRevenue }))}
          xKey="name"
          series={[{ key: "revenue", label: "Total sales" }]}
        />
      </div>

      <h2 className="mb-3 text-lg font-semibold text-neutral-900">Market linkage</h2>
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="SHGs linked to a buyer" value={recommendations?.shgsLinked ?? 0} />
        <StatCard label="Buyers linked to an SHG" value={recommendations?.buyersLinked ?? 0} />
        <StatCard
          label="Acceptance rate"
          value={
            recommendations?.acceptanceRate == null
              ? "—"
              : `${(recommendations.acceptanceRate * 100).toFixed(0)}%`
          }
        />
        <StatCard
          label="Avg. match score"
          value={
            recommendations?.avgMatchScore == null
              ? "—"
              : `${(recommendations.avgMatchScore * 100).toFixed(0)}%`
          }
        />
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <SimplePieChart
          title="Recommendation outcomes"
          data={recommendationBreakdown}
          nameKey="status"
          valueKey="value"
        />
        <Card>
          <CardTitle className="mb-3">Top buyers by activity</CardTitle>
          <ul className="divide-y divide-neutral-100 text-sm">
            {topBuyers.length === 0 && (
              <li className="py-3 text-neutral-400">No data for the selected filters yet.</li>
            )}
            {topBuyers.map((b: BuyerActivityPoint) => (
              <li key={b.id} className="flex items-center justify-between py-2">
                <span className="font-medium text-neutral-800">{b.name}</span>
                <span className="text-neutral-500">
                  {b.recommendationsReceived} recommendations
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle className="mb-3">SHG sales activity</CardTitle>
          <ActivityMap
            color="#aa3bff"
            points={(geoActivity?.shgPoints ?? []).map((p) => ({
              id: p.id,
              lat: p.lat,
              lng: p.lng,
              label: `${p.name} (${p.districtName})`,
              value: p.totalSalesAmount,
              valueLabel: `₹${p.totalSalesAmount.toLocaleString()} sales`,
            }))}
          />
        </Card>
        <Card>
          <CardTitle className="mb-3">Buyer recommendation activity</CardTitle>
          <ActivityMap
            color="#0ea5e9"
            points={(geoActivity?.buyerPoints ?? []).map((p) => ({
              id: p.id,
              lat: p.lat,
              lng: p.lng,
              label: `${p.name} (${p.type})`,
              value: p.recommendationsReceived,
              valueLabel: `${p.recommendationsReceived} recommendations`,
            }))}
          />
        </Card>
      </div>

      <h2 className="mb-3 text-lg font-semibold text-neutral-900">District ranking</h2>
      <ExportButtons
        title="District ranking"
        columns={[
          { header: "#", value: (r: DistrictSalesRollup & { rank: number }) => r.rank },
          { header: "Name", value: (r: DistrictSalesRollup) => r.districtName },
          { header: "Orders", value: (r: DistrictSalesRollup) => r.orderCount },
          { header: "Sales", value: (r: DistrictSalesRollup) => r.totalAmount },
        ]}
        rows={rankedDistricts}
        filename="district-ranking"
      />
      <div className="mb-5">
        <DataTable
          columns={districtColumns}
          rows={rankedDistricts}
          rowKey={(row) => row.districtId}
          caption="District ranking"
          emptyMessage={districtsLoading ? "Loading..." : "No data for the selected filters yet."}
        />
      </div>

      <h2 className="mb-3 text-lg font-semibold text-neutral-900">Product performance</h2>
      <ExportButtons
        title="Product performance"
        columns={[
          { header: "#", value: (r: ProductRollup & { rank: number }) => r.rank },
          { header: "Name", value: (r: ProductRollup) => r.name },
          { header: "SHG", value: (r: ProductRollup) => r.shgName },
          { header: "Sales", value: (r: ProductRollup) => r.unitsSold },
          { header: "Total sales", value: (r: ProductRollup) => r.totalRevenue },
        ]}
        rows={rankedProducts}
        filename="product-performance"
      />
      <DataTable
        columns={productColumns}
        rows={rankedProducts}
        rowKey={(row) => row.id}
        caption="Product performance"
        emptyMessage="No data for the selected filters yet."
      />

      <h2 className="mb-3 mt-5 text-lg font-semibold text-neutral-900">
        Market prices (Agmarknet)
      </h2>
      <p className="mb-3 text-sm text-neutral-500">
        Real government mandi prices, ingested since Sprint 3 — shown here for the first time.
      </p>
      <DataTable
        columns={marketPriceColumns}
        rows={marketPrices ?? []}
        rowKey={(row) => `${row.market}-${row.commodity}-${row.arrivalDate}`}
        caption="Market prices (Agmarknet)"
        emptyMessage={marketPricesLoading ? "Loading..." : "No Agmarknet price data ingested yet."}
      />
    </div>
  );
}
