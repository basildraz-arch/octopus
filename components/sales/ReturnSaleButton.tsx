"use client";

import { useState } from "react";
import { Undo2 } from "lucide-react";

import { returnSaleLines } from "@/repositories/sale.repository";
import { useToast } from "@/hooks/useToast";

type Line = {
  item_id: string;
  quantity: number;
  total: number;
  items: { name: string; unit: string } | null;
};

type Props = {
  saleId: string;
  lines: Line[];
  onReturned: () => void;
};

// مرتجع جزئي.
//
// ============================================================
// ليه مربعات كمية مش زرار "رجّع" على كل سطر
// ============================================================
//
// الزبون بيرجّع حاجتين من تلاتة، مش السطر كله. زرار واحد لكل سطر
// كان معناه إن الكاشير يدوس ٣ مرات على نفس السطر ويعد في دماغه.
//
// المربع فاضي = مش راجع. الكاشير بيكتب في اللي راجع بس وبيسيب
// الباقي، فالحالة الشايعة (صنف واحد راجع من فاتورة فيها خمسة)
// بتبقى خانة واحدة.
//
// **مفيش زرار "رجّع الكل"** عن قصد: ده اسمه إلغاء وله زرار تاني
// تحت. حاجتين بيعملوا نفس الشيء بأسماء مختلفة بيخلّوا الواحد
// يتردّد قدام الاتنين.
export default function ReturnSaleButton({
  saleId,
  lines,
  onReturned,
}: Props) {
  const toast = useToast();

  const [open, setOpen] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  function reset() {
    setOpen(false);
    setQuantities({});
    setReason("");
  }

  // سعر الوحدة من السطر نفسه، مش من التسعيرة الحالية - الفاتورة
  // اتباعت بسعر وقتها.
  function unitPrice(line: Line) {
    return line.quantity > 0 ? line.total / line.quantity : 0;
  }

  const chosen = lines
    .map((line) => ({
      line,
      quantity: Number(quantities[line.item_id] ?? ""),
    }))
    .filter(
      (entry) =>
        Number.isFinite(entry.quantity) &&
        entry.quantity > 0 &&
        entry.quantity <= entry.line.quantity
    );

  const refund = chosen.reduce(
    (sum, entry) => sum + entry.quantity * unitPrice(entry.line),
    0
  );

  // كمية مكتوبة أكبر من المباع: بنمنع الإرسال ونقول ليه. القاعدة
  // بترفضها كمان، بس رسالة قبل الدوسة أنفع من رسالة بعدها.
  const tooMany = lines.some((line) => {
    const value = Number(quantities[line.item_id] ?? "");

    return Number.isFinite(value) && value > line.quantity;
  });

  async function run() {
    if (chosen.length === 0) {
      toast.error("اكتب الكمية اللي راجعة");
      return;
    }

    setBusy(true);

    try {
      const amount = await returnSaleLines(
        saleId,
        chosen.map((entry) => ({
          itemId: entry.line.item_id,
          quantity: entry.quantity,
        })),
        reason
      );

      toast.success(`اترجّع ${amount.toFixed(2)} ج والبضاعة رجعت للمخزون`);

      reset();
      onReturned();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر عمل المرتجع");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 flex items-center gap-2 rounded-lg border border-ink-600 px-3 py-2 text-xs font-semibold text-mist transition hover:border-splash hover:text-paper"
      >
        <Undo2 size={14} />
        مرتجع من الفاتورة دي
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-splash/40 bg-ink-900 p-4">
      <h4 className="mb-1 flex items-center gap-2 text-sm font-bold text-paper">
        <Undo2 size={15} />
        إيه اللي راجع؟
      </h4>

      <p className="mb-3 text-xs text-mist">
        اكتب الكمية الراجعة قدام الصنف. سيب الباقي فاضي.
      </p>

      <div className="mb-3 space-y-2">
        {lines.map((line) => (
          <div
            key={line.item_id}
            className="flex items-center justify-between gap-3"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm text-paper">
                {line.items?.name ?? "صنف محذوف"}
              </span>

              <span className="block text-xs text-mist">
                اتباع {line.quantity} {line.items?.unit ?? ""} ·{" "}
                {unitPrice(line).toFixed(2)} ج للوحدة
              </span>
            </span>

            <input
              type="number"
              inputMode="decimal"
              min={0}
              max={line.quantity}
              value={quantities[line.item_id] ?? ""}
              onChange={(e) =>
                setQuantities((current) => ({
                  ...current,
                  [line.item_id]: e.target.value,
                }))
              }
              placeholder="0"
              className="w-20 shrink-0 rounded-lg border border-ink-600 bg-ink-950 p-2 text-center text-sm text-paper outline-none focus:border-splash"
            />
          </div>
        ))}
      </div>

      {tooMany && (
        <p className="mb-3 text-xs font-semibold text-red-400">
          فيه كمية أكبر من اللي اتباع فعلًا.
        </p>
      )}

      <input
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="السبب (اختياري) — مثلاً: الصنف بايظ"
        className="mb-3 w-full rounded-lg border border-ink-600 bg-ink-950 p-3 text-sm text-paper outline-none"
      />

      {refund > 0 && (
        <p className="mb-3 rounded-lg bg-ink-800 p-3 text-sm text-mist">
          هترجّع للزبون{" "}
          <span className="font-bold text-paper">{refund.toFixed(2)} ج</span>
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={run}
          disabled={busy || chosen.length === 0 || tooMany}
          className="flex-1 rounded-lg bg-splash p-3 text-sm font-bold text-ink-950 transition hover:opacity-90 disabled:opacity-40"
        >
          {busy ? "جارِ التسجيل..." : "أكّد المرتجع"}
        </button>

        <button
          type="button"
          onClick={reset}
          disabled={busy}
          className="rounded-lg bg-ink-700 px-4 text-sm font-semibold text-paper transition hover:bg-ink-600 disabled:opacity-50"
        >
          رجوع
        </button>
      </div>
    </div>
  );
}
