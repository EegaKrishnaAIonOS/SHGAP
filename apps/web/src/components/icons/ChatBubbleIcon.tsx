/**
 * Solid single-tone silhouette (`currentColor`) — contrast comes from the
 * white/black IconChip box it's rendered inside (see PageAssistantTrigger),
 * not from a separate outline/hover-fill toggle of its own.
 */
export function ChatBubbleIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M4 12c0-4.42 3.58-8 8-8s8 3.58 8 8-3.58 8-8 8c-1.13 0-2.2-.23-3.17-.66L4 20l1.02-4.24A7.94 7.94 0 0 1 4 12Z"
        fill="currentColor"
      />
    </svg>
  );
}
