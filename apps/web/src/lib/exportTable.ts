import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

export interface ExportColumn<T> {
  header: string;
  /** Plain-text/number value only — export formats can't render the rich
   * `ReactNode` a `DataTable` column's own `render` returns, so callers pass
   * a second, export-specific accessor rather than reusing that render fn. */
  value: (row: T) => string | number;
}

/** Real .pdf export via jsPDF + its autoTable plugin — one page, a title,
 * and the same rows/columns shown on screen. */
export function exportTableToPdf<T>(
  title: string,
  columns: ExportColumn<T>[],
  rows: T[],
  filename: string,
): void {
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  autoTable(doc, {
    startY: 22,
    head: [columns.map((c) => c.header)],
    body: rows.map((row) => columns.map((c) => c.value(row))),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [170, 59, 255] },
  });
  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}

/** Real .xlsx export via SheetJS — a single sheet, header row + data rows. */
export function exportTableToExcel<T>(
  sheetName: string,
  columns: ExportColumn<T>[],
  rows: T[],
  filename: string,
): void {
  const data = rows.map((row) => Object.fromEntries(columns.map((c) => [c.header, c.value(row)])));
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  XLSX.writeFile(workbook, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}
