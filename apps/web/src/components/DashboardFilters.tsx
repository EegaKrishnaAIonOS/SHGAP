import { useTranslation } from "react-i18next";
import { Select } from "./ui/Input";
import { Card } from "./ui/Card";

export const DATE_RANGE_VALUES = ["30d", "90d", "12m"] as const;
export type DateRangeValue = (typeof DATE_RANGE_VALUES)[number];

export interface DashboardExtraFilter {
  key: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export interface DashboardFiltersProps {
  dateRange: DateRangeValue;
  onDateRangeChange: (value: DateRangeValue) => void;
  /** Extra filter selects rendered after the common date-range filter — each
   * one fully controlled by the caller (T19: real district/ULB/category
   * drill-down, not just a layout placeholder). */
  extra?: DashboardExtraFilter[];
}

/** Converts a `DateRangeValue` into the `dateFrom` a caller passes to the
 * T18 analytics endpoints — `dateTo` is left undefined (today, implicitly). */
export function dateRangeToDateFrom(range: DateRangeValue): Date {
  const days = range === "30d" ? 30 : range === "90d" ? 90 : 365;
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

/** Shared, now-functional filter bar for the officials' dashboards (T19) —
 * every select here is controlled and drives a real refetch in the page
 * that renders it. */
export function DashboardFilters({
  dateRange,
  onDateRangeChange,
  extra = [],
}: DashboardFiltersProps) {
  const { t } = useTranslation();

  const dateRangeOptions = [
    { value: "30d", label: t("dashboard.last30Days") },
    { value: "90d", label: t("dashboard.last90Days") },
    { value: "12m", label: t("dashboard.last12Months") },
  ];

  return (
    <Card className="mb-5">
      <div className="flex flex-wrap items-end gap-4">
        <span className="text-sm font-semibold text-neutral-500">{t("dashboard.filters")}</span>
        <div className="w-48">
          <Select
            label={t("dashboard.dateRange")}
            options={dateRangeOptions}
            value={dateRange}
            onChange={(e) => onDateRangeChange(e.target.value as DateRangeValue)}
          />
        </div>
        {extra.map((filter) => (
          <div key={filter.key} className="w-48">
            <Select
              label={filter.label}
              options={filter.options}
              placeholder={filter.placeholder ?? filter.label}
              value={filter.value}
              onChange={(e) => filter.onChange(e.target.value)}
            />
          </div>
        ))}
      </div>
    </Card>
  );
}
