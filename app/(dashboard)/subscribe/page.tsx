"use client";

import { useEffect, useState } from "react";
import { CreditCard } from "lucide-react";

import { useSession } from "@/hooks/useSession";
import { supabase } from "@/lib/supabase";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function daysRemaining(iso: string): number {
  const diffMs = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

export default function SubscribePage() {
  const { user, business, loading: sessionLoading } = useSession();

  const [priceEgp, setPriceEgp] = useState<number | null>(null);
  const [subtotal, setSubtotal] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  // The price is per shop now, so this call carries the session -
  // the server works out what THIS shop owes rather than reading one
  // number that used to apply to everybody.
  useEffect(() => {
    async function loadPrice() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) return;

        const res = await fetch("/api/paymob/price", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data?.error);

        setPriceEgp(data.priceEgp);
        setSubtotal(data.subtotal ?? data.priceEgp);
        setDiscount(data.discount ?? 0);
      } catch {
        setPriceEgp(null);
      }
    }

    loadPrice();
  }, []);

  async function handlePay() {
    setError("");
    setPaying(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("لازم تسجّل الدخول الأول");
      }

      const res = await fetch("/api/paymob/create-payment", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "حدث خطأ أثناء إنشاء عملية الدفع");
      }

      window.location.href = data.paymentUrl;
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "حدث خطأ أثناء إنشاء عملية الدفع";

      setError(message);
      setPaying(false);
    }
  }

  if (sessionLoading || !business) {
    return (
      <main className="flex min-h-[50vh] items-center justify-center text-mist">
        جارِ التحميل...
      </main>
    );
  }

  const now = Date.now();
  const trialActive = new Date(business.trial_ends_at).getTime() >= now;
  const subscriptionActive =
    business.subscription_expires_at !== null &&
    new Date(business.subscription_expires_at).getTime() >= now;
  const isActive = trialActive || subscriptionActive;

  const isOwner = user?.role === "owner";

  return (
    <main className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <CreditCard size={28} />
          الاشتراك
        </h1>
        <p className="mt-1 text-mist">حالة اشتراكك وطريقة الدفع</p>
      </div>

      <div
        className={`rounded-xl border p-5 ${
          isActive
            ? "border-ink-600 bg-ink-800"
            : "border-red-800 bg-red-950/30"
        }`}
      >
        {trialActive && (
          <p className="text-mist">
            باقيلك{" "}
            <span className="font-bold text-paper">
              {daysRemaining(business.trial_ends_at)}
            </span>{" "}
            يوم في فترتك التجريبية (لحد {formatDate(business.trial_ends_at)}).
          </p>
        )}

        {!trialActive && subscriptionActive && (
          <p className="text-mist">
            اشتراكك فعّال لحد{" "}
            <span className="font-bold text-paper">
              {formatDate(business.subscription_expires_at!)}
            </span>
            .
          </p>
        )}

        {!isActive && (
          <p className="text-red-300">
            انتهت فترتك — محتاج تجدد الاشتراك عشان تقدر تضيف مبيعات أو أصناف
            جديدة.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-ink-600 bg-ink-800 p-5 text-center">
        <p className="text-sm text-mist">الاشتراك الشهري</p>

        <p className="mt-2 text-4xl font-bold text-paper">
          {priceEgp !== null ? `${priceEgp} جنيه` : "..."}
        </p>

        {discount > 0 && (
          <p className="mt-1 text-sm text-green-400">
            بعد خصم إحالات {discount} ج (الأصل {subtotal} ج)
          </p>
        )}

        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

        {isOwner ? (
          <button
            onClick={handlePay}
            disabled={paying || priceEgp === null}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-splash py-3 font-bold text-ink-950 transition hover:bg-splash-deep disabled:opacity-50"
          >
            {paying ? (
              "جارِ التحويل لبوابة الدفع..."
            ) : (
              <>
                <CreditCard size={18} />
                ادفع الآن
              </>
            )}
          </button>
        ) : (
          <p className="mt-5 text-sm text-mist">
            الدفع متاح لصاحب النشاط فقط.
          </p>
        )}
      </div>
    </main>
  );
}
