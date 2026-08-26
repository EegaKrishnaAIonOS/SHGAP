/**
 * Solid single-tone silhouette (`currentColor`) — contrast comes from the
 * white/black IconChip box it's rendered inside (see PageAssistantTrigger),
 * not from a separate outline/hover-fill toggle of its own.
 */
export function PointerIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3Z" fill="currentColor" />
    </svg>
  );
}
