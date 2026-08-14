"use client";

import { useEffect, useState } from "react";

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
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/paymob/price")
      .then((res) => res.json())
      .then((data) => setPriceEgp(data.priceEgp))
      .catch(() => setPriceEgp(null));
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
      <main className="flex min-h-[50vh] items-center justify-center text-zinc-400">
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
        <h1 className="text-3xl font-bold">💳 الاشتراك</h1>
        <p className="mt-1 text-zinc-400">حالة اشتراكك وطريقة الدفع</p>
      </div>

      <div
        className={`rounded-xl border p-5 ${
          isActive
            ? "border-zinc-800 bg-zinc-900"
            : "border-red-800 bg-red-950/30"
        }`}
      >
        {trialActive && (
          <p className="text-zinc-200">
            باقيلك{" "}
            <span className="font-bold text-white">
              {daysRemaining(business.trial_ends_at)}
            </span>{" "}
            يوم في فترتك التجريبية (لحد {formatDate(business.trial_ends_at)}).
          </p>
        )}

        {!trialActive && subscriptionActive && (
          <p className="text-zinc-200">
            اشتراكك فعّال لحد{" "}
            <span className="font-bold text-white">
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

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 text-center">
        <p className="text-sm text-zinc-400">الاشتراك الشهري</p>

        <p className="mt-2 text-4xl font-bold text-white">
          {priceEgp !== null ? `${priceEgp} جنيه` : "..."}
        </p>

        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

        {isOwner ? (
          <button
            onClick={handlePay}
            disabled={paying || priceEgp === null}
            className="mt-5 w-full rounded-xl bg-blue-600 py-3 font-bold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {paying ? "جارِ التحويل لبوابة الدفع..." : "💳 ادفع الآن"}
          </button>
        ) : (
          <p className="mt-5 text-sm text-zinc-500">
            الدفع متاح لصاحب النشاط فقط.
          </p>
        )}
      </div>
    </main>
  );
}
