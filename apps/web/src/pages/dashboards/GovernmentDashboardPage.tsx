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
  getGeoActivity,
  getRecommendationSummary,
} from "../../lib/api/analytics";
import type { DistrictSalesRollup } from "../../lib/api/types";

/**
 * Module-7 government dashboard: state (MEPMA HQ) level roll-up across all
 * districts, plus a real geo-activity map (ADR-0028) — discrete, value-scaled
 * markers over the platform's actual geo-tagged SHGs/buyers rather than a
 * smoothed heat-density layer, since the pilot only has a handful of real
 * geo-tagged points today.
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

  const { data: geoActivity } = useAsyncData(
    () => getGeoActivity({ dateFrom, districtId: districtId || undefined }),
    [dateFrom, districtId],
  );

  const visibleDistricts = districtId
    ? (districts ?? []).filter((d) => d.districtId === districtId)
    : (districts ?? []);
  const totalSales = visibleDistricts.reduce((sum, d) => sum + d.totalAmount, 0);
  const totalOrders = visibleDistricts.reduce((sum, d) => sum + d.orderCount, 0);

  const columns: Column<DistrictSalesRollup>[] = [
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
        {t("governmentDashboard.stateOverview")}
      </h2>
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label={t("dashboard.totalSales")}
          value={`₹${(totalSales / 10000000).toFixed(2)} Cr`}
        />
        <StatCard label={t("dashboard.totalOrders")} value={totalOrders.toLocaleString()} />
        <StatCard label={t("districtDashboard.title")} value={visibleDistricts.length} />
        <StatCard
          label={t("dashboard.acceptanceRate")}
          value={
            recommendations?.acceptanceRate == null
              ? "—"
              : `${(recommendations.acceptanceRate * 100).toFixed(0)}%`
          }
        />
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <SimpleBarChart
          title={t("governmentDashboard.districtComparison")}
          data={visibleDistricts.map((d) => ({ district: d.districtName, sales: d.totalAmount }))}
          xKey="district"
          series={[{ key: "sales", label: t("dashboard.sales") }]}
        />
        <SimplePieChart
          title={t("governmentDashboard.recommendationSummary")}
          data={recommendationBreakdown}
          nameKey="status"
          valueKey="value"
        />
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

      <ExportButtons
        title={t("dashboard.districtBreakdown")}
        columns={[
          { header: t("dashboard.name"), value: (r: DistrictSalesRollup) => r.districtName },
          { header: t("dashboard.orders"), value: (r: DistrictSalesRollup) => r.orderCount },
          { header: t("dashboard.sales"), value: (r: DistrictSalesRollup) => r.totalAmount },
        ]}
        rows={visibleDistricts}
        filename="district-breakdown"
      />
      <DataTable
        columns={columns}
        rows={visibleDistricts}
        rowKey={(row) => row.districtId}
        caption={t("dashboard.districtBreakdown")}
        emptyMessage={districtsLoading ? t("common.loading") : t("dashboard.noData")}
      />
    </div>
  );
}
