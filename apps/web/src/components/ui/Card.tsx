import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
}

export function Card({ padded = true, className, children, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-neutral-200 bg-white shadow-card",
        padded && "p-4 sm:p-5",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mb-3 flex items-start justify-between gap-3", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn("text-lg font-semibold text-neutral-900", className)} {...rest}>
      {children}
    </h3>
  );
}

export function CardDescription({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-sm text-neutral-500", className)} {...rest}>
      {children}
    </p>
  );
}

export function CardContent({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn(className)} {...rest}>
      {children}
    </div>
  );
}

export function CardFooter({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "mt-4 flex items-center justify-end gap-2 border-t border-neutral-100 pt-3",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

/** Compact stat/KPI tile used across the officials' dashboards. */
export interface StatCardProps {
  label: string;
  value: ReactNode;
  delta?: string;
  deltaTone?: "positive" | "negative" | "neutral";
  icon?: ReactNode;
}

const deltaToneClasses: Record<NonNullable<StatCardProps["deltaTone"]>, string> = {
  positive: "text-success-500",
  negative: "text-danger-500",
  neutral: "text-neutral-500",
};

export function StatCard({ label, value, delta, deltaTone = "neutral", icon }: StatCardProps) {
  return (
    <Card className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-neutral-500">{label}</span>
        {icon && <span className="text-neutral-400">{icon}</span>}
      </div>
      <span className="text-2xl font-semibold text-neutral-900">{value}</span>
      {delta && (
        <span className={cn("text-sm font-medium", deltaToneClasses[deltaTone])}>{delta}</span>
      )}
    </Card>
  );
}
