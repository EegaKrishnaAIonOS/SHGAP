import type { ReactNode } from "react";
import { WireframeBanner } from "./WireframeBanner";

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  /** Set false for screens that are actually data-connected (e.g. the T09 admin portal) — defaults to true since every page using this today is still a T04 wireframe. */
  wireframe?: boolean;
}

/** Shared title/subtitle block + wireframe banner for dashboard/admin pages. */
export function PageHeader({ title, subtitle, action, wireframe = true }: PageHeaderProps) {
  return (
    <div className="mb-5">
      {wireframe && <WireframeBanner />}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">{title}</h1>
          {subtitle && <p className="mt-1 max-w-2xl text-sm text-neutral-500">{subtitle}</p>}
        </div>
        {action}
      </div>
    </div>
  );
}
