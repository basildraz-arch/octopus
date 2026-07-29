"use client";

import { useState } from "react";
import type { Product } from "@/data/products";

type Props = {
  product: Product | null;
  onClose: () => void;
  onAdd: (quantity: number, total: number) => void;
};

export default function SalePopup({
  product,
  onClose,
  onAdd,
}: Props) {
  const [mode, setMode] = useState<"menu" | "money" | "weight">("menu");
  const [value, setValue] = useState("");

  if (!product) {
    return null;
  }

  // نخزن المنتج في متغير جديد
  const currentProduct = product;

  function addSale() {
    const number = Number(value);

    if (number <= 0) return;

    if (mode === "money") {
      onAdd(number / currentProduct.price, number);
    } else {
      onAdd(number, number * currentProduct.price);
    }

    setValue("");
    setMode("menu");
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center">
      <div className="bg-gray-900 rounded-2xl p-8 w-[400px]">
        {mode === "menu" ? (
          <>
            <h2 className="text-2xl font-bold mb-2">
              {currentProduct.name}
            </h2>

            <p className="text-gray-400 mb-6">
              اختر طريقة البيع
            </p>

            <button
              onClick={() => setMode("weight")}
              className="w-full bg-blue-600 rounded-xl p-4 mb-4"
            >
              ⚖️ بيع بالكيلو
            </button>

            <button
              onClick={() => setMode("money")}
              className="w-full bg-green-600 rounded-xl p-4 mb-4"
            >
              💰 بيع بالمبلغ
            </button>

            <button
              onClick={onClose}
              className="w-full bg-gray-700 rounded-xl p-4"
            >
              إلغاء
            </button>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold mb-6">
              {mode === "money"
                ? "💰 أدخل المبلغ"
                : "⚖️ أدخل الوزن"}
            </h2>

            <input
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full rounded-xl bg-gray-800 p-4 mb-4 outline-none"
            />

            <button
              onClick={addSale}
              className="w-full bg-green-600 rounded-xl p-4 mb-3"
            >
              إضافة
            </button>

            <button
              onClick={() => setMode("menu")}
              className="w-full bg-gray-700 rounded-xl p-4"
            >
              رجوع
            </button>
          </>
        )}
      </div>
    </div>
  );
}