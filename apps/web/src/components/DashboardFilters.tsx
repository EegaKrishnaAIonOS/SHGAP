import { useTranslation } from "react-i18next";
import { Select } from "./ui/Input";
import { Card } from "./ui/Card";

export interface DashboardFiltersProps {
  /** Extra filter selects rendered after the common date-range filter. */
  extra?: { label: string; options: { value: string; label: string }[] }[];
}

const DATE_RANGE_OPTIONS = [
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last quarter" },
  { value: "12m", label: "Last 12 months" },
];

/**
 * Shared filter bar for the dashboard wireframes. Non-functional (no data
 * refetch wired up yet) — it exists to establish the layout slot every
 * dashboard will use once real filtering lands in T06+.
 */
export function DashboardFilters({ extra = [] }: DashboardFiltersProps) {
  const { t } = useTranslation();

  return (
    <Card className="mb-5">
      <div className="flex flex-wrap items-end gap-4">
        <span className="text-sm font-semibold text-neutral-500">{t("dashboard.filters")}</span>
        <div className="w-48">
          <Select
            label={t("dashboard.dateRange")}
            options={DATE_RANGE_OPTIONS}
            defaultValue="30d"
          />
        </div>
        {extra.map((filter) => (
          <div key={filter.label} className="w-48">
            <Select label={filter.label} options={filter.options} placeholder={filter.label} />
          </div>
        ))}
      </div>
    </Card>
  );
}
