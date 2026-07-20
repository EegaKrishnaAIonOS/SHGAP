import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PageHeader } from "../../components/PageHeader";
import { Card } from "../../components/ui/Card";
import { cn } from "../../lib/cn";
import { CategoriesTab } from "./masterData/CategoriesTab";
import { DistrictsTab } from "./masterData/DistrictsTab";
import { FestivalCalendarTab } from "./masterData/FestivalCalendarTab";
import { MandalsTab } from "./masterData/MandalsTab";
import { UlbsTab } from "./masterData/UlbsTab";

type MasterDataTab = "districts" | "ulbs" | "mandals" | "categories" | "festivals";

/**
 * Tabbed CRUD for the five master-data entities (T09) — kept as one route
 * with in-page tabs rather than five separate routes, since each list is
 * small (a handful to a few dozen rows for this pilot) and switching
 * between them is a single click either way.
 */
export function AdminMasterDataPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<MasterDataTab>("districts");

  const tabs: { key: MasterDataTab; label: string }[] = [
    { key: "districts", label: t("admin.masterData.tabDistricts") },
    { key: "ulbs", label: t("admin.masterData.tabUlbs") },
    { key: "mandals", label: t("admin.masterData.tabMandals") },
    { key: "categories", label: t("admin.masterData.tabCategories") },
    { key: "festivals", label: t("admin.masterData.tabFestivals") },
  ];

  return (
    <div>
      <PageHeader title={t("admin.tabMasterData")} wireframe={false} />

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setTab(option.key)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-medium",
              tab === option.key
                ? "border-brand-400 bg-brand-50 text-brand-500"
                : "border-neutral-300 text-neutral-600 hover:bg-neutral-50",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <Card>
        {tab === "districts" && <DistrictsTab />}
        {tab === "ulbs" && <UlbsTab />}
        {tab === "mandals" && <MandalsTab />}
        {tab === "categories" && <CategoriesTab />}
        {tab === "festivals" && <FestivalCalendarTab />}
      </Card>
    </div>
  );
}
