import type { ReactElement, ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardDescription, CardHeader, CardTitle } from "./Card";

// Categorical palette drawn from the design tokens (brand + sky + semantic
// colours), used consistently across every chart in the app.
export const CHART_COLORS = [
  "#aa3bff", // brand.400
  "#47bfff", // sky.300
  "#1b9c5a", // success.500
  "#c9821a", // warning.500
  "#2f5fd0", // info.500
  "#d0342c", // danger.500
  "#7e14ff", // brand.600
];

export interface ChartWrapperProps {
  title: string;
  description?: string;
  height?: number;
  children: ReactNode;
  action?: ReactNode;
  isEmpty?: boolean;
  emptyMessage?: string;
}

/**
 * Common chart chrome: title, optional description/action, a fixed-height
 * ResponsiveContainer so Recharts always gets an explicit box to measure,
 * and an empty state. Wrap any Recharts chart element as `children`.
 */
export function ChartWrapper({
  title,
  description,
  height = 280,
  children,
  action,
  isEmpty,
  emptyMessage = "No data for the selected filters yet.",
}: ChartWrapperProps) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {action}
      </CardHeader>
      {isEmpty ? (
        <div
          className="flex items-center justify-center rounded-md border border-dashed border-neutral-200 text-sm text-neutral-400"
          style={{ height }}
        >
          {emptyMessage}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          {/* Recharts requires a single chart element child. */}
          {children as ReactElement}
        </ResponsiveContainer>
      )}
    </Card>
  );
}

export interface SeriesConfig {
  key: string;
  label: string;
  color?: string;
}

export interface CategoryDatum {
  [key: string]: string | number;
}

export interface SimpleBarChartProps {
  title: string;
  description?: string;
  data: CategoryDatum[];
  xKey: string;
  series: SeriesConfig[];
  height?: number;
}

export function SimpleBarChart({
  title,
  description,
  data,
  xKey,
  series,
  height,
}: SimpleBarChartProps) {
  return (
    <ChartWrapper
      title={title}
      description={description}
      height={height}
      isEmpty={data.length === 0}
    >
      <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e4e7" />
        <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
        <Tooltip />
        {series.length > 1 && <Legend />}
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            fill={s.color ?? CHART_COLORS[i % CHART_COLORS.length]}
            radius={[4, 4, 0, 0]}
          />
        ))}
      </BarChart>
    </ChartWrapper>
  );
}

export interface SimpleLineChartProps {
  title: string;
  description?: string;
  data: CategoryDatum[];
  xKey: string;
  series: SeriesConfig[];
  height?: number;
}

export function SimpleLineChart({
  title,
  description,
  data,
  xKey,
  series,
  height,
}: SimpleLineChartProps) {
  return (
    <ChartWrapper
      title={title}
      description={description}
      height={height}
      isEmpty={data.length === 0}
    >
      <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e4e7" />
        <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
        <Tooltip />
        {series.length > 1 && <Legend />}
        {series.map((s, i) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color ?? CHART_COLORS[i % CHART_COLORS.length]}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </LineChart>
    </ChartWrapper>
  );
}

export interface SimplePieChartProps {
  title: string;
  description?: string;
  data: CategoryDatum[];
  nameKey: string;
  valueKey: string;
  height?: number;
}

export function SimplePieChart({
  title,
  description,
  data,
  nameKey,
  valueKey,
  height = 260,
}: SimplePieChartProps) {
  return (
    <ChartWrapper
      title={title}
      description={description}
      height={height}
      isEmpty={data.length === 0}
    >
      <PieChart>
        <Tooltip />
        <Legend />
        <Pie data={data} dataKey={valueKey} nameKey={nameKey} outerRadius="75%" label>
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
      </PieChart>
    </ChartWrapper>
  );
}
