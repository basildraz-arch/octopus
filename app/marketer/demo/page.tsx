"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Receipt,
  BarChart3,
  ShoppingCart,
  Sparkles,
  ChefHat,
  Scale,
  ScanLine,
  Plus,
  Minus,
  AlertTriangle,
  Check,
  Calculator,
  Clock,
} from "lucide-react";

import {
  DEMO_SHOPS,
  COMING_SOON,
  type DemoShop,
  type DemoItem,
  type ComingSoonVertical,
} from "@/lib/demoShops";
import YourShop from "@/components/marketer/YourShop";
import ComingSoonPitch from "@/components/marketer/ComingSoonPitch";

// ============================================================
// شاشة العرض — أداة بيع، مش صفحة معلومات
// ============================================================
//
// المسوّق واقف قدام صاحب محل ومعاه موبايل، وعنده تلاتين ثانية.
//
// ------------------------------------------------------------
// اللي اتغيّر بعد أول نسخة
// ------------------------------------------------------------
//
// أول نسخة كانت بتغيّر **أسماء الأصناف والأسعار وبس** - نفس التلات
// شاشات لكل الأنشطة. وباسل شاف إنها مش كفاية، وهو محق:
//
//   صاحب الجزارة مش هيتبهر إنه شاف "لحمة كندوز" مكان "لاتيه".
//   هو عايز يشوف **البيع بالكيلو**.
//
// دلوقتي كل نشاط بيغيّر **سلوك الشاشة** مش أسماءها:
//
//   بالوزن   → الكميات بالكيلو، والخطوة ربع، و«١.٥ كيلو» مكتوبة
//   بالباركود → الرقم تحت الاسم وأيقونة ماسح
//   بوصفة    → «له وصفة» على الصنف، ومكوّناته مكتوبة
//   خدمات    → مفيش مخزون خالص، والكلام عن الوقت مش البضاعة
//
// وفيه تبويب رابع «ليه يهمك» - وهو **أهم واحد فيهم**. المسوّق مش
// بيبيع برنامج، هو بيبيع حل لوجع الراجل اللي قدامه، ووجع الجزار
// مش وجع الصيدلي.
//
// وكل ده **صورة**: مفيش قاعدة بيانات ولا حساب حقيقي ولا كتابة.
// المسوّق مايقدرش يبوّظ حاجة، والعرض شغّال والنت ضعيف.

type Tab = "mine" | "why" | "pos" | "receipt" | "report";

// «محلك» الأول عن قصد: العرض بيبدأ بأرقامه هو، مش بمميزاتنا.
const TABS: { id: Tab; label: string; icon: typeof Receipt }[] = [
  { id: "mine", label: "محلك", icon: Calculator },
  { id: "why", label: "ليه يهمك", icon: Sparkles },
  { id: "pos", label: "شاشة البيع", icon: ShoppingCart },
  { id: "receipt", label: "الفاتورة", icon: Receipt },
  { id: "report", label: "آخر اليوم", icon: BarChart3 },
];

// الكمية بتتكتب حسب طريقة البيع. «٢» للحبة و«١.٥ كيلو» للوزن -
// والفرق ده هو اللي صاحب الجزارة بيدوّر عليه.
function formatQty(shop: DemoShop, quantity: number) {
  if (shop.sellsBy === "weight") {
    const clean = Number.isInteger(quantity)
      ? String(quantity)
      : quantity.toFixed(2).replace(/0$/, "");

    return `${clean} كيلو`;
  }

  return String(quantity);
}

function ItemCard({ shop, item }: { shop: DemoShop; item: DemoItem }) {
  return (
    <div className="rounded-xl border border-ink-600 bg-ink-800 p-3 text-center">
      <p className="text-sm font-semibold text-paper">{item.name}</p>

      <p className="mt-1 font-bold text-green-400">
        {item.price} ج
        {shop.sellsBy === "weight" && (
          <span className="text-xs font-normal text-mist"> / كيلو</span>
        )}
      </p>

      {item.recipe && (
        <p className="mt-1 flex items-center justify-center gap-1 text-[11px] text-splash">
          <ChefHat size={11} />
          له وصفة
        </p>
      )}

      {item.barcode && (
        <p
          dir="ltr"
          className="mt-1 flex items-center justify-center gap-1 text-[11px] text-mist"
        >
          <ScanLine size={11} />
          {item.barcode}
        </p>
      )}
    </div>
  );
}

function WhyPreview({ shop }: { shop: DemoShop }) {
  return (
    <div className="space-y-4">
      {/* الوجع الأول. لو الراجل مالقاش نفسه في السطور دي، باقي
          العرض مالوش لازمة. */}
      <div className="rounded-2xl border border-red-900/60 bg-red-950/20 p-5">
        <p className="mb-3 flex items-center gap-2 text-sm font-bold text-red-300">
          <AlertTriangle size={16} />
          الحاجات دي بتحصل معاك؟
        </p>

        <ul className="space-y-2">
          {shop.pitch.pains.map((pain) => (
            <li key={pain} className="flex items-start gap-2 text-sm text-paper">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
              {pain}
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-3">
        {shop.pitch.features.map((feature) => (
          <div
            key={feature.title}
            className="rounded-2xl border border-ink-600 bg-ink-800 p-4"
          >
            <p className="flex items-center gap-2 font-bold text-paper">
              <Check size={16} className="text-green-400" />
              {feature.title}
            </p>

            <p className="mt-1.5 ps-6 text-sm leading-relaxed text-mist">
              {feature.line}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PosPreview({ shop }: { shop: DemoShop }) {
  const [category, setCategory] = useState<string>("الكل");

  const items = useMemo(
    () =>
      category === "الكل"
        ? shop.items
        : shop.items.filter((item) => item.category === category),
    [shop, category]
  );

  const total = shop.basket.reduce(
    (sum, line) => sum + line.quantity * line.price,
    0
  );

  return (
    <div className="space-y-3">
      {/* شريط بيقول للراجل "الشاشة دي متظبطة على شغلك انت". */}
      <div className="flex flex-wrap gap-2">
        {shop.sellsBy === "weight" && (
          <span className="flex items-center gap-1.5 rounded-full bg-ink-800 px-3 py-1.5 text-xs text-amber-300">
            <Scale size={13} />
            البيع بالوزن — الخطوة ربع كيلو
          </span>
        )}

        {shop.sellsBy === "service" && (
          <span className="flex items-center gap-1.5 rounded-full bg-ink-800 px-3 py-1.5 text-xs text-amber-300">
            <Sparkles size={13} />
            خدمات — من غير مخزون
          </span>
        )}

        {shop.items.some((i) => i.barcode) && (
          <span className="flex items-center gap-1.5 rounded-full bg-ink-800 px-3 py-1.5 text-xs text-mist">
            <ScanLine size={13} />
            بيقرا الباركود
          </span>
        )}

        {shop.items.some((i) => i.recipe) && (
          <span className="flex items-center gap-1.5 rounded-full bg-ink-800 px-3 py-1.5 text-xs text-splash">
            <ChefHat size={13} />
            أصناف ليها وصفة
          </span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="order-2 lg:order-1">
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
            {["الكل", ...shop.categories].map((name) => (
              <button
                key={name}
                onClick={() => setCategory(name)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  category === name
                    ? "bg-splash text-ink-950"
                    : "border border-ink-600 bg-ink-800 text-mist"
                }`}
              >
                {name}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {items.map((item) => (
              <ItemCard key={item.name} shop={shop} item={item} />
            ))}
          </div>
        </div>

        <div className="order-1 rounded-xl border border-ink-600 bg-ink-800 p-4 lg:order-2">
          <p className="mb-3 font-bold text-paper">العربية</p>

          <div className="space-y-3">
            {shop.basket.map((line) => (
              <div key={line.name}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-mist">{line.name}</span>

                  <span className="font-semibold text-paper">
                    {(line.quantity * line.price).toFixed(2)}
                  </span>
                </div>

                {/* أزرار + و− بالشكل اللي الكاشير بيشوفه، والخطوة
                    بتتقال بالكلام: حبة ولا ربع كيلو. */}
                <div className="mt-1 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded bg-ink-700 text-mist">
                    <Minus size={12} />
                  </span>

                  <span className="min-w-16 text-center text-xs font-semibold text-paper">
                    {formatQty(shop, line.quantity)}
                  </span>

                  <span className="flex h-6 w-6 items-center justify-center rounded bg-ink-700 text-mist">
                    <Plus size={12} />
                  </span>

                  {shop.sellsBy === "weight" && (
                    <span className="text-[11px] text-mist">± ربع</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 border-t border-ink-600 pt-3">
            <p className="text-xs text-mist">الإجمالي</p>
            <p className="text-3xl font-bold text-green-400">
              {total.toFixed(2)} ج
            </p>
          </div>

          <div className="mt-4 rounded-xl bg-green-600 p-3 text-center font-bold text-white">
            تمام
          </div>
        </div>
      </div>

      {/* الوصفة مكتوبة بالتفصيل تحت الشاشة: ده اللي بيخلّي صاحب
          الكافيه يقول "استنى، يعني بيخصم البن لوحده؟" */}
      {shop.items.some((i) => i.recipe) && (
        <div className="rounded-xl border border-splash/30 bg-ink-800 p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-bold text-splash">
            <ChefHat size={14} />
            الطبخة — بتتخصم لوحدها مع كل بيعة
          </p>

          <div className="space-y-1">
            {shop.items
              .filter((i) => i.recipe)
              .map((i) => (
                <p key={i.name} className="text-xs text-mist">
                  <span className="font-semibold text-paper">{i.name}</span> ←{" "}
                  {i.recipe}
                </p>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ReceiptPreview({ shop }: { shop: DemoShop }) {
  const total = shop.basket.reduce(
    (sum, line) => sum + line.quantity * line.price,
    0
  );

  return (
    <div className="flex justify-center">
      {/* بعرض الرول الحراري ٧٢ مم عشان الشكل يبقى صادق. */}
      <div
        style={{ width: "72mm" }}
        className="rounded-lg bg-white p-4 text-gray-900 shadow-xl"
      >
        <div className="text-center">
          <h3 className="text-base font-bold">{shop.shopName}</h3>
          <p className="text-xs font-semibold text-gray-700">فاتورة رقم 128</p>
          <p className="mt-1 text-xs text-gray-500">
            {new Date().toLocaleString("ar-EG")}
          </p>
        </div>

        <div className="my-2 space-y-1 border-y border-dashed border-gray-400 py-2">
          {shop.basket.map((line) => (
            <div key={line.name} className="flex justify-between text-xs">
              <span className="pe-2">
                {line.name} × {formatQty(shop, line.quantity)}
              </span>
              <span>{(line.quantity * line.price).toFixed(2)}</span>
            </div>
          ))}
        </div>

        <div className="flex justify-between text-sm font-bold">
          <span>الإجمالي</span>
          <span>{total.toFixed(2)} جنيه</span>
        </div>

        <p className="mt-3 text-center text-xs text-gray-500">شكرًا لزيارتكم</p>
      </div>
    </div>
  );
}

function ReportPreview({ shop }: { shop: DemoShop }) {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-ink-600 bg-ink-800 p-5">
        <p className="text-sm text-mist">مبيعات النهارده</p>
        <p className="mt-1 text-4xl font-bold text-green-400">
          {shop.day.sales.toLocaleString("ar-EG")} ج
        </p>
        <p className="mt-1 text-sm text-mist">من {shop.day.invoices} فاتورة</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-ink-600 bg-ink-800 p-4">
          <p className="text-xs text-mist">المصروفات</p>
          <p className="mt-1 text-xl font-bold text-red-400">
            {shop.day.expenses.toLocaleString("ar-EG")} ج
          </p>
        </div>

        <div className="rounded-xl border border-ink-600 bg-ink-800 p-4">
          <p className="text-xs text-mist">الصافي في الدرج</p>
          <p className="mt-1 text-xl font-bold text-paper">
            {(shop.day.sales - shop.day.expenses).toLocaleString("ar-EG")} ج
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-ink-600 bg-ink-800 p-4">
        <p className="text-xs text-mist">أكتر صنف اتباع</p>
        <p className="mt-1 font-bold text-paper">{shop.day.topItem}</p>
      </div>

      <p className="rounded-xl bg-ink-900 p-3 text-xs leading-relaxed text-mist">
        وكل ده بيتحسب لوحده من البيع — صاحب المحل مابيدخّلش ولا رقم.
      </p>
    </div>
  );
}

export default function MarketerDemoPage() {
  const [shop, setShop] = useState<DemoShop>(DEMO_SHOPS[0]);
  const [tab, setTab] = useState<Tab>("mine");

  // المجالات اللي البرنامج مابيخدمهاش ليها شاشة لوحدها، مش تبويب
  // جوه العرض العادي: العرض هناك بيقول "شوف"، وهنا بيقول "قف".
  const [comingSoon, setComingSoon] = useState<ComingSoonVertical | null>(
    null
  );

  return (
    <main className="mx-auto max-w-4xl space-y-5 p-4 pb-16">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-paper">اعرض على الزبون</h1>

        <Link
          href="/marketer"
          className="flex items-center gap-1 text-sm text-mist hover:text-paper"
        >
          <ArrowRight size={14} />
          رجوع
        </Link>
      </header>

      {/* اختيار المجال أول حاجة: العرض كله بيتغيّر على أساسه. */}
      <div>
        <p className="mb-2 text-sm text-mist">الزبون بتاعك بيشتغل إيه؟</p>

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {DEMO_SHOPS.map((option) => (
            <button
              key={option.businessType}
              onClick={() => {
                setShop(option);
                setComingSoon(null);
                // الرجوع لأول تبويب مع كل تغيير: العرض بيبدأ من
                // أرقامه هو، مش من نص شاشة الزبون اللي فات.
                setTab("mine");
              }}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                !comingSoon && shop.businessType === option.businessType
                  ? "bg-splash text-ink-950"
                  : "border border-ink-600 bg-ink-800 text-mist"
              }`}
            >
              {option.label}
            </button>
          ))}

          {/* «قريبًا» في نفس الصف عن قصد: المسوّق بيدوّر على مجال
              زبونه، ولو ملقهوش هيفترض إنه موجود ويوعد. هنا بيلاقيه
              ومكتوب عليه إنه لسه. */}
          {COMING_SOON.map((option) => (
            <button
              key={option.key}
              onClick={() => setComingSoon(option)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition ${
                comingSoon?.key === option.key
                  ? "bg-amber-500 text-ink-950"
                  : "border border-dashed border-amber-900/70 bg-ink-800 text-amber-200/70"
              }`}
            >
              <Clock size={13} />
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {!comingSoon && (
        <div className="rounded-xl border border-ink-600 bg-ink-900/60 p-3 text-center">
          <p className="text-xs text-mist">بتعرض دلوقتي</p>
          <p className="font-bold text-paper">{shop.shopName}</p>
        </div>
      )}

      {comingSoon && <ComingSoonPitch vertical={comingSoon} />}

      {/* شريط بيتمرّر بالإصبع مش شبكة ثابتة: خمس تبويبات عربية
          على شاشة ٣٦٠ بكسل بتتزنق وبتتقطّع. */}
      {!comingSoon && (
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-3 text-sm font-bold transition ${
              tab === id
                ? "bg-splash text-ink-950"
                : "border border-ink-600 bg-ink-800 text-mist"
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>
      )}

      {!comingSoon && (
        <>
          {tab === "mine" && <YourShop shop={shop} />}
          {tab === "why" && <WhyPreview shop={shop} />}
          {tab === "pos" && <PosPreview shop={shop} />}
          {tab === "receipt" && <ReceiptPreview shop={shop} />}
          {tab === "report" && <ReportPreview shop={shop} />}

          <p className="rounded-xl border border-ink-600 bg-ink-800/60 p-3 text-center text-xs text-mist">
            شاشة البيع والفاتورة وآخر اليوم بأرقام تجريبية — مش محل
            حقيقي. وتبويب «محلك» بأرقامه هو.
          </p>
        </>
      )}
    </main>
  );
}
