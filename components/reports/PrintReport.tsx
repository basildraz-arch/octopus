"use client";

import { Printer } from "lucide-react";

type Props = {
  title: string;
  from: string;
  to: string;
  businessName?: string | null;
};

function arabicDate(value: string) {
  // القيمة جاية من `<input type="date">` يعني "2026-09-01". بنبنيها
  // كتاريخ محلي (بالأجزاء) مش `new Date(string)` - ده بيقراها UTC
  // وبيطلّع اليوم اللي قبله في مصر.
  const [y, m, d] = value.split("-").map(Number);

  if (!y || !m || !d) return value;

  return new Date(y, m - 1, d).toLocaleDateString("ar-EG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// زرار الطباعة + الترويسة اللي بتطلع على الورق.
//
// ============================================================
// ليه الترويسة هنا مش في الشاشة
// ============================================================
//
// الورقة اللي بتخرج من الطابعة بتتحط في درج أو بتتبعت لمحاسب.
// من غير اسم المحل والفترة، هي **ورقة أرقام مالهاش هوية** - محدش
// هيعرف بعد أسبوعين دي مبيعات أنهي شهر.
//
// الشاشة مش محتاجة الكلام ده لأن الفترة مكتوبة في خانتين التاريخ
// فوق، وde ظاهر قدامك. الورقة مافيهاش الخانتين دول.
//
// فالترويسة `print-only`: مخفية على الشاشة، بتظهر على الورق بس.
export default function PrintReport({
  title,
  from,
  to,
  businessName,
}: Props) {
  return (
    <>
      <button
        type="button"
        onClick={() => window.print()}
        className="print-hide flex items-center gap-2 rounded-xl border border-ink-600 bg-ink-800 px-4 py-3 text-sm font-semibold text-paper transition hover:border-splash"
      >
        <Printer size={16} />
        اطبع التقرير
      </button>

      <div className="print-only mb-6 border-b border-gray-400 pb-3 text-center">
        <h1 className="text-lg font-bold">{businessName ?? "الأخطبوط"}</h1>

        <p className="mt-1 text-base font-semibold">{title}</p>

        <p className="mt-1 text-sm">
          من {arabicDate(from)} إلى {arabicDate(to)}
        </p>

        <p className="mt-1 text-xs">
          اتطبع{" "}
          {new Date().toLocaleString("ar-EG", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
      </div>
    </>
  );
}
