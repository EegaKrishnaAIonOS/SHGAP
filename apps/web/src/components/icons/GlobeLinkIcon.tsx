/**
 * Plain outline globe (circle + meridian/equator lines) — no hover/active
 * fill of its own; contrast comes entirely from the white/black IconChip
 * box it's rendered inside (see GovtLinksMenu.tsx). The circle is
 * deliberately never filled solid: a solid fill would swallow the
 * meridian/equator lines whenever they ended up the same color as that
 * fill (e.g. while the box was already active and the icon was also
 * hovered/clicked) — staying an outline at all times keeps the lines
 * visible regardless of state.
 */
export function GlobeLinkIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M3.5 12h17M12 3c2.3 2.4 3.6 5.6 3.6 9s-1.3 6.6-3.6 9c-2.3-2.4-3.6-5.6-3.6-9s1.3-6.6 3.6-9Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
