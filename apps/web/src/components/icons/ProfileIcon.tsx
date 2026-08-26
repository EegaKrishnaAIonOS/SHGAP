import { useId } from "react";

/**
 * A plain black & white person-in-a-circle silhouette for
 * DashboardProfileMenu's trigger — deliberately not the header's own
 * teal-and-white guest-avatar.svg (a CSS `grayscale` filter over that
 * colored asset didn't render as a true black & white icon), so this one
 * is drawn directly in monochrome instead.
 */
export function ProfileIcon({ className = "h-6 w-6" }: { className?: string }) {
  const clipId = useId();
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          <circle cx="10" cy="10" r="9" />
        </clipPath>
      </defs>
      <circle cx="10" cy="10" r="9" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <g clipPath={`url(#${clipId})`} fill="currentColor">
        <circle cx="10" cy="8" r="3.4" />
        <path d="M10 12c-4.4 0-8 2.4-8 5.6V20h16v-2.4c0-3.2-3.6-5.6-8-5.6Z" />
      </g>
    </svg>
  );
}
