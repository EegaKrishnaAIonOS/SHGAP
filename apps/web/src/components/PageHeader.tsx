import type { ReactNode } from "react";
import { WireframeBanner } from "./WireframeBanner";

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

/** Shared title/subtitle block + wireframe banner for dashboard/admin pages. */
export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="mb-5">
      <WireframeBanner />
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
