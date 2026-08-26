import { cn } from "../../lib/cn";

// Black-outlined by default; solid black on hover/active — the standing
// convention for every icon in the nav (see AppShell/PageAssistantTrigger),
// not just this one. Requires a `group` class on the clickable ancestor.
const HOVER_FILL_CLASSES = "fill-none group-hover:fill-current group-active:fill-current";

export function CloseIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={cn(className, HOVER_FILL_CLASSES)} aria-hidden="true">
      <path
        d="M5 5l10 10M15 5 5 15"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
