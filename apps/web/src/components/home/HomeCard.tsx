import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, Globe, Lock, Monitor, Shield, Smartphone } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/cn";

/** Fixed vocabulary of card badges — each maps to one micro-icon + one i18n
 * label, defined once here rather than as free-form strings, so every card
 * on the page uses the same icon for the same meaning. */
export type BadgeKey =
  | "mobileFirst"
  | "desktopFirst"
  | "publicAccess"
  | "loginRequired"
  | "officerLogin";

const BADGE_CONFIG: Record<BadgeKey, { icon: LucideIcon; labelKey: string }> = {
  mobileFirst: { icon: Smartphone, labelKey: "home.badgeMobileFirst" },
  desktopFirst: { icon: Monitor, labelKey: "home.badgeDesktopFirst" },
  publicAccess: { icon: Globe, labelKey: "home.badgePublicAccess" },
  loginRequired: { icon: Lock, labelKey: "home.badgeLoginRequired" },
  officerLogin: { icon: Shield, labelKey: "home.badgeOfficerLogin" },
};

export interface HomeCardProps {
  to: string;
  icon: LucideIcon;
  title: string;
  description: string;
  badges: BadgeKey[];
  /** Tints the top accent border and icon badge — "shg" (emerald,
   * mobile-first screens) vs "official" (navy, desktop-first dashboards). */
  accent: "shg" | "official";
}

const ACCENT_CLASSES: Record<
  HomeCardProps["accent"],
  { topBorder: string; icon: string; arrowHover: string }
> = {
  shg: {
    topBorder: "border-t-4 border-t-emerald-600",
    icon: "bg-emerald-50 text-emerald-700",
    arrowHover: "group-hover:text-emerald-600",
  },
  official: {
    topBorder: "border-t-4 border-t-indigo-900",
    icon: "bg-indigo-50 text-indigo-800",
    arrowHover: "group-hover:text-indigo-900",
  },
};

/** Icon-badge card used for both the SHG member grid and the official
 * dashboard grid on the landing page — differs only by `accent` colour and
 * the badge keys passed in. */
export function HomeCard({ to, icon: Icon, title, description, badges, accent }: HomeCardProps) {
  const { t } = useTranslation();
  const { topBorder, icon, arrowHover } = ACCENT_CLASSES[accent];

  return (
    <Link
      to={to}
      className={cn(
        // Border sides are split deliberately: border-x/border-b carry the
        // plain 1px slate outline, border-t is a separate 4px accent colour
        // — combining them via one shorthand (e.g. `border border-t-4
        // border-slate-200 border-t-emerald-600`) is order-dependent on
        // Tailwind's generated CSS, not on this className string's order,
        // and silently drops one colour depending on build order.
        "group relative flex h-full flex-col rounded-2xl border-x border-b border-x-slate-200/80 border-b-slate-200/80 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl",
        topBorder,
      )}
    >
      <ArrowUpRight
        size={18}
        strokeWidth={2.25}
        aria-hidden="true"
        className={cn(
          "absolute right-4 top-4 text-slate-300 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5",
          arrowHover,
        )}
      />
      <span
        className={cn("mb-3 flex h-11 w-11 items-center justify-center rounded-full", icon)}
        aria-hidden="true"
      >
        <Icon size={22} strokeWidth={2} />
      </span>
      <h3 className="pr-6 text-lg font-semibold text-slate-800">{title}</h3>
      <p className="mt-1.5 flex-1 text-sm leading-relaxed text-slate-600">{description}</p>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {badges.map((key) => {
          const { icon: BadgeIcon, labelKey } = BADGE_CONFIG[key];
          return (
            <span
              key={key}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200/60 bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700"
            >
              <BadgeIcon size={11} strokeWidth={2.25} aria-hidden="true" />
              {t(labelKey)}
            </span>
          );
        })}
      </div>
    </Link>
  );
}