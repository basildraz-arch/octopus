"use client";

import { useEffect, useMemo, useState } from "react";
import { Calculator, HelpCircle, Wallet } from "lucide-react";

import { getPricingSettings } from "@/repositories/pricing.repository";
import type { DemoShop } from "@/lib/demoShops";

// ============================================================
// «محلك انت» — الشاشة اللي بتبيع
// ============================================================
//
// باسل: "مش الشكل الواو اللي يخلي صاحب المحل يشتري."
//
// وهو محق، والسبب إن باقي الشاشة **بتتكلم عن البرنامج**. صاحب
// المحل مابيشتريش لأنه شاف «الطبخة» و«الباركود» - دي حاجات مش
// عارف لسه ليه يهتم بيها. بيشتري لما يشوف **محله هو** على الشاشة.
//
// ------------------------------------------------------------
// القاعدة اللي الملف ده مبني عليها: مفيش رقم مخترع
// ------------------------------------------------------------
//
// أسهل حاجة كانت نكتب «المحلات بتخسر ١٥٪ من غير نظام» ونضرب. وde
// كان هيدّي رقم مخيف وجذّاب - **وكذب**، إحنا مش عارفين النسبة دي
// ولا عندنا مصدر ليها.
//
// وصاحب المحل ده بيقعد مع أرقامه كل يوم. أول ما يمسك كذبة صغيرة
// في العرض، بيبطّل يصدّق الباقي كله - وساعتها حتى الحاجات
// الحقيقية اللي البرنامج بيعملها بتضيع معاها.
//
// فاللي بيتعرض هنا حاجتين بس:
//
//   ١. **حسابه هو**: فواتيره × متوسط فاتورته × أيام شغله. ضرب،
//      مش تقدير. وهو اللي دخّل التلات أرقام.
//
//   ٢. **أسئلة مش قادر يجاوبها النهاردة**. مش «بتخسر كذا» -
//      بل «تعرف ربحت كام امبارح؟». السؤال اللي مالوش إجابة
//      بيشتغل أقوى من رقم مخترع، ولأنه صادق بيفضل شغّال بعد
//      ما المسوّق يمشي.
//
// وسعر البرنامج بيتقرا من `pricing_settings` مش مكتوب في الكود:
// سعر غلط في عرض بيع بيتحول لخناقة أول فاتورة.

type Props = { shop: DemoShop };

const FALLBACK_BASE_PRICE = 600;

// أسئلة صاحب المحل مش قادر يجاوبها من غير نظام. مكتوبة بصيغة
// السؤال عن قصد: الجملة الخبرية بتتقرا كإعلان، والسؤال بيخلّيه
// يحاول يجاوب - ولما ما يعرفش، هو اللي بيوصل للنتيجة بنفسه.
const OPEN_QUESTIONS = [
  "امبارح كسبت كام؟ مش بعت بكام — **كسبت** كام.",
  "أنهي صنف بيجيبلك فلوس فعلًا، وأنهي واحد بس واخد مساحة؟",
  "لو الدرج ناقص ١٠٠ ج النهاردة، هتعرف امتى؟ وهتعرف من نوبة مين؟",
  "الصنف اللي بيخلص بسرعة — بتعرف قبل ما يخلص ولا بعد ما الزبون يمشي؟",
];

function egp(value: number) {
  return value.toLocaleString("ar-EG", { maximumFractionDigits: 0 });
}

export default function YourShop({ shop }: Props) {
  // القيم الابتدائية من اسطمبة المجال، مش فاضية: الشاشة الفاضية
  // بتطلب من صاحب المحل شغل قبل ما يشوف أي قيمة، وde بيوقّف العرض.
  // وهو بيعدّلهم لأرقامه في تانيتين.
  const [invoices, setInvoices] = useState(String(shop.day.invoices));
  const [avgTicket, setAvgTicket] = useState(
    String(Math.round(shop.day.sales / Math.max(shop.day.invoices, 1)))
  );
  const [days, setDays] = useState("26");

  const [basePrice, setBasePrice] = useState(FALLBACK_BASE_PRICE);

  useEffect(() => {
    getPricingSettings().then((settings) => {
      if (settings?.base_price) setBasePrice(Number(settings.base_price));
    });
  }, []);

  // كل ما المجال يتغيّر، الأرقام تتغيّر معاه - عشان المسوّق يفتح
  // «جزارة» ويلاقي أرقام جزارة، مش أرقام الكافيه اللي فات.
  useEffect(() => {
    setInvoices(String(shop.day.invoices));
    setAvgTicket(
      String(Math.round(shop.day.sales / Math.max(shop.day.invoices, 1)))
    );
  }, [shop]);

  const numbers = useMemo(() => {
    const perDay = Number(invoices) || 0;
    const ticket = Number(avgTicket) || 0;
    const workDays = Number(days) || 0;

    const daily = perDay * ticket;
    const monthly = daily * workDays;

    return {
      daily,
      monthly,
      yearly: monthly * 12,
      // النسبة دي أصدق رقم في الشاشة: تكلفة البرنامج من مبيعاته هو.
      costShare: monthly > 0 ? (basePrice / monthly) * 100 : null,
    };
  }, [invoices, avgTicket, days, basePrice]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-ink-600 bg-ink-800 p-4">
        <p className="mb-1 flex items-center gap-2 text-sm font-bold text-paper">
          <Calculator size={16} className="text-splash" />
          اسأله التلات أسئلة دي
        </p>

        <p className="mb-4 text-xs text-mist">
          واكتب إجاباته هو. الأرقام تحت هتبقى بتاعته مش بتاعتنا.
        </p>

        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "فواتير في اليوم", value: invoices, set: setInvoices },
            { label: "متوسط الفاتورة", value: avgTicket, set: setAvgTicket },
            { label: "أيام شغل في الشهر", value: days, set: setDays },
          ].map((field) => (
            <label key={field.label} className="block">
              <span className="mb-1 block text-[11px] leading-tight text-mist">
                {field.label}
              </span>

              <input
                type="number"
                inputMode="numeric"
                value={field.value}
                onChange={(e) => field.set(e.target.value)}
                className="w-full rounded-xl border border-ink-600 bg-ink-900 p-3 text-center text-lg font-bold text-paper outline-none focus:border-splash"
              />
            </label>
          ))}
        </div>
      </div>

      {/* الرقم الكبير. ده بتاعه، وهو أول مرة يشوفه مكتوب. */}
      <div className="rounded-2xl border border-splash/40 bg-ink-800 p-6 text-center">
        <p className="text-sm text-mist">يعني محلك بيعمل في الشهر</p>

        <p className="mt-1 text-4xl font-black text-green-400 sm:text-5xl">
          {egp(numbers.monthly)} ج
        </p>

        <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-1 text-sm text-mist">
          <span>
            في اليوم{" "}
            <span className="font-bold text-paper">{egp(numbers.daily)} ج</span>
          </span>

          <span>
            في السنة{" "}
            <span className="font-bold text-paper">{egp(numbers.yearly)} ج</span>
          </span>
        </div>
      </div>

      {numbers.costShare !== null && numbers.monthly > 0 && (
        <div className="rounded-2xl border border-ink-600 bg-ink-800 p-5">
          <p className="mb-2 flex items-center gap-2 text-sm font-bold text-paper">
            <Wallet size={16} className="text-amber-300" />
            والبرنامج بيكلفك كام من ده؟
          </p>

          <p className="text-2xl font-bold text-amber-300">
            {egp(basePrice)} ج في الشهر
          </p>

          <p className="mt-1 text-sm text-mist">
            يعني{" "}
            <span className="font-bold text-paper">
              {numbers.costShare.toFixed(1)}٪
            </span>{" "}
            من مبيعاتك — أو{" "}
            <span className="font-bold text-paper">
              {egp(Math.round(basePrice / Math.max(Number(days) || 1, 1)))} ج
            </span>{" "}
            في اليوم.
          </p>

          {/* المقارنة دي بتحوّل الرقم من "مصروف" لـ"حاجة صغيرة".
              وهي صادقة: دي قسمة، مش تقدير. */}
          {Number(avgTicket) > 0 && (
            <p className="mt-3 rounded-xl bg-ink-900 p-3 text-xs text-mist">
              يعني تقريبًا{" "}
              <span className="font-bold text-paper">
                {Math.ceil(basePrice / Number(avgTicket))} فاتورة
              </span>{" "}
              في الشهر كله — من أصل{" "}
              <span className="font-bold text-paper">
                {egp((Number(invoices) || 0) * (Number(days) || 0))}
              </span>
              .
            </p>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-ink-600 bg-ink-800 p-5">
        <p className="mb-1 flex items-center gap-2 text-sm font-bold text-paper">
          <HelpCircle size={16} className="text-splash" />
          دلوقتي اسأله الأسئلة دي
        </p>

        <p className="mb-4 text-xs text-mist">
          كل واحد فيهم البرنامج بيجاوبه في ثانية.
        </p>

        <ul className="space-y-3">
          {OPEN_QUESTIONS.map((question) => (
            <li key={question} className="flex items-start gap-2 text-sm">
              <span className="mt-0.5 font-bold text-splash">؟</span>

              <span className="text-paper">
                {/* النجمتين في النص بتعلّم الكلمة المهمة. أبسط من
                    مكتبة ماركداون لأربع جمل. */}
                {question.split("**").map((part, i) =>
                  i % 2 === 1 ? (
                    <span key={i} className="font-bold text-amber-200">
                      {part}
                    </span>
                  ) : (
                    <span key={i}>{part}</span>
                  )
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="rounded-xl border border-ink-600 bg-ink-900 p-3 text-center text-xs leading-relaxed text-mist">
        كل رقم فوق حسابك انت من إجاباتك — إحنا مابنقدّرش ولا بنخمّن
        حاجة.
      </p>
    </div>
  );
}
