"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

import {
  getProfitByItem,
  type ProfitRow,
} from "@/repositories/profit.repository";

type Props = {
  from: string;
  to: string;
};

// كام صنف نعرض قبل "ورّيني الباقي".
//
// صاحب المحل عايز يعرف مين بيكسّبه ومين واقف. أول عشرة وآخر تلاتة
// بيقولوا الحكاية؛ التسعين اللي في النص مابيقولوش حاجة.
const TOP_COUNT = 10;

function money(value: number) {
  return `${value.toFixed(2)} ج`;
}

export default function ProfitByItem({ from, to }: Props) {
  const [rows, setRows] = useState<ProfitRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError("");

    getProfitByItem(from, to)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((err: unknown) => {
        // رسالة القاعدة عربية وموجّهة للمستخدم ("التقرير ده لصاحب
        // النشاط..."), فبنعرضها زي ما هي بدل ما نخترع واحدة.
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "تعذر تحميل التقرير");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [from, to]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-ink-600 bg-ink-800 p-5 text-sm text-mist">
        جارِ حساب الأرباح...
      </div>
    );
  }

  // مفيش صلاحية = مانعرضش القسم خالص. عرض رسالة "ممنوع" لكاشير
  // بيقوله إن فيه حاجة مخبّية، وde مش مفيد لحد.
  if (error) return null;

  if (rows.length === 0) return null;

  const shown = showAll ? rows : rows.slice(0, TOP_COUNT);

  const totalProfit = rows.reduce((sum, row) => sum + row.profit, 0);
  const totalRevenue = rows.reduce((sum, row) => sum + row.revenue, 0);

  const losers = rows.filter((row) => row.profit < 0);

  return (
    <div className="rounded-2xl border border-ink-600 bg-ink-800 p-5">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
        <TrendingUp size={18} />
        كل صنف كسّب كام
      </h2>

      <p className="mb-4 text-sm text-mist">
        الربح الحقيقي — سعر البيع ناقص تكلفة البضاعة اللي خرجت فعلًا،
        محسوبة وقت البيعة نفسها.
      </p>

      <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 rounded-xl bg-ink-900 p-4 text-sm">
        <span className="text-mist">
          إجمالي الربح{" "}
          <span className="font-bold text-green-400">{money(totalProfit)}</span>
        </span>

        <span className="text-mist">
          من مبيعات <span className="font-bold text-paper">{money(totalRevenue)}</span>
        </span>

        {totalRevenue > 0 && (
          <span className="text-mist">
            الهامش{" "}
            <span className="font-bold text-paper">
              {((totalProfit * 100) / totalRevenue).toFixed(1)}%
            </span>
          </span>
        )}
      </div>

      {losers.length > 0 && (
        <p className="mb-4 flex items-center gap-2 rounded-xl border border-red-800 bg-red-950/30 p-3 text-sm text-red-300">
          <TrendingDown size={16} />
          {losers.length} صنف بيتباع بخسارة — بصّ على السعر أو التكلفة
        </p>
      )}

      <div className="space-y-2">
        {shown.map((row) => (
          <div
            key={row.item_id ?? row.item_name}
            className="flex items-center justify-between gap-3 rounded-xl border border-ink-600 bg-ink-900 p-3"
          >
            <span className="min-w-0">
              <span className="block truncate font-semibold text-paper">
                {row.item_name}
              </span>

              <span className="block text-xs text-mist">
                باع {row.quantity} · مبيعات {money(row.revenue)}
              </span>
            </span>

            <span className="shrink-0 text-left">
              <span
                className={`block font-bold ${
                  row.profit < 0 ? "text-red-400" : "text-green-400"
                }`}
              >
                {money(row.profit)}
              </span>

              {row.margin !== null && (
                <span className="block text-xs text-mist">{row.margin}%</span>
              )}
            </span>
          </div>
        ))}
      </div>

      {rows.length > TOP_COUNT && (
        <button
          type="button"
          onClick={() => setShowAll((value) => !value)}
          className="mt-4 w-full rounded-xl bg-ink-700 p-3 text-sm font-semibold text-paper transition hover:bg-ink-600"
        >
          {showAll ? "ورّي الأعلى بس" : `ورّي كل الـ${rows.length} صنف`}
        </button>
      )}

      <p className="mt-3 text-xs text-mist">
        الخدمات بتظهر بهامش ١٠٠٪ لأن مالهاش تكلفة بضاعة — ده مش معناه
        إنها ببلاش عليك.
      </p>
    </div>
  );
}
