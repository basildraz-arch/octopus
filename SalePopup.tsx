"use client";

import { useState } from "react";

type Product = {
  id: number;
  name: string;
  price: number;
  unit: string;
  sellBy: string[];
};

type Props = {
  product: Product | null;
  onClose: () => void;
};

export default function SalePopup({
  product,
  onClose,
}: Props) {
  const [mode, setMode] = useState<"menu" | "money" | "weight">("menu");
  const [money, setMoney] = useState("");

  if (!product) return null;

  function addMoneySale() {
    alert(
      `سيتم بيع ${product.name} بمبلغ ${money} جنيه`
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center">

      <div className="bg-gray-900 rounded-2xl p-8 w-[400px]">

        {mode === "menu" && (
          <>
            <h2 className="text-2xl font-bold mb-2">
              {product.name}
            </h2>

            <p className="text-gray-400 mb-6">
              اختر طريقة البيع
            </p>

            <button
              onClick={() => setMode("weight")}
              className="w-full bg-blue-600 hover:bg-blue-700 rounded-xl p-4 mb-4"
            >
              ⚖️ بيع بالكيلو
            </button>

            <button
              onClick={() => setMode("money")}
              className="w-full bg-green-600 hover:bg-green-700 rounded-xl p-4 mb-4"
            >
              💰 بيع بالمبلغ
            </button>

            <button
              onClick={onClose}
              className="w-full bg-gray-700 hover:bg-gray-600 rounded-xl p-4"
            >
              ❌ إلغاء
            </button>
          </>
        )}

        {mode === "money" && (
          <>
            <h2 className="text-2xl font-bold mb-6">
              💰 أدخل المبلغ
            </h2>

            <input
              type="number"
              value={money}
              onChange={(e) => setMoney(e.target.value)}
              placeholder="مثال: 20"
              className="w-full rounded-xl bg-gray-800 p-4 mb-4 outline-none"
            />

            <button
              onClick={addMoneySale}
              className="w-full bg-green-600 hover:bg-green-700 rounded-xl p-4 mb-3"
            >
              إضافة
            </button>

            <button
              onClick={() => setMode("menu")}
              className="w-full bg-gray-700 hover:bg-gray-600 rounded-xl p-4"
            >
              رجوع
            </button>
          </>
        )}

        {mode === "weight" && (
          <>
            <h2 className="text-2xl font-bold mb-6">
              ⚖️ أدخل الوزن
            </h2>

            <input
              type="number"
              placeholder="مثال: 0.5"
              className="w-full rounded-xl bg-gray-800 p-4 mb-4 outline-none"
            />

            <button
              className="w-full bg-blue-600 hover:bg-blue-700 rounded-xl p-4 mb-3"
            >
              إضافة
            </button>

            <button
              onClick={() => setMode("menu")}
              className="w-full bg-gray-700 hover:bg-gray-600 rounded-xl p-4"
            >
              رجوع
            </button>
          </>
        )}

      </div>

    </div>
  );
}