import { useTranslation } from "react-i18next";
import { Button } from "./Button";
import { exportTableToExcel, exportTableToPdf, type ExportColumn } from "../../lib/exportTable";

export interface ExportButtonsProps<T> {
  title: string;
  columns: ExportColumn<T>[];
  rows: T[];
  filename: string;
}

/** Attaches real PDF/Excel export to whatever table a dashboard is already
 * rendering — same columns/rows, just a plain-value accessor per column
 * instead of the `DataTable` column's JSX `render`. */
export function ExportButtons<T>({ title, columns, rows, filename }: ExportButtonsProps<T>) {
  const { t } = useTranslation();

  return (
    <div className="mb-3 flex justify-end gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={() => exportTableToPdf(title, columns, rows, filename)}
      >
        {t("dashboard.exportPdf")}
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => exportTableToExcel(title, columns, rows, filename)}
      >
        {t("dashboard.exportExcel")}
      </Button>
    </div>
  );
}
