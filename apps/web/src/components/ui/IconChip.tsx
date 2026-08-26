import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

/**
 * Small square chip behind a nav icon — white box + black icon by default,
 * inverted to a black box + white icon when `active` (the icon inside
 * inherits its color from this box via `currentColor`). Used for every icon
 * in the top and bottom divider bars (DashboardNav, DashboardProfileMenu,
 * GovtLinksMenu, TranslateMenu, PageAssistantTrigger) so exactly one control
 * in a group reads as "selected" — resetting a previously active one back
 * to the default look is automatic, since it's just a prop flipping back to
 * false, not separate state to clear by hand.
 */
export function IconChip({
  active,
  children,
  className,
}: {
  active: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex h-6 w-6 items-center justify-center rounded-md border transition-colors",
        active ? "border-black bg-black text-white" : "border-neutral-300 bg-white text-black",
        className,
      )}
    >
      {children}
    </span>
  );
}
