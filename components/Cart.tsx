import { Receipt as ReceiptIcon, Trash2, Banknote, Smartphone, CreditCard, CheckCircle2, Printer, NotebookPen, UserPlus, Plus, Minus, type LucideIcon } from "lucide-react";

import { stepFor, nextQuantity } from "@/lib/cartStep";

import type { Item } from "@/types/item";
import type { PaymentMethod } from "@/types/sale";
import type { Customer } from "@/types/customer";

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

  // زيادة/نقصان كمية سطر. اختيارية عشان الشاشات اللي بتعرض السلة
  // للقراءة بس (المعاينة، عرض السعر) ما تبقاش مضطرة تمرّرها.
  onStep?: (id: string, direction: 1 | -1) => void;
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
  paymentMethod,
  onPaymentMethodChange,
  maxDiscountPercent,
  discountAmount,
  onDiscountAmountChange,
  onDelete,
  onStep,
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
      <h2 className="mb-4 hidden items-center gap-2 text-2xl text-paper md:flex">
        <ReceiptIcon size={22} />
        السلة
      </h2>

      {cart.length === 0 ? (
        <p className="py-8 text-center text-mist">
          لا توجد أصناف في السلة
        </p>
      ) : (
        <>
          <div className="space-y-2">
            {cart.map((line) => (
              <div
                key={line.item.id}
                className="flex items-center gap-3 rounded-xl border border-ink-600 bg-ink-800 p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold text-paper">
                    {line.item.name}
                  </div>

                  <div className="text-sm text-mist">
                    {line.quantity.toFixed(2)} {line.item.unit}
                  </div>
                </div>

                {/* + و− على السطر نفسه.
                    قبل كده الكمية ماكانتش بتتعدّل خالص بعد الإضافة -
                    الزبون يقول "خليهم اتنين" فالكاشير يمسح السطر
                    ويدخّل الصنف من الأول. والخطوة حسب نوع البيع:
                    حبة للقطعة وربع كيلو للوزن (`lib/cartStep.ts`). */}
                {stepFor(line.item) !== null && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => onStep?.(line.item.id, -1)}
                      aria-label={`قلّل ${line.item.name}`}
                      disabled={nextQuantity(line.item, line.quantity, -1) === null}
                      className="flex size-11 items-center justify-center rounded-lg bg-ink-700 text-paper active:bg-ink-600 disabled:opacity-30 md:hover:bg-ink-600"
                    >
                      <Minus size={16} />
                    </button>

                    <button
                      onClick={() => onStep?.(line.item.id, 1)}
                      aria-label={`زوّد ${line.item.name}`}
                      className="flex size-11 items-center justify-center rounded-lg bg-ink-700 text-paper active:bg-ink-600 md:hover:bg-ink-600"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                )}

                <div className="shrink-0 font-bold text-green-400">
                  {line.total.toFixed(2)} ج
                </div>

                {/* Was a full-width red bar under every line, which on a
                    phone meant three lines filled the screen. Same job,
                    one row. */}
                <button
                  onClick={() => onDelete(line.item.id)}
                  aria-label={`حذف ${line.item.name}`}
                  className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-red-600/90 text-white active:bg-red-700 md:hover:bg-red-700"
                >
                  <Trash2 size={16} />
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
                    className={`flex min-h-12 items-center justify-center gap-1.5 rounded-xl p-3 text-sm font-semibold transition ${
                      paymentMethod === method.value
                        ? "bg-splash text-ink-950"
                        : "bg-ink-700 text-mist md:hover:bg-ink-600"
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
            className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-green-600 p-4 text-lg font-bold text-white active:bg-green-700 md:hover:bg-green-700"
          >
            <CheckCircle2 size={20} />
            إنهاء الفاتورة · {finalTotal.toFixed(2)} ج
          </button>

          {onPrintQuote && (
            <button
              onClick={onPrintQuote}
              className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-ink-600 p-3 text-sm text-mist transition md:hover:text-paper"
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
