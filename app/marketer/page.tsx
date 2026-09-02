"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Megaphone,
  Wallet,
  Store,
  Copy,
  Check,
  MessageCircle,
  MonitorPlay,
  Clock,
} from "lucide-react";

import {
  getMarketerDashboard,
  type MarketerDashboard,
} from "@/repositories/marketer.repository";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ar-EG", {
    day: "numeric",
    month: "short",
  });
}

export default function MarketerHomePage() {
  const [data, setData] = useState<MarketerDashboard | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getMarketerDashboard()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "خطأ"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="p-8 text-center text-mist">جارِ التحميل...</main>
    );
  }

  if (error || !data) {
    return (
      <main className="mx-auto max-w-md space-y-4 p-8 text-center">
        <p className="text-red-400">{error || "تعذر التحميل"}</p>

        <Link
          href="/login/marketer"
          className="inline-block rounded-xl bg-splash px-6 py-3 font-bold text-ink-950"
        >
          سجّل دخول
        </Link>
      </main>
    );
  }

  // الرسالة الجاهزة للواتساب. المسوّق شغله إنه يبعت، مش إنه يألّف
  // كلام - وكل واحد بيألّف نسخته بيقول حاجة مختلفة عن البرنامج.
  const siteUrl =
    typeof window !== "undefined" ? window.location.origin : "";

  const pitch = `الأخطبوط - برنامج كاشير ومخزن وحسابات للمحلات، بالعربي وبيشتغل من الموبايل.

جرّبه مجانًا ٧ أيام:
${siteUrl}/signup

كود الدعوة: ${data.code}`;

  return (
    <main className="mx-auto max-w-3xl space-y-5 p-4 pb-16">
      <h1 className="flex items-center gap-2 text-xl font-bold text-paper sm:text-2xl">
        <Megaphone size={22} className="text-splash" />
        أهلاً {data.name}
      </h1>

      {/* الرقم اللي المسوّق فاتح الشاشة عشانه. */}
      <div className="rounded-2xl border border-ink-600 bg-ink-800 p-6">
        <p className="text-sm text-mist">فلوسك المستحقة دلوقتي</p>

        <p className="mt-1 text-4xl font-bold text-amber-300">
          {data.due.toFixed(2)} ج
        </p>

        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-mist">
          <span>
            اتصرفلك <span className="font-semibold text-paper">{data.paid.toFixed(2)} ج</span>
          </span>

          <span>
            كل محل بـ <span className="font-semibold text-paper">{data.rewardEach} ج</span>
          </span>
        </div>

        {/* الجملة دي بتمنع أهم سوء فهم في النظام كله. */}
        <p className="mt-4 rounded-xl bg-ink-900 p-3 text-xs leading-relaxed text-mist">
          العمولة بتتحسبلك أول ما المحل <span className="font-bold text-paper">يدفع
          اشتراكه الأول</span> - مش أول ما يسجّل. يعني شغلك ما بيخلصش
          عند التسجيل: تابع المحل لحد ما يشتغل ويدفع.
        </p>
      </div>

      {/* الكود. أكبر حاجة على الشاشة بعد الفلوس. */}
      <div className="rounded-2xl border border-splash/40 bg-ink-800 p-6 text-center">
        <p className="text-sm text-mist">كودك</p>

        <p dir="ltr" className="mt-1 text-4xl font-black tracking-widest text-splash">
          {data.code}
        </p>

        {!data.codeActive && (
          <p className="mt-2 text-sm text-red-400">
            الكود متوقف دلوقتي - كلّم الإدارة
          </p>
        )}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(pitch)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-600 p-3 font-bold text-white transition hover:bg-green-700"
          >
            <MessageCircle size={18} />
            ابعت الدعوة واتساب
          </a>

          <button
            onClick={() => {
              navigator.clipboard?.writeText(pitch);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            }}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-ink-600 bg-ink-900 p-3 font-semibold text-paper transition hover:border-splash"
          >
            {copied ? <Check size={18} className="text-green-400" /> : <Copy size={18} />}
            {copied ? "اتنسخت" : "انسخ الرسالة"}
          </button>
        </div>
      </div>

      <Link
        href="/marketer/demo"
        className="flex items-center justify-between gap-3 rounded-2xl border border-ink-600 bg-ink-800 p-5 transition hover:border-splash"
      >
        <span className="flex items-center gap-3">
          <MonitorPlay size={28} className="text-splash" />

          <span>
            <span className="block font-bold text-paper">
              اعرض البرنامج على الزبون
            </span>

            <span className="block text-xs text-mist">
              شاشة جاهزة لكل نوع محل - كافيه، صيدلية، سوبر ماركت...
            </span>
          </span>
        </span>

        <span className="text-2xl text-mist">‹</span>
      </Link>

      <div>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-paper">
          <Store size={18} />
          محلاتك ({data.shops.length})
        </h2>

        {data.pendingCount > 0 && (
          <p className="mb-3 flex items-start gap-2 rounded-xl border border-ink-600 bg-ink-800/60 p-3 text-xs text-mist">
            <Clock size={14} className="mt-0.5 shrink-0" />
            <span>
              فيه {data.pendingCount} محل سجّل ولسه ما دفعش. كلّمهم -
              كل واحد فيهم {data.rewardEach} ج في جيبك أول ما يدفع.
            </span>
          </p>
        )}

        {data.shops.length === 0 ? (
          <p className="rounded-xl border border-ink-600 bg-ink-800 p-8 text-center text-mist">
            لسه محدش سجّل بكودك. ابعت الدعوة فوق. 🐙
          </p>
        ) : (
          <div className="space-y-2">
            {data.shops.map((shop) => (
              <div
                key={`${shop.shopName}-${shop.signedUp}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-600 bg-ink-800 p-4"
              >
                <span>
                  <span className="block font-semibold text-paper">
                    {shop.shopName}
                  </span>

                  <span className="block text-xs text-mist">
                    سجّل {formatDate(shop.signedUp)}
                  </span>
                </span>

                <span className="text-end">
                  {shop.settled ? (
                    <>
                      <span className="block font-bold text-green-400">
                        اتصرفت
                      </span>
                      <span className="block text-xs text-mist">
                        {shop.reward} ج
                      </span>
                    </>
                  ) : shop.paid ? (
                    <>
                      <span className="block font-bold text-amber-300">
                        {shop.reward} ج ليك
                      </span>
                      <span className="block text-xs text-mist">
                        المحل دفع
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="block text-sm font-semibold text-mist">
                        لسه ما دفعش
                      </span>
                      <span className="block text-xs text-mist">
                        تابعه
                      </span>
                    </>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="flex items-center justify-center gap-1.5 pt-4 text-center text-xs text-mist">
        <Wallet size={12} />
        الصرف بيتم من الإدارة. لو الرقم فوق مش مظبوط، كلّمهم.
      </p>
    </main>
  );
}
