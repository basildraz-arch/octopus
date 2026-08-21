"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import type { Item } from "@/types/item";
import { priceForTier, type PriceTier } from "@/lib/priceTier";

type Props = {
  item: Item | null;
  onClose: () => void;
  onAdd: (quantity: number, total: number) => void;
  priceTier?: PriceTier;
};

const LABELS: Record<Item["sale_method"], string> = {
  piece: "الكمية",
  weight: "الوزن",
  money: "المبلغ",
};

export default function SalePopup({
  item,
  onClose,
  onAdd,
  priceTier = 1,
}: Props) {
  const [value, setValue] = useState("");

  if (!item) {
    return null;
  }

  // Same price the list showed and the same one the sale will store.
  const unitPrice = priceForTier(item, priceTier);

  function handleAdd() {
    const number = Number(value);

    if (!item || number <= 0) return;

    if (item.sale_method === "money") {
      onAdd(number / unitPrice, number);
    } else {
      onAdd(number, number * unitPrice);
    }

    setValue("");
    onClose();
  }

  const typed = Number(value);
  const lineTotal =
    !value || Number.isNaN(typed) || typed <= 0
      ? null
      : item.sale_method === "money"
        ? typed
        : typed * unitPrice;

  return (
    // z-[60] and not "no z-index at all", which is what this was.
    // The item list's search bar is sticky at z-20, so this dialog was
    // opening UNDERNEATH it: the search box and the microphone painted
    // straight over the quantity field, and the middle of the dialog
    // looked empty. Every other overlay in the app already sets one
    // (receipt 50, assistant 51, toasts 100) - this was the only one
    // that did not.
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        // Stops a tap inside the dialog from reaching the backdrop and
        // closing it.
        onClick={(e) => e.stopPropagation()}
        className="w-full rounded-t-3xl border border-ink-600 bg-ink-800 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:max-w-sm sm:rounded-2xl sm:pb-5"
      >
        <h2 className="mb-1 text-xl font-bold text-paper">
          {item.name}
        </h2>

        <p className="mb-5 text-sm text-mist">
          {unitPrice} جنيه / {item.unit}
        </p>

        <label className="mb-2 block text-sm text-mist">
          {LABELS[item.sale_method]}
          {item.sale_method === "weight" ? ` (${item.unit})` : ""}
        </label>

        <input
          // inputMode brings up the number pad on a phone instead of
          // the full keyboard - the difference between one tap and
          // three at a busy till.
          type="number"
          inputMode="decimal"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
          placeholder={item.sale_method === "piece" ? "1" : "0"}
          className="mb-3 min-h-14 w-full rounded-xl border border-ink-600 bg-ink-950 p-4 text-lg text-paper outline-none focus:border-splash"
        />

        {/* What this line will cost, before committing to it. */}
        <p className="mb-4 min-h-6 text-sm text-mist">
          {lineTotal !== null && (
            <>
              الإجمالي{" "}
              <span className="font-bold text-splash">
                {lineTotal.toFixed(2)} ج
              </span>
            </>
          )}
        </p>

        <button
          onClick={handleAdd}
          className="mb-2 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-green-600 p-4 font-bold text-white active:bg-green-700 md:hover:bg-green-700"
        >
          <Plus size={18} />
          إضافة للسلة
        </button>

        <button
          onClick={onClose}
          className="min-h-12 w-full rounded-xl bg-ink-700 p-3 text-paper active:bg-ink-600 md:hover:bg-ink-600"
        >
          إلغاء
        </button>
      </div>
    </div>
  );
}
