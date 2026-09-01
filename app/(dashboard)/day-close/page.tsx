"use client";

import { useEffect, useState } from "react";
import {
  Lock,
  ArrowLeftRight,
  RotateCcw,
  Banknote,
  Smartphone,
  CreditCard,
  CheckCircle2,
  NotebookPen,
  type LucideIcon,
} from "lucide-react";

import {
  getOpenShift,
  getLastShift,
  closeShift,
  reopenShift,
  handoverShift,
  getShiftSummary,
  type Shift,
  type ShiftSummary,
} from "@/repositories/shift.repository";
import { useSession } from "@/hooks/useSession";
import PrintReport from "@/components/reports/PrintReport";
import { useToast } from "@/hooks/useToast";

const PAYMENT_METHOD_INFO: Record<string, { label: string; icon: LucideIcon }> = {
  cash: { label: "كاش", icon: Banknote },
  vodafone_cash: { label: "فودافون كاش", icon: Smartphone },
  instapay: { label: "إنستاباي", icon: CreditCard },
  // Sold but not paid for yet, so it is shown alongside the others
  // and pointedly NOT counted as cash in the drawer.
  credit: { label: "على الحساب (لسه ما اتدفعش)", icon: NotebookPen },
};

export default function DayClosePage() {
  const { user, business } = useSession();
  const toast = useToast();

  const [shift, setShift] = useState<Shift | null>(null);
  const [summary, setSummary] = useState<ShiftSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [handing, setHanding] = useState(false);
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
      toast.error("حدث خطأ أثناء قفل الدرج");
    } finally {
      setClosing(false);
    }
  }

  // تسليم لزميل: قفل بجرد + فتح وردية جديدة في **عملية واحدة**
  // جوه القاعدة (`handover_shift`، ميجريشن ٠٨٧). لو اتعملوا نداءين
  // والتاني فشل، المحل يفضل من غير وردية والبيعة الجاية تتعلّق.
  //
  // والجرد إجباري هنا وهو اختياري في القفل: قفل من غير عدّ = صاحب
  // المحل هيعدّ بنفسه بعدين. تسليم من غير عدّ = **مفيش تسليم
  // أصلًا** - الفرق اللي هيطلع بكرة مش هيبقى معروف من نوبة مين.
  async function handleHandover() {
    const value = Number(countedCash);

    if (countedCash.trim() === "" || !Number.isFinite(value) || value < 0) {
      toast.error("اكتب الكاش اللي عدّيته في الدرج الأول");
      return;
    }

    setHanding(true);

    try {
      await handoverShift(value);

      toast.success("الوردية اتسلّمت — وردية جديدة اتفتحت");

      setConfirming(false);
      setCountedCash("");

      await load();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "تعذر تسليم الوردية"
      );
    } finally {
      setHanding(false);
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
      toast.error("حدث خطأ أثناء إعادة فتح الدرج");
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
          تقفيل الدرج
        </h1>

        <div className="rounded-xl border border-ink-600 bg-ink-800 p-8 text-center text-mist">
          لسه مفيش أي مبيعات النهاردة.
        </div>
      </main>
    );
  }

  const isOpen = shift.closed_at === null;
  const busy = closing || handing;

  // الفرق بين اللي اتعدّ واللي المفروض يكون، وقت الكتابة.
  const typedCash = Number(countedCash);
  const countedDiff =
    countedCash.trim() !== "" && Number.isFinite(typedCash)
      ? typedCash - summary.expectedCash
      : null;

  const difference =
    shift.counted_cash !== null
      ? shift.counted_cash - summary.expectedCash
      : null;

  // تاريخ الوردية بصيغة `<input type="date">` عشان الترويسة.
  const shiftDay = (value: string) => value.slice(0, 10);

  return (
    <main className="space-y-6" data-print-area>
      {/* تقرير الوردية بيتطبع وقت التسليم أو القفل - الورقة بتتحط
          في الدرج مع الكاش. */}
      <PrintReport
        title="تقرير الوردية"
        from={shiftDay(shift.opened_at)}
        to={shiftDay(shift.closed_at ?? new Date().toISOString())}
        businessName={business?.name}
      />

      <div className="print-hide">
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <Lock size={28} />
          تقفيل الدرج
        </h1>

        <p className="mt-1 text-mist">
          {isOpen
            ? "الدرج مفتوح دلوقتي"
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

      {summary.customerPaymentsCash + summary.customerPaymentsOther > 0 && (
        <div className="rounded-xl border border-ink-600 bg-ink-800 p-5">
          <p className="text-sm text-mist">
            تحصيل من حسابات العملاء النهارده
          </p>

          <p className="mt-1 text-2xl font-bold text-green-400">
            {(
              summary.customerPaymentsCash + summary.customerPaymentsOther
            ).toFixed(2)}{" "}
            ج
          </p>

          <p className="mt-1 text-xs text-mist">
            منها {summary.customerPaymentsCash.toFixed(2)} ج كاش (داخلة في
            حساب الدرج)
          </p>
        </div>
      )}

      <div className="rounded-xl border border-ink-600 bg-ink-800 p-5">
        <p className="text-sm text-mist">
          الكاش المتوقع في الدرج
        </p>

        <p className="mt-1 text-2xl font-bold">
          {summary.expectedCash.toFixed(2)} ج
        </p>

        <p className="mt-1 text-xs text-mist">
          (مبيعات الكاش + تحصيل العملاء كاش − المصروفات)
        </p>
      </div>

      {/* ============================================================
          خطوة واحدة، وسؤال واحد في الآخر
          ============================================================

          كان هنا زرارين منفصلين: «إنهاء اليوم» و«سلّم الوردية
          لزميلك» - كل واحد بيفتح فورمة لوحده وبيطلب نفس الرقم.
          وباسل سأل السؤال الصح: **إيه الفرق أصلًا؟**

          مفيش فرق في اللي بيحصل للوردية الحالية. الاتنين بيقفلوها
          بجرد الدرج. الفرق الوحيد **بعد كده**: حد تاني هيقف على
          الكاشير دلوقتي، ولا خلاص المحل قفل؟

          فبقت خطوة واحدة: عدّ الدرج، وبعدين جاوب على السؤال ده.
          محل بموظف واحد بيدوس «خلاص قفلنا» كل يوم ومابيشوفش كلمة
          "وردية" في حياته. محل بيشتغل شيفتين بيدوس «زميلي هيكمّل»
          والوردية الجديدة بتتفتح على طول. */}
      {isOpen ? (
        <div className="print-hide">
          {!confirming ? (
            <button
              onClick={() => setConfirming(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 p-4 text-lg font-bold text-white hover:bg-red-700"
            >
              <Lock size={20} />
              تقفيل الدرج
            </button>
          ) : (
            <div className="space-y-4 rounded-xl border border-ink-600 bg-ink-800 p-5">
              <div>
                <label className="mb-2 block font-semibold text-paper">
                  عدّ الفلوس اللي في الدرج واكتب الرقم
                </label>

                <input
                  type="number"
                  inputMode="decimal"
                  value={countedCash}
                  onChange={(e) => setCountedCash(e.target.value)}
                  placeholder={summary.expectedCash.toFixed(2)}
                  autoFocus
                  className="w-full rounded-xl border border-ink-600 bg-ink-900 p-3 text-lg text-paper outline-none"
                />

                <p className="mt-1 text-xs text-mist">
                  المفروض يكون {summary.expectedCash.toFixed(2)} ج
                </p>

                {/* الفرق بيبان قبل التأكيد مش بعده. اللي هيلاقي
                    عجز ٢٠٠ ج المفروض يعدّ تاني دلوقتي، مش يكتشفه
                    بكرة من تقرير. */}
                {countedDiff !== null && Math.abs(countedDiff) >= 0.01 && (
                  <p
                    className={`mt-2 text-sm font-semibold ${
                      countedDiff < 0 ? "text-red-400" : "text-amber-300"
                    }`}
                  >
                    {countedDiff < 0
                      ? `عجز ${Math.abs(countedDiff).toFixed(2)} ج`
                      : `زيادة ${countedDiff.toFixed(2)} ج`}
                  </p>
                )}
              </div>

              <div className="border-t border-ink-600 pt-4">
                <p className="mb-3 font-semibold text-paper">
                  ومين هيقف على الكاشير دلوقتي؟
                </p>

                <div className="space-y-2">
                  {/* التسليم فوق: هو الحالة اللي بتتكرر أكتر في
                      محل بيشتغل شيفتين، والقفل بيحصل مرة في اليوم. */}
                  <button
                    onClick={handleHandover}
                    disabled={busy}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-splash p-4 font-bold text-ink-950 transition hover:opacity-90 disabled:opacity-50"
                  >
                    <ArrowLeftRight size={18} />
                    {handing ? "جارِ التسليم..." : "زميلي هيكمّل بعدي"}
                  </button>

                  <button
                    onClick={handleClose}
                    disabled={busy}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 p-4 font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
                  >
                    <Lock size={18} />
                    {closing ? "جارِ القفل..." : "خلاص قفلنا المحل"}
                  </button>
                </div>

                <p className="mt-3 text-xs text-mist">
                  «زميلي هيكمّل» بيقفل نوبتك ويفتح وردية جديدة على
                  طول، عشان اللي بعدك يبدأ من درج معدود. «قفلنا
                  المحل» بيقفل وخلاص.
                </p>
              </div>

              <button
                onClick={() => setConfirming(false)}
                disabled={busy}
                className="w-full rounded-xl bg-ink-700 p-3 font-semibold text-paper hover:bg-ink-600 disabled:opacity-50"
              >
                رجوع
              </button>
            </div>
          )}
        </div>
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
