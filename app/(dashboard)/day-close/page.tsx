"use client";

import { useEffect, useState } from "react";
import {
  Lock,
  RotateCcw,
  Banknote,
  Smartphone,
  CreditCard,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";

import {
  getOpenShift,
  getLastShift,
  closeShift,
  reopenShift,
  getShiftSummary,
  type Shift,
  type ShiftSummary,
} from "@/repositories/shift.repository";
import { useSession } from "@/hooks/useSession";
import { useToast } from "@/hooks/useToast";

const PAYMENT_METHOD_INFO: Record<string, { label: string; icon: LucideIcon }> = {
  cash: { label: "كاش", icon: Banknote },
  vodafone_cash: { label: "فودافون كاش", icon: Smartphone },
  instapay: { label: "إنستاباي", icon: CreditCard },
};

export default function DayClosePage() {
  const { user } = useSession();
  const toast = useToast();

  const [shift, setShift] = useState<Shift | null>(null);
  const [summary, setSummary] = useState<ShiftSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [countedCash, setCountedCash] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [reopening, setReopening] = useState(false);

  useEffect(() => {
    if (!user) return;

    load();
  }, [user]);

  async function load() {
    if (!user) return;

    setLoading(true);

    const open = await getOpenShift(user.business_id);
    const current = open ?? (await getLastShift(user.business_id));

    setShift(current);

    if (current) {
      const s = await getShiftSummary(current.id);
      setSummary(s);
    } else {
      setSummary(null);
    }

    setLoading(false);
  }

  async function handleClose() {
    if (!user || !shift) return;

    setClosing(true);

    try {
      const cashValue =
        countedCash.trim() === "" ? undefined : Number(countedCash);

      await closeShift(shift.id, user.id, cashValue);

      setConfirming(false);
      setCountedCash("");

      await load();
    } catch (err) {
      console.error(err);
      toast.error("حدث خطأ أثناء إنهاء اليوم");
    } finally {
      setClosing(false);
    }
  }

  async function handleReopen() {
    if (!shift) return;

    setReopening(true);

    try {
      await reopenShift(shift.id);

      await load();
    } catch (err) {
      console.error(err);
      toast.error("حدث خطأ أثناء إعادة فتح اليوم");
    } finally {
      setReopening(false);
    }
  }

  if (loading) {
    return (
      <main className="p-8 text-center text-mist">
        جارِ التحميل...
      </main>
    );
  }

  if (!shift || !summary) {
    return (
      <main className="space-y-6">
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <Lock size={28} />
          إنهاء اليوم
        </h1>

        <div className="rounded-xl border border-ink-600 bg-ink-800 p-8 text-center text-mist">
          لسه مفيش أي مبيعات النهاردة.
        </div>
      </main>
    );
  }

  const isOpen = shift.closed_at === null;

  const difference =
    shift.counted_cash !== null
      ? shift.counted_cash - summary.expectedCash
      : null;

  return (
    <main className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <Lock size={28} />
          إنهاء اليوم
        </h1>

        <p className="mt-1 text-mist">
          {isOpen
            ? "اليوم مفتوح دلوقتي"
            : `اتقفل ${new Date(shift.closed_at as string).toLocaleString("ar-EG")}`}
        </p>
      </div>

      <div className="rounded-xl border border-ink-600 bg-ink-800 p-5">
        <p className="text-sm text-mist">
          إجمالي المبيعات
        </p>

        <h2 className="mt-2 text-4xl font-bold text-green-400">
          {summary.totalSales.toFixed(2)} ج
        </h2>

        <p className="mt-1 text-sm text-mist">
          {summary.saleCount} عملية بيع
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Object.entries(summary.byPaymentMethod).map(([method, amount]) => {
          const info = PAYMENT_METHOD_INFO[method];
          const Icon = info?.icon;

          return (
            <div
              key={method}
              className="rounded-xl border border-ink-600 bg-ink-800 p-4"
            >
              <p className="flex items-center gap-1.5 text-sm text-mist">
                {Icon && <Icon size={14} />}
                {info?.label ?? method}
              </p>

              <p className="mt-1 text-xl font-bold">
                {amount.toFixed(2)} ج
              </p>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-ink-600 bg-ink-800 p-5">
        <p className="text-sm text-mist">
          إجمالي المصروفات
        </p>

        <p className="mt-1 text-2xl font-bold text-red-400">
          {summary.totalExpenses.toFixed(2)} ج
        </p>
      </div>

      <div className="rounded-xl border border-ink-600 bg-ink-800 p-5">
        <p className="text-sm text-mist">
          الكاش المتوقع في الدرج
        </p>

        <p className="mt-1 text-2xl font-bold">
          {summary.expectedCash.toFixed(2)} ج
        </p>

        <p className="mt-1 text-xs text-mist">
          (مبيعات الكاش − المصروفات)
        </p>
      </div>

      {isOpen ? (
        <>
          {!confirming ? (
            <button
              onClick={() => setConfirming(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 p-4 text-lg font-bold text-white hover:bg-red-700"
            >
              <Lock size={20} />
              إنهاء اليوم
            </button>
          ) : (
            <div className="space-y-4 rounded-xl border border-red-800 bg-red-950/30 p-5">
              <p className="font-semibold text-red-300">
                متأكد إنك عايز تقفل اليوم؟
              </p>

              <div>
                <label className="mb-2 block text-sm text-mist">
                  الكاش الفعلي في الدرج (اختياري)
                </label>

                <input
                  type="number"
                  value={countedCash}
                  onChange={(e) => setCountedCash(e.target.value)}
                  placeholder={summary.expectedCash.toFixed(2)}
                  className="w-full rounded-xl border border-ink-600 bg-ink-900 p-3 text-paper outline-none"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleClose}
                  disabled={closing}
                  className="flex-1 rounded-xl bg-red-600 p-3 font-bold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {closing ? "جارِ القفل..." : "تأكيد القفل"}
                </button>

                <button
                  onClick={() => setConfirming(false)}
                  className="flex-1 rounded-xl bg-ink-700 p-3 font-bold text-paper hover:bg-ink-600"
                >
                  إلغاء
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-xl border border-ink-600 bg-ink-800 p-5">
          <p className="text-sm text-mist">
            الكاش الفعلي المدخل
          </p>

          <p className="mt-1 text-2xl font-bold">
            {shift.counted_cash !== null
              ? `${shift.counted_cash.toFixed(2)} ج`
              : "لم يُدخل"}
          </p>

          {difference !== null && (
            <p
              className={`mt-2 flex items-center gap-1.5 text-sm font-semibold ${
                difference === 0
                  ? "text-green-400"
                  : difference > 0
                  ? "text-splash"
                  : "text-red-400"
              }`}
            >
              {difference === 0 ? (
                <>
                  <CheckCircle2 size={16} />
                  مطابق تمامًا
                </>
              ) : difference > 0 ? (
                `زيادة ${difference.toFixed(2)} ج`
              ) : (
                `عجز ${Math.abs(difference).toFixed(2)} ج`
              )}
            </p>
          )}
        </div>
      )}

      {!isOpen && (
        <button
          onClick={handleReopen}
          disabled={reopening}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-ink-700 p-4 text-lg font-bold text-paper hover:bg-ink-600 disabled:opacity-50"
        >
          {reopening ? (
            "جارِ إعادة الفتح..."
          ) : (
            <>
              <RotateCcw size={18} />
              إعادة فتح اليوم
            </>
          )}
        </button>
      )}
    </main>
  );
}
