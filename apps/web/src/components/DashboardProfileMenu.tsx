import { useEffect, useRef, useState } from "react";
import { IconChip } from "./ui/IconChip";
import { Tooltip } from "./ui/Tooltip";
import { ProfileIcon } from "./icons/ProfileIcon";
import type { UserProfile } from "../lib/api/types";
import type { GuidanceSession } from "../lib/auth/guidanceSessionStore";

// Mirrors AppShell.tsx's own ROLE_LABELS — kept in sync manually since this
// menu renders inside DashboardNav (LandingPage.tsx's topBar), a separate
// tree from the header greeting that first introduced this mapping.
const ROLE_LABELS: Record<string, string> = {
  SHG: "SHG member",
  DISTRIBUTOR: "Retailer",
  CONSUMER: "Consumer",
};

/**
 * Right-end icon in DashboardNav's bar — the header's own avatar (top-right,
 * see AppShell.tsx) already handles login/logout; this one is read-only, a
 * quick-glance summary of who's currently signed in. Plain black & white
 * (ProfileIcon), not the header's teal-and-white guest-avatar.svg, so it
 * doesn't read as a second login/logout control.
 *
 * The guidance-api credential flow's own details (see guidanceSessionStore)
 * don't render here at all — clicking forwards to the current dashboard's
 * own hidden "profile" tab (see onOpenProfilePage/LandingPage.tsx), which
 * switches to a plain panel in the same style as the registration form
 * (interface/script.js's setupProfilePanel), exactly like Catalog/Items do,
 * not a React overlay. The small dropdown below is only for the real
 * core-api profile.
 */
export function DashboardProfileMenu({
  profile,
  guidanceSession,
  isProfileActive,
  onOpenProfilePage,
}: {
  profile: UserProfile | null;
  guidanceSession: GuidanceSession | null;
  isProfileActive: boolean;
  onOpenProfilePage: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const role = profile?.userRoles?.[0]?.role?.name;
  const roleLabel = role ? (ROLE_LABELS[role] ?? role) : null;

  return (
    <div ref={containerRef} className="relative flex items-center">
      <Tooltip label="profile information">
        <button
          type="button"
          onClick={() => (guidanceSession ? onOpenProfilePage() : setIsOpen((open) => !open))}
          aria-haspopup={guidanceSession ? undefined : "menu"}
          aria-expanded={guidanceSession ? undefined : isOpen}
          aria-label="Profile information"
          className="flex items-center justify-center"
        >
          <IconChip active={guidanceSession ? isProfileActive : isOpen}>
            <ProfileIcon className="h-4 w-4" />
          </IconChip>
        </button>
      </Tooltip>

      {isOpen && !guidanceSession && (
        <div
          role="menu"
          aria-label="Profile information"
          className="absolute right-0 top-full z-20 mt-1 min-w-[220px] rounded-md border border-neutral-200 bg-white p-3 text-left shadow-lg"
        >
          <p className="text-sm font-semibold text-neutral-900">{profile?.name || "Guest"}</p>
          {roleLabel && <p className="text-xs text-neutral-500">{roleLabel}</p>}
          {(profile?.email || profile?.phone) && (
            <div className="mt-2 space-y-0.5 border-t border-neutral-100 pt-2">
              {profile?.email && <p className="text-xs text-neutral-600">{profile.email}</p>}
              {profile?.phone && <p className="text-xs text-neutral-600">{profile.phone}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
