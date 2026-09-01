"use client";

import { useEffect, useState } from "react";
import { Wallet, ChevronDown } from "lucide-react";

import {
  getMyShiftReport,
  type MyShiftReport,
} from "@/repositories/shift.repository";

function money(value: number) {
  return `${value.toFixed(2)} ج`;
}

// "أنا بعت بكام النهاردة؟"
//
// السؤال ده كان مالوش إجابة في البرنامج غير إن صاحب المحل يدّي
// الكاشير صلاحية التقارير كاملة - يعني الأرباح والتكاليف وشغل كل
// زميل. فمعظم الكاشيرية كانوا بيعدّوا على ورقة.
//
// **مقفولة افتراضيًا.** الشاشة دي شاشة بيع؛ الملخّص حاجة بيفتحها
// وقت التسليم مش حاجة بتقعد قدامه طول اليوم. (ونفس قاعدة الإعدادات:
// المجموعات كلها مقفولة.)
export default function MyShiftSummary() {
  const [report, setReport] = useState<MyShiftReport | null>(null);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // بنحمّل أول ما يفتحها مش مع الشاشة: الكاشير بيفتح شاشة البيع
    // مية مرة في اليوم وبيفتح دي مرة.
    if (!open || loaded) return;

    let cancelled = false;

    getMyShiftReport()
      .then((data) => {
        if (!cancelled) {
          setReport(data);
          setLoaded(true);
        }
      })
      .catch(() => {
        // مش وظيفة حرجة. البيع مايتأثرش لو دي وقعت.
        if (!cancelled) setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [open, loaded]);

  return (
    <details
      className="mb-4 rounded-xl border border-ink-600 bg-ink-800"
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="flex cursor-pointer items-center gap-2 p-3 text-sm font-semibold text-paper">
        <Wallet size={16} />
        شغلي في الوردية دي
        <ChevronDown size={14} className="mr-auto text-mist" />
      </summary>

      <div className="border-t border-ink-600 p-4">
        {!loaded ? (
          <p className="text-sm text-mist">جارِ الحساب...</p>
        ) : !report ? (
          <p className="text-sm text-mist">
            مفيش وردية مفتوحة دلوقتي.
          </p>
        ) : (
          <>
            <p className="mb-3 text-sm text-mist">
              من{" "}
              {new Date(report.openedAt).toLocaleString("ar-EG", {
                dateStyle: "medium",
                timeStyle: "short",
              })}{" "}
              · {report.saleCount} فاتورة
            </p>

            <div className="space-y-2 text-sm">
              <Row label="إجمالي اللي بعته" value={money(report.totalSales)} strong />
              <Row label="منهم كاش" value={money(report.cashSales)} />

              {report.otherSales > 0 && (
                <Row label="فودافون كاش / إنستاباي" value={money(report.otherSales)} />
              )}

              {report.creditSales > 0 && (
                <Row label="على الحساب (مادخلش الدرج)" value={money(report.creditSales)} />
              )}

              {report.myExpenses > 0 && (
                <Row label="مصروفات صرفتها" value={`− ${money(report.myExpenses)}`} />
              )}
            </div>

            <div className="mt-4 rounded-xl bg-ink-900 p-4">
              <p className="text-xs text-mist">
                المفروض في الدرج من شغلي
              </p>

              <p className="mt-1 text-2xl font-bold text-green-400">
                {money(report.expectedCash)}
              </p>

              <p className="mt-2 text-xs text-mist">
                الرقم ده من بيعاتك إنت بس. لو فيه كاشير تاني على نفس
                الوردية، الدرج فيه شغله كمان.
              </p>
            </div>
          </>
        )}
      </div>
    </details>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-mist">{label}</span>

      <span className={strong ? "font-bold text-paper" : "text-paper"}>
        {value}
      </span>
    </div>
  );
}
