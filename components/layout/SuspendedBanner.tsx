"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Clock } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { useSession } from "@/hooks/useSession";

// Says out loud what migrations 065 and 066 enforce silently.
//
// A shop that has run out can still READ everything, so without this
// the owner sees a normal, fully populated app and only finds out when
// a sale is refused. Three different things need saying:
//
//   expiring  - still working, runs out in N days, here is the amount
//   expired   - stopped, pay to come back
//   suspended - Basel switched it off; paying is not the answer
//
// The amount is fetched rather than guessed: it is worked out on the
// server from the shop's own modules (lib/monthlyDue.ts), and a
// number invented in the browser would be a number the shop could
// argue with.
export default function SuspendedBanner() {
  const { subscription, user } = useSession();
  const [due, setDue] = useState<number | null>(null);

  const isOwner = user?.role === "owner";
  const showsMoney =
    isOwner &&
    (subscription.status === "expiring" || subscription.status === "expired");

  useEffect(() => {
    if (!showsMoney) return;

    let cancelled = false;

    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) return;

        const response = await fetch("/api/paymob/price", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (!response.ok) return;

        const data = await response.json();

        if (!cancelled && typeof data?.priceEgp === "number") {
          setDue(data.priceEgp);
        }
      } catch {
        // The banner's job is the warning. A missing number makes it
        // less useful, not wrong.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [showsMoney]);

  if (subscription.status === "ok") return null;

  const amount = due !== null ? ` المستحق ${due.toFixed(2)} ج.` : "";

  const tone =
    subscription.status === "expiring"
      ? "border-amber-800 bg-amber-950/40 text-amber-200"
      : "border-red-900 bg-red-950/40 text-red-200";

  const button =
    subscription.status === "expiring"
      ? "bg-amber-500"
      : "bg-red-500";

  return (
    <div
      role="status"
      className={`flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-3 text-sm print:hidden ${tone}`}
    >
      {subscription.status === "expiring" ? (
        <Clock size={18} className="shrink-0" />
      ) : (
        <AlertTriangle size={18} className="shrink-0" />
      )}

      <span className="flex-1">
        {subscription.status === "expiring" && (
          <>
            <strong className="font-bold">
              اشتراكك بيخلص{" "}
              {subscription.daysLeft === 1
                ? "بكرة"
                : `بعد ${subscription.daysLeft} أيام`}
              .
            </strong>
            {amount} جدّده عشان الشغل ما يقفش.
          </>
        )}

        {subscription.status === "expired" && (
          <>
            <strong className="font-bold">اشتراكك خلص.</strong> تقدر تشوف
            بياناتك كلها، بس البيع والتعديل مقفولين لحد ما يتجدد.{amount}
          </>
        )}

        {subscription.status === "suspended" && (
          <>
            <strong className="font-bold">الحساب متوقف.</strong> تقدر تشوف
            بياناتك كلها، بس البيع والتعديل مقفولين.
          </>
        )}
      </span>

      {isOwner && subscription.status !== "suspended" ? (
        <Link
          href="/subscribe"
          className={`min-h-10 shrink-0 rounded-lg px-4 py-2 font-bold text-ink-950 ${button}`}
        >
          جدّد الاشتراك
        </Link>
      ) : (
        <span className="shrink-0 opacity-80">
          {isOwner ? "كلّم الدعم" : "كلّم صاحب النشاط"}
        </span>
      )}
    </div>
  );
}
