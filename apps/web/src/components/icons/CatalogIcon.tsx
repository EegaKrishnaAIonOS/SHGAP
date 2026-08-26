/**
 * A simplified coin silhouette (outer rim + inner face, punched as a hole
 * via `fillRule="evenodd"` rather than a hardcoded inner-ring color) —
 * stands in for "Catalog" tabs across the dashboards wherever the outer
 * shell mirrors the iframe's own tab strip as an icon instead of text (see
 * DashboardNav.tsx). Drawn from scratch to evoke the reference gold-coin
 * artwork's shape, not traced from it.
 *
 * Plain single-tone silhouette (`currentColor`) — contrast comes from the
 * white/black IconChip box it's rendered inside, not from the icon itself;
 * the evenodd hole shows through to whatever that box's background is.
 */
export function CatalogIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M10 17a7 7 0 1 0 0-14a7 7 0 1 0 0 14ZM10 13.5a3.5 3.5 0 1 0 0-7a3.5 3.5 0 1 0 0 7Z"
        fill="currentColor"
      />
    </svg>
  );
}
