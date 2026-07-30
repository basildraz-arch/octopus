"use client";

import type { CartItem } from "@/components/Cart";

type Props = {
  cart: CartItem[];
  total: number;
  createdAt: Date;
  onClose: () => void;
};

export default function Receipt({
  cart,
  total,
  createdAt,
  onClose,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 print:static print:bg-white print:p-0">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-gray-900 print:max-w-full print:rounded-none print:shadow-none">

        <div className="mb-4 text-center">
          <h2 className="text-xl font-bold">
            🐙 Octopus
          </h2>

          <p className="text-sm text-gray-500">
            {createdAt.toLocaleString("ar-EG")}
          </p>
        </div>

        <div className="space-y-2 border-y border-dashed border-gray-300 py-4">
          {cart.map((line) => (
            <div
              key={line.item.id}
              className="flex justify-between text-sm"
            >
              <span>
                {line.item.name} × {line.quantity.toFixed(2)}
              </span>

              <span>
                {line.total.toFixed(2)}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 flex justify-between text-lg font-bold">
          <span>الإجمالي</span>
          <span>{total.toFixed(2)} جنيه</span>
        </div>

        <div className="mt-6 flex gap-2 print:hidden">
          <button
            onClick={() => window.print()}
            className="flex-1 rounded-xl bg-blue-600 p-3 font-bold text-white hover:bg-blue-700"
          >
            🖨️ طباعة
          </button>

          <button
            onClick={onClose}
            className="flex-1 rounded-xl bg-gray-200 p-3 font-bold text-gray-800 hover:bg-gray-300"
          >
            إغلاق
          </button>
        </div>

      </div>
    </div>
  );
}
