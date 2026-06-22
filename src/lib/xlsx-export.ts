import * as XLSX from "xlsx";

export function exportRowsToXlsx<T extends Record<string, unknown>>(
  rows: T[],
  filenameBase: string,
  sheetName = "Dados",
  columnWidths?: number[],
) {
  const ws = XLSX.utils.json_to_sheet(rows);
  if (columnWidths && columnWidths.length) {
    ws["!cols"] = columnWidths.map((wch) => ({ wch }));
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  const today = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${filenameBase}-${today}.xlsx`);
}
