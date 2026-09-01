"use client";

import { useEffect, useMemo, useState } from "react";
import { Receipt } from "lucide-react";

import {
  getExpensesByDateRange,
  type ExpenseWithWho,
} from "@/repositories/expense.repository";

type Props = {
  businessId: string;
  from: string;
  to: string;
};

function money(value: number) {
  return `${value.toFixed(2)} ج`;
}

function dayLabel(iso: string) {
  return new Date(iso).toLocaleDateString("ar-EG", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("ar-EG", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// المصروف المتكرر بيتجمّع بالوصف.
//
// كيرو بيكتب "سلفة عمار" و"عمار" و"حساب مكاريوس" و"مكاريوس" — نفس
// الشخص بأشكال مختلفة. مابنحاولش نخمّن إنهم واحد (ده هيغلط)، بس
// بنجمّع المتطابق حرفيًا على الأقل، عشان "عمار" اللي اتصرف ٣ مرات
// يبان كسطر واحد بإجماليه بدل ما يتوه في القايمة.
function groupByDescription(rows: ExpenseWithWho[]) {
  const totals = new Map<string, { total: number; count: number }>();

  for (const row of rows) {
    const key = row.description.trim();
    const current = totals.get(key) ?? { total: 0, count: 0 };

    totals.set(key, {
      total: current.total + row.amount,
      count: current.count + 1,
    });
  }

  return Array.from(totals.entries())
    .map(([description, value]) => ({ description, ...value }))
    .sort((a, b) => b.total - a.total);
}

function groupByDay(rows: ExpenseWithWho[]) {
  const days = new Map<string, ExpenseWithWho[]>();

  for (const row of rows) {
    const key = row.created_at.slice(0, 10);

    days.set(key, [...(days.get(key) ?? []), row]);
  }

  return Array.from(days.entries()).sort((a, b) => b[0].localeCompare(a[0]));
}

export default function ExpensesReport({ businessId, from, to }: Props) {
  const [rows, setRows] = useState<ExpenseWithWho[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"day" | "kind">("day");

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError("");

    getExpensesByDateRange(businessId, from, to)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "تعذر تحميل المصروفات");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [businessId, from, to]);

  const total = useMemo(
    () => rows.reduce((sum, row) => sum + row.amount, 0),
    [rows]
  );

  const byKind = useMemo(() => groupByDescription(rows), [rows]);
  const byDay = useMemo(() => groupByDay(rows), [rows]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-ink-600 bg-ink-800 p-5 text-sm text-mist">
        جارِ تحميل المصروفات...
      </div>
    );
  }

  // مفيش صلاحية = مانعرضش القسم. رسالة "ممنوع" بتقول للكاشير إن فيه
  // حاجة مخبّية، وde مش مفيد لحد.
  if (error) return null;

  return (
    <div className="rounded-2xl border border-ink-600 bg-ink-800 p-5">
      {/* زرار الطباعة كان هنا واتشال: بقى فيه زرار واحد فوق الصفحة
          بيطبع التقرير كامل. زرار "طباعة" جوه قسم بيطبع الصفحة كلها
          بيكدب على اللي بيدوسه. */}
      <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
        <Receipt size={18} />
        المصروفات بالتفصيل
      </h2>

      <p className="mb-4 text-sm text-mist">
        من {from} إلى {to}
      </p>

      {rows.length === 0 ? (
        <p className="rounded-xl bg-ink-900 p-4 text-sm text-mist">
          مفيش مصروفات مسجّلة في الفترة دي.
        </p>
      ) : (
        <>
          <div className="mb-4 rounded-xl bg-ink-900 p-4">
            <span className="text-sm text-mist">
              الإجمالي{" "}
              <span className="text-lg font-bold text-red-400">
                {money(total)}
              </span>{" "}
              في {rows.length} حركة
            </span>
          </div>

          <div className="print-hide mb-4 flex gap-2">
            {(
              [
                ["day", "باليوم"],
                ["kind", "بالبند"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setView(key)}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  view === key
                    ? "bg-splash text-ink-950"
                    : "bg-ink-700 text-paper hover:bg-ink-600"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {view === "kind" ? (
            <div className="space-y-2">
              {byKind.map((row) => (
                <div
                  key={row.description}
                  className="flex items-center justify-between gap-3 rounded-xl border border-ink-600 bg-ink-900 p-3"
                >
                  <span className="min-w-0 truncate font-semibold text-paper">
                    {row.description}
                    {row.count > 1 && (
                      <span className="mr-2 text-xs font-normal text-mist">
                        ×{row.count}
                      </span>
                    )}
                  </span>

                  <span className="shrink-0 font-bold text-red-400">
                    {money(row.total)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {byDay.map(([day, dayRows]) => {
                const dayTotal = dayRows.reduce((s, r) => s + r.amount, 0);

                return (
                  <div key={day}>
                    <div className="mb-2 flex items-baseline justify-between gap-3 border-b border-ink-600 pb-1">
                      <span className="text-sm font-semibold text-paper">
                        {dayLabel(dayRows[0].created_at)}
                      </span>

                      <span className="text-sm font-bold text-red-400">
                        {money(dayTotal)}
                      </span>
                    </div>

                    <div className="space-y-1">
                      {dayRows.map((row) => (
                        <div
                          key={row.id}
                          className="flex items-center justify-between gap-3 px-1 py-1 text-sm"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-paper">
                              {row.description}
                            </span>

                            <span className="block text-xs text-mist">
                              {timeLabel(row.created_at)}
                              {row.created_by_name && ` · ${row.created_by_name}`}
                            </span>
                          </span>

                          <span className="shrink-0 text-paper">
                            {money(row.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
