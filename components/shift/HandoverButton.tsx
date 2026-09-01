"use client";

import { useState } from "react";
import { ArrowLeftRight } from "lucide-react";

import { handoverShift } from "@/repositories/shift.repository";
import { useToast } from "@/hooks/useToast";

type Props = {
  expectedCash: number;
  onDone: () => void;
};

// تسليم الوردية لزميل.
//
// ============================================================
// الفرق بينه وبين قفل اليوم
// ============================================================
//
// قفل اليوم = المحل قفل. التسليم = المحل شغّال والشخص اللي واقف
// على الكاشير اتغيّر.
//
// تقنيًا الاتنين بيعملوا نفس الحاجة للوردية القديمة (بتتقفل بجرد)،
// والفرق إن التسليم بيفتح وردية جديدة على طول. من غير ده، الكاشير
// التاني بيكمّل على درج فيه فلوس مش بتاعته ومحدش عدّها.
//
// ============================================================
// ليه الجرد إجباري هنا وهو اختياري في القفل
// ============================================================
//
// قفل اليوم من غير عدّ = صاحب المحل هيعدّ بنفسه بعدين. تسليم من
// غير عدّ = **مفيش تسليم أصلًا** - الفرق اللي هيطلع بكرة مش هيبقى
// معروف هو من نوبة مين.
export default function HandoverButton({ expectedCash, onDone }: Props) {
  const toast = useToast();

  const [open, setOpen] = useState(false);
  const [cash, setCash] = useState("");
  const [busy, setBusy] = useState(false);

  async function run() {
    const value = Number(cash);

    if (cash.trim() === "" || !Number.isFinite(value) || value < 0) {
      toast.error("اكتب الكاش اللي عدّيته في الدرج");
      return;
    }

    setBusy(true);

    try {
      await handoverShift(value);

      toast.success("الوردية اتسلّمت — وردية جديدة اتفتحت");

      setOpen(false);
      setCash("");

      onDone();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "تعذر تسليم الوردية"
      );
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-ink-600 bg-ink-800 p-4 font-semibold text-paper transition hover:border-splash"
      >
        <ArrowLeftRight size={18} />
        سلّم الوردية لزميلك
      </button>
    );
  }

  const counted = Number(cash);
  const diff =
    cash.trim() !== "" && Number.isFinite(counted)
      ? counted - expectedCash
      : null;

  return (
    <div className="rounded-xl border border-splash/40 bg-ink-800 p-5">
      <h3 className="mb-1 flex items-center gap-2 font-bold text-paper">
        <ArrowLeftRight size={18} />
        تسليم الوردية
      </h3>

      <p className="mb-4 text-sm text-mist">
        وردیتك هتتقفل بالرقم اللي هتكتبه، ووردية جديدة هتتفتح على طول
        عشان زميلك يبدأ من درج معلوم.
      </p>

      <label className="mb-2 block text-sm text-mist">
        عدّ الدرج واكتب الرقم — المتوقع {expectedCash.toFixed(2)} ج
      </label>

      <input
        type="number"
        inputMode="decimal"
        value={cash}
        onChange={(e) => setCash(e.target.value)}
        placeholder={expectedCash.toFixed(2)}
        className="w-full rounded-xl border border-ink-600 bg-ink-900 p-3 text-paper outline-none"
      />

      {/* الفرق بيبان قبل التأكيد مش بعده. اللي هيلاقي عجز ٢٠٠ ج
          المفروض يعدّ تاني دلوقتي، مش يكتشفه بكرة. */}
      {diff !== null && Math.abs(diff) >= 0.01 && (
        <p
          className={`mt-2 text-sm font-semibold ${
            diff < 0 ? "text-red-400" : "text-amber-300"
          }`}
        >
          {diff < 0
            ? `عجز ${Math.abs(diff).toFixed(2)} ج`
            : `زيادة ${diff.toFixed(2)} ج`}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="flex-1 rounded-xl bg-splash p-3 font-bold text-ink-950 transition hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "جارِ التسليم..." : "أكّد التسليم"}
        </button>

        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setCash("");
          }}
          disabled={busy}
          className="rounded-xl bg-ink-700 px-5 font-semibold text-paper transition hover:bg-ink-600 disabled:opacity-50"
        >
          رجوع
        </button>
      </div>
    </div>
  );
}
