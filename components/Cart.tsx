import { Receipt as ReceiptIcon, Trash2, Banknote, Smartphone, CreditCard, CheckCircle2, Printer, NotebookPen, UserPlus, type LucideIcon } from "lucide-react";

import type { Item } from "@/types/item";
import type { PaymentMethod } from "@/types/sale";
import type { PriceTier } from "@/lib/priceTier";
import type { Customer } from "@/types/customer";

export type CartItem = {
  item: Item;
  quantity: number;
  total: number;
};

type Props = {
  cart: CartItem[];
  // Absent when the shop sells at a single price - the selector is
  // then never rendered at all, keeping the till as simple as before.
  priceTiers?: {
    labels: readonly string[];
    selected: PriceTier;
    onChange: (tier: PriceTier) => void;
  };
  paymentMethod: PaymentMethod;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  maxDiscountPercent: number | null;
  discountAmount: string;
  onDiscountAmountChange: (value: string) => void;
  onDelete: (id: string) => void;
  onCheckout: () => void;
  // Printing without selling - a price quote. Optional by design,
  // unlike the sale receipt which always prints.
  onPrintQuote?: () => void;
  // Present only when the shop runs tabs. Selecting a customer is what
  // makes "آجل" a legal payment method.
  credit?: {
    customers: Customer[];
    selectedCustomerId: string | null;
    onSelectCustomer: (id: string | null) => void;
    onAddCustomer: () => void;
  };
};

const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: LucideIcon }[] = [
  { value: "cash", label: "كاش", icon: Banknote },
  { value: "vodafone_cash", label: "فودافون كاش", icon: Smartphone },
  { value: "instapay", label: "إنستاباي", icon: CreditCard },
  { value: "credit", label: "على الحساب", icon: NotebookPen },
];

export default function Cart({
  cart,
  priceTiers,
  paymentMethod,
  onPaymentMethodChange,
  maxDiscountPercent,
  discountAmount,
  onDiscountAmountChange,
  onDelete,
  onCheckout,
  onPrintQuote,
  credit,
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
      <h2 className="mb-4 flex items-center gap-2 text-2xl text-paper">
        <ReceiptIcon size={22} />
        السلة
      </h2>

      {priceTiers && (
        <div className="mb-5">
          <p className="mb-2 text-sm text-mist">
            الزبون
          </p>

          <div className="grid grid-cols-3 gap-2">
            {priceTiers.labels.map((label, index) => {
              const tier = (index + 1) as PriceTier;
              const active = priceTiers.selected === tier;

              return (
                <button
                  key={label}
                  onClick={() => priceTiers.onChange(tier)}
                  className={`rounded-xl p-3 text-sm font-bold transition ${
                    active
                      ? "bg-splash text-ink-950"
                      : "bg-ink-700 text-mist hover:bg-ink-600"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {cart.length === 0 ? (
        <p className="text-mist">
          لا توجد أصناف في السلة
        </p>
      ) : (
        <>
          <div className="space-y-3">
            {cart.map((line) => (
              <div
                key={line.item.id}
                className="rounded-xl border border-ink-600 bg-ink-800 p-4"
              >
                <div className="font-bold text-paper">
                  {line.item.name}
                </div>

                <div className="text-mist">
                  الكمية: {line.quantity.toFixed(2)} {line.item.unit}
                </div>

                <div className="mb-3 font-bold text-green-400">
                  {line.total.toFixed(2)} جنيه
                </div>

                <button
                  onClick={() => onDelete(line.item.id)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-red-600 p-2 hover:bg-red-700"
                >
                  <Trash2 size={15} />
                  حذف
                </button>
              </div>
            ))}
          </div>

          {maxDiscountPercent != null && (
            <div className="mt-4">
              <p className="mb-2 text-sm text-mist">
                خصم على الفاتورة (اختياري) - أقصى خصم مسموح{" "}
                {maxAllowedDiscount.toFixed(2)} جنيه
              </p>

              <input
                type="number"
                value={discountAmount}
                onChange={(e) => onDiscountAmountChange(e.target.value)}
                placeholder="0"
                className="w-full rounded-xl border border-ink-600 bg-ink-800 p-4 text-paper outline-none"
              />
            </div>
          )}

          <div className="mt-4 space-y-1 rounded-xl bg-ink-800/50 p-3 text-sm">
            <div className="flex justify-between text-mist">
              <span>الإجمالي قبل الخصم</span>
              <span>{subtotal.toFixed(2)} جنيه</span>
            </div>

            {discountValue > 0 && (
              <div className="flex justify-between text-mist">
                <span>الخصم</span>
                <span>{discountValue.toFixed(2)} جنيه</span>
              </div>
            )}

            <div className="flex justify-between border-t border-ink-600 pt-1 text-lg font-bold text-paper">
              <span>الإجمالي النهائي</span>
              <span>{finalTotal.toFixed(2)} جنيه</span>
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-sm text-mist">
              طريقة الدفع
            </p>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {PAYMENT_METHODS.filter(
                (method) => method.value !== "credit" || credit
              ).map((method) => {
                const Icon = method.icon;

                return (
                  <button
                    key={method.value}
                    onClick={() => onPaymentMethodChange(method.value)}
                    className={`flex items-center justify-center gap-1.5 rounded-xl p-3 text-sm font-semibold transition ${
                      paymentMethod === method.value
                        ? "bg-splash text-ink-950"
                        : "bg-ink-700 text-mist hover:bg-ink-600"
                    }`}
                  >
                    <Icon size={16} />
                    {method.label}
                  </button>
                );
              })}
            </div>
          </div>

          {credit && paymentMethod === "credit" && (
            <div className="mt-3 rounded-xl border border-amber-800 bg-amber-950/20 p-3">
              <p className="mb-2 text-sm text-amber-400">
                على حساب مين؟
              </p>

              <select
                value={credit.selectedCustomerId ?? ""}
                onChange={(e) =>
                  credit.onSelectCustomer(e.target.value || null)
                }
                className="w-full rounded-xl border border-ink-600 bg-ink-900 p-3 text-paper outline-none"
              >
                <option value="">اختار العميل</option>

                {credit.customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                    {customer.phone ? ` - ${customer.phone}` : ""}
                  </option>
                ))}
              </select>

              <button
                onClick={credit.onAddCustomer}
                className="mt-2 flex items-center gap-1.5 text-xs text-mist hover:text-paper"
              >
                <UserPlus size={13} />
                عميل جديد
              </button>
            </div>
          )}

          <button
            onClick={onCheckout}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 p-4 text-lg font-bold text-white hover:bg-green-700"
          >
            <CheckCircle2 size={20} />
            إنهاء الفاتورة
          </button>

          {onPrintQuote && (
            <button
              onClick={onPrintQuote}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-ink-600 p-3 text-sm text-mist transition hover:text-paper"
            >
              <Printer size={16} />
              طباعة عرض سعر (من غير بيع)
            </button>
          )}
        </>
      )}
    </div>
  );
}
