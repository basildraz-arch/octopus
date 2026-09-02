"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Receipt, BarChart3, ShoppingCart } from "lucide-react";

import { DEMO_SHOPS, type DemoShop } from "@/lib/demoShops";

// ============================================================
// شاشة العرض — دي أداة بيع، مش صفحة معلومات
// ============================================================
//
// المسوّق واقف قدام صاحب محل ومعاه موبايل. عنده تلاتين ثانية.
// فالصفحة دي بتوري **تلات حاجات بالترتيب ده بالظبط**:
//
//   ١. شاشة البيع بأصناف مجاله هو → "ده محلك"
//   ٢. الفاتورة المطبوعة          → "وde اللي هيدّيه لزبونه"
//   ٣. أرقام آخر اليوم            → "وde اللي هيعرفه آخر اليوم"
//
// وكل ده **صورة**: مفيش اتصال بقاعدة بيانات، ومفيش حساب حقيقي،
// ومفيش حاجة تتكتب. المسوّق مايقدرش يبوّظ حاجة، والعرض شغّال حتى
// لو النت ضعيف. التفصيل في `lib/demoShops.ts`.

type Tab = "pos" | "receipt" | "report";

const TABS: { id: Tab; label: string; icon: typeof Receipt }[] = [
  { id: "pos", label: "شاشة البيع", icon: ShoppingCart },
  { id: "receipt", label: "الفاتورة", icon: Receipt },
  { id: "report", label: "آخر اليوم", icon: BarChart3 },
];

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
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <div>
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
            <div
              key={item.name}
              className="rounded-xl border border-ink-600 bg-ink-800 p-3 text-center"
            >
              <p className="text-sm font-semibold text-paper">{item.name}</p>
              <p className="mt-1 font-bold text-green-400">{item.price} ج</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-ink-600 bg-ink-800 p-4">
        <p className="mb-3 font-bold text-paper">العربية</p>

        <div className="space-y-2">
          {shop.basket.map((line) => (
            <div
              key={line.name}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-mist">
                {line.name}{" "}
                <span className="text-xs">× {line.quantity}</span>
              </span>

              <span className="font-semibold text-paper">
                {(line.quantity * line.price).toFixed(2)}
              </span>
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
          <p className="mt-1 text-xs text-gray-500">
            {new Date().toLocaleString("ar-EG")}
          </p>
          <p className="text-xs font-semibold text-gray-700">فاتورة رقم 128</p>
        </div>

        <div className="my-2 space-y-1 border-y border-dashed border-gray-400 py-2">
          {shop.basket.map((line) => (
            <div key={line.name} className="flex justify-between text-xs">
              <span className="pe-2">
                {line.name} × {line.quantity}
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
        <p className="mt-1 text-sm text-mist">
          من {shop.day.invoices} فاتورة
        </p>
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
        وكل ده بيتحسب لوحده من البيع - صاحب المحل مابيدخّلش ولا رقم.
      </p>
    </div>
  );
}

export default function MarketerDemoPage() {
  const [shop, setShop] = useState<DemoShop>(DEMO_SHOPS[0]);
  const [tab, setTab] = useState<Tab>("pos");

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

        <div className="flex gap-2 overflow-x-auto pb-1">
          {DEMO_SHOPS.map((option) => (
            <button
              key={option.businessType}
              onClick={() => setShop(option)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                shop.businessType === option.businessType
                  ? "bg-splash text-ink-950"
                  : "border border-ink-600 bg-ink-800 text-mist"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-ink-600 bg-ink-900/60 p-3 text-center">
        <p className="text-xs text-mist">بتعرض دلوقتي</p>
        <p className="font-bold text-paper">{shop.shopName}</p>
      </div>

      <div className="flex gap-2">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl p-3 text-sm font-bold transition ${
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

      {tab === "pos" && <PosPreview shop={shop} />}
      {tab === "receipt" && <ReceiptPreview shop={shop} />}
      {tab === "report" && <ReportPreview shop={shop} />}

      <p className="rounded-xl border border-ink-600 bg-ink-800/60 p-3 text-center text-xs text-mist">
        دي شاشة عرض بأرقام تجريبية - مش محل حقيقي.
      </p>
    </main>
  );
}
