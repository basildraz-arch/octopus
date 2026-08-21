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

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-ink-600 bg-ink-800 p-6">
        <h2 className="mb-1 text-xl font-bold text-paper">
          {item.name}
        </h2>

        <p className="mb-6 text-sm text-mist">
          {unitPrice} جنيه / {item.unit}
        </p>

        <label className="mb-2 block text-sm text-mist">
          {LABELS[item.sale_method]}
          {item.sale_method === "weight" ? ` (${item.unit})` : ""}
        </label>

        <input
          type="number"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={item.sale_method === "piece" ? "1" : "0"}
          className="mb-4 w-full rounded-xl border border-ink-600 bg-ink-900 p-4 text-paper outline-none"
        />

        <button
          onClick={handleAdd}
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 p-4 font-bold text-white hover:bg-green-700"
        >
          <Plus size={18} />
          إضافة للسلة
        </button>

        <button
          onClick={onClose}
          className="w-full rounded-xl bg-ink-700 p-4 text-paper hover:bg-ink-600"
        >
          إلغاء
        </button>
      </div>
    </div>
  );
}
