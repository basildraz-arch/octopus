"use client";

import { useState } from "react";
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Coins,
} from "lucide-react";

import { useSession } from "@/hooks/useSession";
import { useToast } from "@/hooks/useToast";
import {
  parseCatalogFile,
  importCatalog,
  type ImportResult,
} from "@/services/catalogImport.service";
import type { ParsedCatalog } from "@/lib/importCatalog";

const MAPPING_LABELS: Record<string, string> = {
  name: "اسم الصنف",
  category: "المجموعة",
  code: "الكود",
  unit: "الوحدة",
  price1: "التسعيرة الأولى",
  price2: "التسعيرة التانية",
  price3: "التسعيرة التالتة",
  buyPrice: "سعر الشراء",
  stock: "الكمية",
};

export default function ImportPage() {
  const { user, business } = useSession();
  const toast = useToast();

  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParsedCatalog | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const tierLabels = business?.price_tier_labels ?? [
    "التسعيرة الأولى",
    "التسعيرة التانية",
    "التسعيرة التالتة",
  ];

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];

    if (!file) return;

    setParsing(true);
    setResult(null);
    setParsed(null);
    setFileName(file.name);

    try {
      const data = await parseCatalogFile(file);

      if (data.items.length === 0) {
        toast.error("مفيش أي أصناف في الملف");
        return;
      }

      setParsed(data);
    } catch (err) {
      console.error(err);

      const message =
        err instanceof Error ? err.message : "تعذر قراءة الملف";

      toast.error(message);
    } finally {
      setParsing(false);
    }
  }

  async function handleImport() {
    if (!user || !parsed) return;

    setImporting(true);

    try {
      const outcome = await importCatalog(user.business_id, parsed);

      setResult(outcome);
      setParsed(null);

      toast.success(`اتضاف ${outcome.createdItems} صنف`);
    } catch (err) {
      console.error(err);

      const message =
        err instanceof Error ? err.message : "حصل خطأ أثناء الاستيراد";

      toast.error(message);
    } finally {
      setImporting(false);
    }
  }

  return (
    <main className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <FileSpreadsheet size={28} />
          استيراد الأصناف من ملف
        </h1>

        <p className="mt-1 text-mist">
          ارفع ملف Excel أو CSV فيه قائمة أسعارك، والبرنامج هيعمل المجموعات
          والأصناف لوحده
        </p>
      </div>

      <div className="rounded-xl border border-ink-600 bg-ink-800 p-5">
        <label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-ink-600 p-8 text-center transition hover:border-splash">
          <Upload size={32} className="text-mist" />

          <span className="font-bold text-paper">
            {fileName || "اختار ملف (.xlsx أو .csv)"}
          </span>

          <span className="text-xs text-mist">
            لازم يكون فيه عمود لاسم الصنف وعمود لسعر البيع - باقي الأعمدة
            اختيارية
          </span>

          <input
            type="file"
            accept=".xlsx,.csv"
            onChange={handleFile}
            className="hidden"
          />
        </label>

        {parsing && (
          <p className="mt-4 text-center text-mist">
            بقرا الملف...
          </p>
        )}
      </div>

      {parsed && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-ink-600 bg-ink-800 p-4 text-center">
              <div className="text-3xl font-bold text-splash">
                {parsed.items.length}
              </div>
              <div className="mt-1 text-xs text-mist">صنف</div>
            </div>

            <div className="rounded-xl border border-ink-600 bg-ink-800 p-4 text-center">
              <div className="text-3xl font-bold text-splash">
                {parsed.categories.length}
              </div>
              <div className="mt-1 text-xs text-mist">مجموعة</div>
            </div>

            <div
              className={`rounded-xl border p-4 text-center ${
                parsed.skipped.length
                  ? "border-amber-800 bg-amber-950/20"
                  : "border-ink-600 bg-ink-800"
              }`}
            >
              <div
                className={`text-3xl font-bold ${
                  parsed.skipped.length ? "text-amber-400" : "text-mist"
                }`}
              >
                {parsed.skipped.length}
              </div>
              <div className="mt-1 text-xs text-mist">صف متخطي</div>
            </div>
          </div>

          {parsed.hasTiers && (
            <div className="rounded-xl border border-green-700 bg-green-950/20 p-4">
              <p className="flex items-center gap-2 text-sm font-bold text-green-400">
                <Coins size={16} />
                الملف فيه 3 تسعيرات لكل صنف - هتتسجل كـ{" "}
                {tierLabels.join(" / ")}
              </p>
            </div>
          )}

          <div className="rounded-xl border border-ink-600 bg-ink-800 p-5">
            <h2 className="mb-3 flex items-center gap-2 font-bold">
              <Layers size={16} />
              الأعمدة اللي البرنامج فهمها
            </h2>

            <div className="space-y-1 text-sm">
              {Object.entries(parsed.mapping).map(([field, column]) => (
                <div
                  key={field}
                  className="flex justify-between border-b border-ink-700 py-1 last:border-0"
                >
                  <span className="text-mist">{MAPPING_LABELS[field]}</span>

                  <span
                    className={column ? "text-paper" : "text-mist opacity-50"}
                  >
                    {column || "مش موجود"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-ink-600 bg-ink-800 p-5">
            <h2 className="mb-3 font-bold">أول 10 أصناف</h2>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="text-xs text-mist">
                  <tr>
                    <th className="pb-2">الصنف</th>
                    <th className="pb-2">المجموعة</th>
                    <th className="pb-2">{tierLabels[0]}</th>
                    <th className="pb-2">{tierLabels[1]}</th>
                    <th className="pb-2">{tierLabels[2]}</th>
                  </tr>
                </thead>

                <tbody>
                  {parsed.items.slice(0, 10).map((item) => (
                    <tr key={item.name} className="border-t border-ink-700">
                      <td className="py-2 text-paper">{item.name}</td>
                      <td className="py-2 text-mist">{item.category ?? "-"}</td>
                      <td className="py-2 text-green-400">{item.price1}</td>
                      <td className="py-2 text-mist">{item.price2 ?? "-"}</td>
                      <td className="py-2 text-mist">{item.price3 ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {parsed.skipped.length > 0 && (
            <div className="rounded-xl border border-amber-800 bg-amber-950/20 p-5">
              <h2 className="mb-2 flex items-center gap-2 font-bold text-amber-400">
                <AlertTriangle size={16} />
                صفوف مش هتتضاف
              </h2>

              <ul className="space-y-1 text-sm text-mist">
                {parsed.skipped.slice(0, 15).map((s) => (
                  <li key={s.row}>
                    صف {s.row}: {s.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={handleImport}
            disabled={importing}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-splash p-4 text-lg font-bold text-ink-950 hover:bg-splash-deep disabled:opacity-50"
          >
            {importing
              ? "بيستورد..."
              : `استورد ${parsed.items.length} صنف`}
          </button>
        </>
      )}

      {result && (
        <div className="rounded-xl border border-green-700 bg-green-950/20 p-5">
          <h2 className="mb-2 flex items-center gap-2 font-bold text-green-400">
            <CheckCircle2 size={18} />
            خلص الاستيراد
          </h2>

          <p className="text-sm text-mist">
            اتضاف {result.createdItems} صنف و {result.createdCategories} مجموعة.
          </p>

          {result.skippedExisting.length > 0 && (
            <p className="mt-2 text-sm text-amber-400">
              {result.skippedExisting.length} صنف كانوا موجودين قبل كده
              فاتخطيتهم (مغيرتش أسعارهم).
            </p>
          )}
        </div>
      )}
    </main>
  );
}
