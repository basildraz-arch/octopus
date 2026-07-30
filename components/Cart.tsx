import type { Item } from "@/types/item";

export type CartItem = {
  item: Item;
  quantity: number;
  total: number;
};

type Props = {
  cart: CartItem[];
  onDelete: (id: string) => void;
  onCheckout: () => void;
};

export default function Cart({
  cart,
  onDelete,
  onCheckout,
}: Props) {
  const grandTotal = cart.reduce(
    (sum, line) => sum + line.total,
    0
  );

  return (
    <div>
      <h2 className="mb-4 text-2xl text-white">
        🧾 السلة
      </h2>

      {cart.length === 0 ? (
        <p className="text-gray-500">
          لا توجد أصناف في السلة
        </p>
      ) : (
        <>
          <div className="space-y-3">
            {cart.map((line) => (
              <div
                key={line.item.id}
                className="rounded-xl bg-gray-800 p-4"
              >
                <div className="font-bold text-white">
                  {line.item.name}
                </div>

                <div className="text-gray-400">
                  الكمية: {line.quantity.toFixed(2)} {line.item.unit}
                </div>

                <div className="mb-3 font-bold text-green-400">
                  {line.total.toFixed(2)} جنيه
                </div>

                <button
                  onClick={() => onDelete(line.item.id)}
                  className="w-full rounded-lg bg-red-600 p-2 hover:bg-red-700"
                >
                  🗑️ حذف
                </button>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-xl bg-blue-700 p-4 text-xl font-bold text-white">
            الإجمالي: {grandTotal.toFixed(2)} جنيه
          </div>

          <button
            onClick={onCheckout}
            className="mt-4 w-full rounded-xl bg-green-600 p-4 text-lg font-bold text-white hover:bg-green-700"
          >
            ✅ إنهاء الفاتورة
          </button>
        </>
      )}
    </div>
  );
}
