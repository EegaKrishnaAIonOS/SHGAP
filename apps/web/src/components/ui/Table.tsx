import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export function Table({ className, children, ...rest }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto rounded-lg border border-neutral-200">
      <table
        className={cn("w-full min-w-full border-collapse text-left text-sm", className)}
        {...rest}
      >
        {children}
      </table>
    </div>
  );
}

export function TableHeader({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={cn("bg-neutral-50 text-neutral-600", className)} {...rest}>
      {children}
    </thead>
  );
}

export function TableBody({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={cn("divide-y divide-neutral-100", className)} {...rest}>
      {children}
    </tbody>
  );
}

export function TableRow({ className, children, ...rest }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={cn("hover:bg-neutral-50/70", className)} {...rest}>
      {children}
    </tr>
  );
}

export function TableHead({
  className,
  children,
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th scope="col" className={cn("px-4 py-2.5 font-medium", className)} {...rest}>
      {children}
    </th>
  );
}

export function TableCell({
  className,
  children,
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn("px-4 py-2.5 text-neutral-800", className)} {...rest}>
      {children}
    </td>
  );
}

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  className?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  emptyMessage?: string;
  caption?: string;
}

/**
 * Generic, typed data table for the dashboard/admin screens — pass a column
 * config and a row array, get header + body wired up consistently. For
 * anything bespoke, compose the `Table*` primitives above directly.
 */
export function DataTable<T>({ columns, rows, rowKey, emptyMessage, caption }: DataTableProps<T>) {
  return (
    <Table>
      {caption && <caption className="sr-only">{caption}</caption>}
      <TableHeader>
        <TableRow>
          {columns.map((col) => (
            <TableHead key={col.key} className={col.className}>
              {col.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={columns.length} className="py-6 text-center text-neutral-400">
              {emptyMessage ?? "No data"}
            </TableCell>
          </TableRow>
        ) : (
          rows.map((row) => (
            <TableRow key={rowKey(row)}>
              {columns.map((col) => (
                <TableCell key={col.key} className={col.className}>
                  {col.render(row)}
                </TableCell>
              ))}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
