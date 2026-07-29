import type { Product } from "@/data/products";

export type CartItem = {
  product: Product;
  quantity: number;
  total: number;
};

type Props = {
  cart: CartItem[];
  onDelete: (id: number) => void;
  onCheckout: () => void;
};

export default function Cart({
  cart,
  onDelete,
  onCheckout,
}: Props) {
  const grandTotal = cart.reduce(
    (sum, item) => sum + item.total,
    0
  );

  return (
    <div>
      <h2 className="text-2xl mb-4">
        🧾 السلة
      </h2>

      {cart.length === 0 ? (
        <p className="text-gray-500">
          لا توجد منتجات
        </p>
      ) : (
        <>
          <div className="space-y-3">
            {cart.map((item) => (
              <div
                key={item.product.id}
                className="rounded-xl bg-gray-800 p-4"
              >
                <div className="font-bold">
                  {item.product.name}
                </div>

                <div className="text-gray-400">
                  الكمية: {item.quantity.toFixed(2)} {item.product.unit}
                </div>

                <div className="text-green-400 font-bold mb-3">
                  {item.total.toFixed(2)} جنيه
                </div>

                <button
                  onClick={() => onDelete(item.product.id)}
                  className="w-full rounded-lg bg-red-600 hover:bg-red-700 p-2"
                >
                  🗑️ حذف
                </button>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-xl bg-blue-700 p-4 text-xl font-bold">
            الإجمالي: {grandTotal.toFixed(2)} جنيه
          </div>

          <button
            onClick={onCheckout}
            className="mt-4 w-full rounded-xl bg-green-600 hover:bg-green-700 p-4 text-lg font-bold"
          >
            ✅ إنهاء الفاتورة
          </button>
        </>
      )}
    </div>
  );
}