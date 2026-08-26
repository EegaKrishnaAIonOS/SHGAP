import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { ProfileIcon } from "./icons/ProfileIcon";
import { Tooltip } from "./ui/Tooltip";
import type { DashboardTabInfo } from "./DashboardNav";

/** One role avatar and its dropdown items — read straight off the iframe's
 * own markup (see interface/console/dashboard-{district,state,aionos}.html's
 * `.shg-role-avatar` elements and LandingPage.tsx's readDashboardRoleNav),
 * same "don't duplicate a role map here too" approach DashboardNav already
 * takes with its own flat tabs. */
export interface DashboardRoleGroup {
  role: string;
  label: string;
  color: string;
  items: DashboardTabInfo[];
}

function RoleAvatar({
  group,
  isOpen,
  onToggle,
  onItemClick,
}: {
  group: DashboardRoleGroup;
  isOpen: boolean;
  onToggle: () => void;
  onItemClick: (dataTab: string) => void;
}) {
  // Stays inverted after picking an item, not just while the dropdown is
  // open — group.items' own `active` flags come straight off the iframe's
  // DOM (see LandingPage.tsx's readDashboardRoleNav), so this reflects
  // whichever role's panel is actually showing, independent of isOpen.
  const isSelected = isOpen || group.items.some((item) => item.active);
  return (
    <div className="relative flex items-center">
      <Tooltip label={group.label.toLowerCase()}>
        <button
          type="button"
          onClick={onToggle}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          aria-label={group.label}
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-md border transition-colors",
            isSelected ? "border-black" : "border-neutral-300",
          )}
          style={{
            backgroundColor: isSelected ? "black" : group.color,
            color: isSelected ? group.color : "black",
          }}
        >
          <ProfileIcon className="h-4 w-4" />
        </button>
      </Tooltip>

      {isOpen && (
        <div
          role="menu"
          aria-label={group.label}
          className="absolute left-1/2 top-full z-20 mt-1 min-w-[160px] -translate-x-1/2 rounded-md border border-neutral-200 bg-white py-1 shadow-lg"
        >
          {group.items.map((item) => (
            <button
              key={item.dataTab}
              type="button"
              role="menuitem"
              title={item.disabledReason || undefined}
              onClick={() => onItemClick(item.dataTab)}
              className={cn(
                "block w-full px-3 py-2 text-center text-sm font-medium",
                item.disabled
                  ? cn("text-neutral-300", item.disabledReason && "cursor-not-allowed")
                  : item.active
                    ? "bg-neutral-100 text-brand-600"
                    : "text-neutral-800 hover:bg-neutral-100",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Center-aligned row of colored role avatars — the top-nav equivalent of
 * DashboardNav's flat tab row, but for the supervisory dashboards
 * (district/state/aionos) that each oversee a slice of the roles beneath
 * them instead of owning their own single-role feature set. Each avatar
 * inverts background/icon color while its dropdown is open (mirrors
 * IconChip's own active-state inversion, just parameterized by the role's
 * own color instead of hardcoded black/white) and opens a small menu of
 * that role's own items — clicking one forwards to the iframe's matching
 * (currently empty, DB-backed later) panel exactly like DashboardNav's
 * tabs do. No DashboardProfileMenu here — these are authority-office
 * accounts (see inference/tools/database.py's func__init_credential),
 * not an individual member with their own profile page to link to.
 */
export function DashboardRoleNav({
  groups,
  onItemClick,
}: {
  groups: DashboardRoleGroup[];
  onItemClick: (dataTab: string) => void;
}) {
  const [openRole, setOpenRole] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openRole) return;

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpenRole(null);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenRole(null);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openRole]);

  function handleItemClick(dataTab: string) {
    onItemClick(dataTab);
    setOpenRole(null);
  }

  return (
    <div ref={containerRef} className="flex w-full items-center justify-center gap-4 px-3 sm:px-4">
      {groups.map((group) => (
        <RoleAvatar
          key={group.role}
          group={group}
          isOpen={openRole === group.role}
          onToggle={() => setOpenRole((current) => (current === group.role ? null : group.role))}
          onItemClick={handleItemClick}
        />
      ))}
    </div>
  );
}
