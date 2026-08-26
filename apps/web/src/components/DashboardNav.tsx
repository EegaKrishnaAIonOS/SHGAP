import type { ComponentType } from "react";
import { cn } from "../lib/cn";
import { DashboardProfileMenu } from "./DashboardProfileMenu";
import { IconChip } from "./ui/IconChip";
import { Tooltip } from "./ui/Tooltip";
import { CatalogIcon } from "./icons/CatalogIcon";
import { CommodityIcon } from "./icons/CommodityIcon";
import type { UserProfile } from "../lib/api/types";
import type { GuidanceSession } from "../lib/auth/guidanceSessionStore";

export interface DashboardTabInfo {
  dataTab: string;
  label: string;
  active: boolean;
  disabled: boolean;
  /** Why a disabled tab is disabled (from its title attribute in
   * interface/console/*.html) — shown in the tooltip instead of a single
   * generic message, since different disabled tabs now say different
   * things (e.g. "Deprecated — moving to chatbot" vs. "Coming Soon"). */
  disabledReason?: string;
}

type TabIcon = ComponentType<{ className?: string }>;
type TabIconInfo = { Icon: TabIcon; displayLabel: string };

// Matched by the tab's plain-text label (lowercased), not its data-tab
// attribute — SHG's "Items" tab is data-tab="raw-materials" while
// Consumer's own "Items" tab is data-tab="items", but both mean the same
// thing to a reader here and get the same icon + display name. "Items"
// itself is never shown any more — every surface (tooltip, aria-label)
// uses "Commodity" instead, matching the icon. This is SHG's mapping (the
// only dashboard with both tabs) — Retailer and Consumer each override it
// below with a single forced icon instead, swapped from what the label
// alone would otherwise pick.
const TAB_ICON_INFO: Record<string, TabIconInfo> = {
  items: { Icon: CommodityIcon, displayLabel: "Commodity" },
  catalog: { Icon: CatalogIcon, displayLabel: "Catalog" },
};

// Retailer's one tab is labeled "Catalog" and Consumer's is labeled
// "Items" — which would normally map to CatalogIcon/CommodityIcon
// respectively via TAB_ICON_INFO above, but the two are deliberately
// swapped instead: Retailer shows the Commodity icon, Consumer shows the
// Catalog icon.
const DASHBOARD_ICON_OVERRIDE: Record<string, TabIconInfo> = {
  DISTRIBUTOR: { Icon: CommodityIcon, displayLabel: "Commodity" },
  CONSUMER: { Icon: CatalogIcon, displayLabel: "Catalog" },
};

/**
 * Mirrors the current dashboard's own tab strip in the persistent outer
 * shell, in place of GovtLinksMenu, whenever the iframe is showing a
 * dashboard page (see LandingPage.tsx, which reads the tabs straight off
 * the iframe's DOM, already in the display order this renders them in).
 * The iframe's own tab buttons are still what actually switches panels —
 * see interface/console/*.html and interface/styles.css's `.shg-tabs` —
 * these buttons just forward a click to them and re-read the result, so
 * there's exactly one place that owns what "active" means.
 *
 * Left-aligned with the same px-3/sm:px-4 inset as the header's own logo
 * (see AppShell.tsx) rather than centered, with DashboardProfileMenu
 * pinned to the right end of the same bar.
 */
export function DashboardNav({
  tabs,
  onTabClick,
  profile,
  guidanceSession,
  isProfileActive,
  onOpenProfilePage,
  dashboardKind,
}: {
  tabs: DashboardTabInfo[];
  onTabClick: (dataTab: string) => void;
  profile: UserProfile | null;
  guidanceSession: GuidanceSession | null;
  isProfileActive: boolean;
  onOpenProfilePage: () => void;
  dashboardKind: "SHG" | "DISTRIBUTOR" | "CONSUMER" | null;
}) {
  // Hidden from display only — everything else about these tabs (the
  // disabled/deprecated styling above, interface/console/*.html's own
  // buttons and panels, script.js's toast) is untouched, so restoring them
  // later is just deleting this filter. "profile" isn't a tab a member
  // picks from this bar at all — it only exists so DashboardProfileMenu's
  // own icon (below) can forward a click to it (see onOpenProfilePage).
  const visibleTabs = tabs.filter(
    (tab) =>
      tab.dataTab !== "contributions" && tab.dataTab !== "insights" && tab.dataTab !== "profile",
  );

  function renderTab(tab: DashboardTabInfo) {
    const iconInfo =
      (dashboardKind && DASHBOARD_ICON_OVERRIDE[dashboardKind]) ??
      TAB_ICON_INFO[tab.label.trim().toLowerCase()];
    const displayLabel = iconInfo?.displayLabel ?? tab.label;
    const Icon = iconInfo?.Icon;
    // Struck through on top of the shared disabled styling — visually
    // distinguishes "deprecated, going away" (Insights) from merely "not
    // built yet" (Open Contributions), which stays plain grayed.
    const isDeprecated = tab.dataTab === "insights";
    return (
      <Tooltip
        key={tab.dataTab}
        label={(tab.disabled ? (tab.disabledReason ?? "Coming Soon") : displayLabel).toLowerCase()}
      >
        <button
          type="button"
          onClick={() => onTabClick(tab.dataTab)}
          disabled={tab.disabled}
          aria-current={tab.active}
          aria-label={Icon ? displayLabel : undefined}
          className={cn(
            "group flex items-center gap-1.5 text-xs font-semibold",
            tab.disabled && "cursor-not-allowed",
            !Icon &&
              (tab.disabled
                ? cn("text-neutral-300", isDeprecated && "line-through")
                : tab.active
                  ? "text-brand-600"
                  : "text-neutral-600 hover:text-brand-600"),
          )}
        >
          {Icon ? (
            <IconChip active={tab.active}>
              <Icon className="h-4 w-4" />
            </IconChip>
          ) : (
            displayLabel
          )}
        </button>
      </Tooltip>
    );
  }

  return (
    <div className="flex w-full items-center justify-between px-3 sm:px-4">
      <nav aria-label="Dashboard sections" className="flex items-center gap-5">
        {visibleTabs.map(renderTab)}
      </nav>
      <DashboardProfileMenu
        profile={profile}
        guidanceSession={guidanceSession}
        isProfileActive={isProfileActive}
        onOpenProfilePage={onOpenProfilePage}
      />
    </div>
  );
}
