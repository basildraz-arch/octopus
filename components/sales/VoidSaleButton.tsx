"use client";

import { useState } from "react";
import { Trash2, AlertTriangle } from "lucide-react";

import { voidSale } from "@/repositories/sale.repository";
import { useToast } from "@/hooks/useToast";

type Props = {
  saleId: string;
  total: number;
  createdAt: string;
  onVoided: () => void;
};

// إلغاء فاتورة اتسجّلت غلط.
//
// ============================================================
// ليه خطوتين وسبب مكتوب
// ============================================================
//
// الإلغاء بيمسح فاتورة ويرجّع بضاعة. دوسة واحدة على الموبايل وسط
// الشغل مش كفاية لحاجة بتغيّر المخزون والمبيعات مع بعض.
//
// والسبب مش شكليات: السجل (`sale_voids`) بيفضل موجود بعد ما
// الفاتورة تروح، و"اتلغت ليه" هو الفرق بين غلطة كاشير وبين حاجة
// محتاجة سؤال. الحقل مش إجباري - إجباره بيخلّي الناس تكتب "." -
// بس موجود وواضح.
//
// **مفيش confirm() ولا alert().** المودال بتاع المتصفح بيقفل كل
// حاجة وبيبان غريب على الموبايل. التأكيد جوه الصفحة.
export default function VoidSaleButton({
  saleId,
  total,
  createdAt,
  onVoided,
}: Props) {
  const toast = useToast();

  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);

    try {
      await voidSale(saleId, reason);

      toast.success("الفاتورة اتلغت والبضاعة رجعت للمخزون");

      setConfirming(false);
      setReason("");

      onVoided();
    } catch (err) {
      // رسالة القاعدة عربية وموجّهة للمستخدم — بنعرضها زي ما هي.
      toast.error(
        err instanceof Error ? err.message : "تعذر إلغاء الفاتورة"
      );
    } finally {
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="mt-3 flex items-center gap-2 rounded-lg border border-ink-600 px-3 py-2 text-xs font-semibold text-mist transition hover:border-red-800 hover:text-red-300"
      >
        <Trash2 size={14} />
        إلغاء الفاتورة دي
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-red-800 bg-red-950/30 p-4">
      <p className="mb-2 flex items-start gap-2 text-sm font-semibold text-red-200">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        إلغاء فاتورة {total.toFixed(2)} ج بتاريخ{" "}
        {new Date(createdAt).toLocaleString("ar-EG", {
          dateStyle: "medium",
          timeStyle: "short",
        })}
      </p>

      <p className="mb-3 text-xs text-red-300/80">
        الفاتورة هتتشال من المبيعات والتقارير، والبضاعة هترجع للمخزون
        بتكلفتها الأصلية. العملية دي بتتسجّل باسمك.
      </p>

      <input
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="السبب (اختياري) — مثلاً: اتسجّلت مرتين"
        className="mb-3 w-full rounded-lg border border-ink-600 bg-ink-900 p-3 text-sm text-paper outline-none"
      />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="flex-1 rounded-lg bg-red-700 p-3 text-sm font-bold text-white transition hover:bg-red-600 disabled:opacity-50"
        >
          {busy ? "جارِ الإلغاء..." : "أيوة، ألغِ الفاتورة"}
        </button>

        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            setReason("");
          }}
          disabled={busy}
          className="rounded-lg bg-ink-700 px-4 text-sm font-semibold text-paper transition hover:bg-ink-600 disabled:opacity-50"
        >
          رجوع
        </button>
      </div>
    </div>
  );
}
