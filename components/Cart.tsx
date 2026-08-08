import type { Item } from "@/types/item";
import type { PaymentMethod } from "@/types/sale";

export type CartItem = {
  item: Item;
  quantity: number;
  total: number;
};

type Props = {
  cart: CartItem[];
  paymentMethod: PaymentMethod;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  maxDiscountPercent: number | null;
  discountAmount: string;
  onDiscountAmountChange: (value: string) => void;
  onDelete: (id: string) => void;
  onCheckout: () => void;
};

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "💵 كاش" },
  { value: "vodafone_cash", label: "📱 فودافون كاش" },
  { value: "instapay", label: "💳 إنستاباي" },
];

export default function Cart({
  cart,
  paymentMethod,
  onPaymentMethodChange,
  maxDiscountPercent,
  discountAmount,
  onDiscountAmountChange,
  onDelete,
  onCheckout,
}: Props) {
  const subtotal = cart.reduce(
    (sum, line) => sum + line.total,
    0
  );

  const discountValue = discountAmount === "" ? 0 : Number(discountAmount);
  const maxAllowedDiscount =
    maxDiscountPercent != null ? (subtotal * maxDiscountPercent) / 100 : 0;
  const finalTotal = subtotal - discountValue;

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

          {maxDiscountPercent != null && (
            <div className="mt-4">
              <p className="mb-2 text-sm text-gray-400">
                خصم على الفاتورة (اختياري) - أقصى خصم مسموح{" "}
                {maxAllowedDiscount.toFixed(2)} جنيه
              </p>

              <input
                type="number"
                value={discountAmount}
                onChange={(e) => onDiscountAmountChange(e.target.value)}
                placeholder="0"
                className="w-full rounded-xl bg-gray-800 p-4 text-white outline-none"
              />
            </div>
          )}

          <div className="mt-4 space-y-1 rounded-xl bg-gray-800/50 p-3 text-sm">
            <div className="flex justify-between text-gray-400">
              <span>الإجمالي قبل الخصم</span>
              <span>{subtotal.toFixed(2)} جنيه</span>
            </div>

            {discountValue > 0 && (
              <div className="flex justify-between text-gray-400">
                <span>الخصم</span>
                <span>{discountValue.toFixed(2)} جنيه</span>
              </div>
            )}

            <div className="flex justify-between border-t border-gray-700 pt-1 text-lg font-bold text-white">
              <span>الإجمالي النهائي</span>
              <span>{finalTotal.toFixed(2)} جنيه</span>
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-sm text-gray-400">
              طريقة الدفع
            </p>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {PAYMENT_METHODS.map((method) => (
                <button
                  key={method.value}
                  onClick={() => onPaymentMethodChange(method.value)}
                  className={`rounded-xl p-3 text-sm font-semibold transition ${
                    paymentMethod === method.value
                      ? "bg-blue-600 text-white"
                      : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                  }`}
                >
                  {method.label}
                </button>
              ))}
            </div>
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
