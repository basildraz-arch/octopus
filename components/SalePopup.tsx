"use client";

import { useState } from "react";
import type { Item } from "@/types/item";

type Props = {
  item: Item | null;
  onClose: () => void;
  onAdd: (quantity: number, total: number) => void;
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
}: Props) {
  const [value, setValue] = useState("");
  const [discount, setDiscount] = useState("");

  if (!item) {
    return null;
  }

  const hasFlexiblePrice = item.min_sell_price != null;
  const discountAmount = discount === "" ? 0 : Number(discount);
  const finalPrice = item.sell_price - discountAmount;
  const maxDiscount = hasFlexiblePrice
    ? item.sell_price - (item.min_sell_price as number)
    : 0;

  function handleAdd() {
    const number = Number(value);

    if (!item || number <= 0) return;

    let effectivePrice = item.sell_price;

    if (hasFlexiblePrice) {
      if (discountAmount < 0) {
        alert("الخصم لازم يكون رقم موجب");
        return;
      }

      if (finalPrice < (item.min_sell_price as number)) {
        alert(`أقصى خصم مسموح ${maxDiscount.toFixed(2)} جنيه`);
        return;
      }

      effectivePrice = finalPrice;
    }

    if (item.sale_method === "money") {
      onAdd(number / effectivePrice, number);
    } else {
      onAdd(number, number * effectivePrice);
    }

    setValue("");
    setDiscount("");
    onClose();
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-gray-900 p-6">
        <h2 className="mb-1 text-xl font-bold text-white">
          {item.name}
        </h2>

        <p className="mb-6 text-sm text-gray-400">
          {item.sell_price} جنيه / {item.unit}
        </p>

        {hasFlexiblePrice && (
          <>
            <label className="mb-2 block text-sm text-gray-300">
              خصم (اختياري) - أقصى خصم {maxDiscount.toFixed(2)} جنيه
            </label>

            <input
              type="number"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              placeholder="0"
              className="mb-3 w-full rounded-xl bg-gray-800 p-4 text-white outline-none"
            />

            <div className="mb-4 space-y-1 rounded-xl bg-gray-800/50 p-3 text-sm">
              <div className="flex justify-between text-gray-400">
                <span>السعر الأصلي</span>
                <span>{item.sell_price.toFixed(2)} جنيه</span>
              </div>

              <div className="flex justify-between text-gray-400">
                <span>الخصم</span>
                <span>{discountAmount.toFixed(2)} جنيه</span>
              </div>

              <div className="flex justify-between border-t border-gray-700 pt-1 font-bold text-white">
                <span>السعر النهائي</span>
                <span>{finalPrice.toFixed(2)} جنيه</span>
              </div>
            </div>
          </>
        )}

        <label className="mb-2 block text-sm text-gray-300">
          {LABELS[item.sale_method]}
          {item.sale_method === "weight" ? ` (${item.unit})` : ""}
        </label>

        <input
          type="number"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={item.sale_method === "piece" ? "1" : "0"}
          className="mb-4 w-full rounded-xl bg-gray-800 p-4 text-white outline-none"
        />

        <button
          onClick={handleAdd}
          className="mb-3 w-full rounded-xl bg-green-600 p-4 font-bold text-white hover:bg-green-700"
        >
          ➕ إضافة للسلة
        </button>

        <button
          onClick={onClose}
          className="w-full rounded-xl bg-gray-700 p-4 text-white hover:bg-gray-600"
        >
          إلغاء
        </button>
      </div>
    </div>
  );
}
