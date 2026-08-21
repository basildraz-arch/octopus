// CSV rather than a real spreadsheet file, on purpose: Excel opens it,
// Google Sheets opens it, and it needs no library - which matters when
// the whole point is "your data is yours and you can walk away with
// it at any moment".
//
// The BOM at the front is not decoration. Without it Excel on Windows
// reads UTF-8 Arabic as Latin-1 and every name comes out as mojibake,
// which makes an export that technically worked look broken to the
// person it was built to reassure.
const BOM = "﻿";

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";

  const text = String(value);

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

export function toCsv(
  headers: string[],
  rows: (unknown[])[]
): string {
  const lines = [headers.map(cell).join(",")];

  for (const row of rows) {
    lines.push(row.map(cell).join(","));
  }

  return BOM + lines.join("\r\n");
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

export function dateStamp(): string {
  const now = new Date();

  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}
