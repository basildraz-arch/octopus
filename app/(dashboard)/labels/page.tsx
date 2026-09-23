"use client";

import { useEffect, useMemo, useState } from "react";
import { Printer, Tag, AlertTriangle } from "lucide-react";

import { getItems } from "@/repositories/item.repository";
import { getBusiness } from "@/repositories/business.repository";
import { useSession } from "@/hooks/useSession";
import { ean13Svg, isValidEan13 } from "@/lib/barcode";

import type { Item } from "@/types/item";
import type { Business } from "@/types/business";

// ============================================================
// طباعة ملصقات الباركود
// ============================================================
//
// للمحل اللي بيعبّي بضاعته بنفسه: الدراي فود في أكياس، المكسرات،
// البهارات، أي حاجة مالهاش ملصق من مصنع.
//
// ============================================================
// ليه ورق A4 مش طابعة ملصقات
// ============================================================
//
// طابعة الملصقات بتبدأ من تلات آلاف جنيه ومعاها رول مصروف شهري.
// وصاحب المحل اللي لسه بيجرّب البرنامج مش هيشتريها عشان فيتشر
// شافها امبارح.
//
// ورق الاستيكر A4 بيتباع في أي مكتبة بجنيهات، وبيتطبع على أي
// طابعة عادية موجودة عنده. الشبكة تحت مظبوطة على الفرخ الشائع:
// **٣ أعمدة × ٨ صفوف = ٢٤ ملصق في الفرخ**.
//
// نفس منطق الكاميرا: ابدأ من غير ما تشتري حاجة. اللي هيكبر
// ويشتري طابعة ملصقات، نزوّدله مقاس الرول ساعتها.
//
// ============================================================
// اللي الشاشة دي مابتعملوش
// ============================================================
//
// مابتولّدش أكواد. التوليد في شاشة الصنف نفسها، عشان الكود
// يتحفظ مع الصنف وتشوفه قدامك. هنا بنطبع اللي اتولد بس.

const PER_ROW = 3;
const ROWS = 8;
const PER_SHEET = PER_ROW * ROWS;

export default function LabelsPage() {
  const { user } = useSession();

  const [items, setItems] = useState<Item[]>([]);
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);

  /** كام ملصق لكل صنف. */
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!user) return;

    Promise.all([getItems(user.business_id), getBusiness(user.business_id)])
      .then(([rows, biz]) => {
        setItems(rows);
        setBusiness(biz);
      })
      .finally(() => setLoading(false));
  }, [user]);

  const withCode = useMemo(
    () => items.filter((item) => isValidEan13(item.barcode ?? "")),
    [items]
  );

  const withoutCode = useMemo(
    () => items.filter((item) => !isValidEan13(item.barcode ?? "")),
    [items]
  );

  // ============================================================
  // الملصقات المطلوبة، مفرودة
  // ============================================================
  //
  // صنف عايز ٦ ملصقات = ٦ عناصر في المصفوفة. الفرد هنا بيخلي
  // الشبكة غبية وبسيطة: كل عنصر ملصق، والصفحة بتتقسم لوحدها.
  const labels = useMemo(() => {
    const out: Item[] = [];

    for (const item of withCode) {
      const n = counts[item.id] ?? 0;

      for (let i = 0; i < n; i++) out.push(item);
    }

    return out;
  }, [withCode, counts]);

  function setCount(id: string, value: number) {
    setCounts((old) => ({
      ...old,
      // مفيش عدد سالب، ومفيش فرخين في الضغطة الواحدة بالغلط.
      [id]: Math.max(0, Math.min(200, Math.floor(value) || 0)),
    }));
  }

  if (loading) {
    return <main className="p-8 text-center text-mist">جارِ التحميل...</main>;
  }

  return (
    <main className="mx-auto max-w-5xl space-y-8">
      <div className="print-hide">
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <Tag size={28} />
          ملصقات الباركود
        </h1>

        <p className="mt-2 text-mist">
          للبضاعة اللي بتعبّيها بنفسك. اطبع على ورق استيكر A4 عادي —
          الفرخ فيه {PER_SHEET} ملصق.
        </p>
      </div>

      {withCode.length === 0 ? (
        <div className="print-hide rounded-2xl border border-amber-900/70 bg-amber-950/20 p-6">
          <p className="flex items-center gap-2 font-bold text-amber-200">
            <AlertTriangle size={18} />
            مفيش صنف له كود لسه
          </p>

          <p className="mt-2 text-sm leading-relaxed text-paper">
            افتح الصنف من شاشة الأصناف، ودوس «ولّد كود» جنب خانة
            الباركود، واحفظ. وبعدين ارجع هنا.
          </p>
        </div>
      ) : (
        <div className="print-hide space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setCounts(
                  Object.fromEntries(withCode.map((item) => [item.id, 1]))
                )
              }
              className="rounded-xl bg-ink-700 px-4 py-2.5 text-sm font-semibold text-paper hover:bg-ink-600"
            >
              ملصق واحد لكل صنف
            </button>

            <button
              type="button"
              onClick={() => setCounts({})}
              className="rounded-xl bg-ink-800 px-4 py-2.5 text-sm text-mist hover:bg-ink-700"
            >
              صفّر الكل
            </button>

            <span className="text-sm text-mist">
              {labels.length} ملصق ={" "}
              {Math.ceil(labels.length / PER_SHEET) || 0} فرخ
            </span>

            <button
              type="button"
              onClick={() => window.print()}
              disabled={labels.length === 0}
              className="ms-auto flex items-center gap-2 rounded-xl bg-splash px-5 py-2.5 font-bold text-ink-950 transition hover:opacity-90 disabled:opacity-40"
            >
              <Printer size={18} />
              اطبع
            </button>
          </div>

          <ul className="divide-y divide-ink-700 rounded-2xl border border-ink-600 bg-ink-800">
            {withCode.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 p-3"
              >
                <span className="min-w-0">
                  <span className="block truncate text-paper">{item.name}</span>
                  <span className="block font-mono text-xs text-mist">
                    {item.barcode}
                  </span>
                </span>

                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={counts[item.id] ?? 0}
                  onChange={(e) => setCount(item.id, Number(e.target.value))}
                  aria-label={`عدد ملصقات ${item.name}`}
                  className="w-20 shrink-0 rounded-lg border border-ink-600 bg-ink-900 p-2 text-center text-paper outline-none"
                />
              </li>
            ))}
          </ul>

          {withoutCode.length > 0 && (
            <p className="text-sm text-mist">
              فيه {withoutCode.length} صنف من غير كود. افتحهم من شاشة
              الأصناف ودوس «ولّد كود».
            </p>
          )}
        </div>
      )}

      {/* ============================================================
          الفرخ نفسه
          ============================================================

          بيتعرض على الشاشة كمعاينة كمان - عشان صاحب المحل يشوف
          الشكل قبل ما يحرق ورق استيكر. */}
      {labels.length > 0 && (
        <div data-print-area>
          <div
            className="grid gap-[2mm] rounded-2xl bg-white p-[2mm] text-black"
            style={{ gridTemplateColumns: `repeat(${PER_ROW}, 1fr)` }}
          >
            {labels.map((item, index) => (
              <div
                key={`${item.id}-${index}`}
                className="flex flex-col items-center justify-center gap-[1mm] overflow-hidden rounded border border-gray-300 p-[1.5mm] text-center"
                style={{ height: "33mm", breakInside: "avoid" }}
              >
                {business?.name && (
                  <span className="max-w-full truncate text-[2.4mm] text-gray-600">
                    {business.name}
                  </span>
                )}

                <span className="max-w-full truncate text-[3mm] font-bold">
                  {item.name}
                </span>

                <span className="text-[3.4mm] font-bold">
                  {item.sell_price.toFixed(2)} ج
                </span>

                {/* الـSVG جاي من `lib/barcode.ts` - نص مولّد من
                    أرقام، مفيش فيه أي حاجة من إدخال المستخدم. */}
                <span
                  dangerouslySetInnerHTML={{
                    __html: ean13Svg(item.barcode ?? "", 30, 11),
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
