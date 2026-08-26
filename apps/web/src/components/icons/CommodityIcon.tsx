/**
 * A simplified ingot/gold-bar silhouette (a beveled top face over a
 * rectangular body) — stands in for "Items" tabs across the dashboards
 * (SHG's raw materials, Consumer's items) wherever the outer shell mirrors
 * the iframe's own tab strip as an icon instead of text (see
 * DashboardNav.tsx). Drawn from scratch to evoke the reference gold-bar
 * artwork's shape, not traced from it.
 *
 * Plain single-tone silhouette (`currentColor`) — contrast comes from the
 * white/black IconChip box it's rendered inside, not from the icon itself.
 */
export function CommodityIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true">
      <path d="M7 5H13L16 8V15H4V8Z" fill="currentColor" />
    </svg>
  );
}
