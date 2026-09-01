"use client";

import { useEffect, useRef } from "react";
import { Printer, MessageCircle } from "lucide-react";

import type { CartItem } from "@/components/Cart";
import type { Business } from "@/types/business";
import { hasFeature } from "@/lib/features";
import type { PriceTier } from "@/lib/priceTier";
import { buildReceiptText, whatsAppLink } from "@/lib/whatsappReceipt";
import PrintPortal from "@/components/PrintPortal";

type Props = {
  cart: CartItem[];
  total: number;
  discountAmount: number;
  createdAt: Date;
  onClose: () => void;
  business?: Business | null;
  priceTier?: PriceTier;
  // Fire the print dialog as soon as the receipt appears. Used for
  // completed sales when the shop requires every sale to print.
  autoPrint?: boolean;
  // A price quote, not a sale. Marked loudly so it can never be
  // mistaken for proof of payment.
  quote?: boolean;

  // تليفون العميل لو البيعة على الحساب. لو مفيش، زرار واتساب بيفتح
  // "اختار جهة اتصال" بدل ما يختفي - الفاتورة نفسها هي الفايدة،
  // والرقم بيوفّر خطوة بس.
  customerPhone?: string | null;
};

// ============================================================
// مقاسات الورق — الأرقام دي متقاسة مش متخمّنة
// ============================================================
//
// طابعة كيرو (XP-80C) بتقول في خصائصها بالحرف:
//
//     Paper available:  80(72.1) x 297 mm
//     Maximum resolution: 203 dpi
//
// يعني الورق **٨٠ مم**، بس اللي بيتطبع فعلًا **٧٢.١ مم** — الفرق
// (حوالي ٤ مم كل جنب) منطقة الطابعة مابتوصلهاش خالص. وde مش خاص
// بالموديل ده؛ ده حال كل الطابعات الحرارية.
//
// ٢٠٣ dpi = ٨ نقط في المليمتر، فـ٧٢.١ مم = **٥٧٦ نقطة** — وde
// الرقم القياسي لرول الـ٨٠ مم.
//
// ============================================================
// ليه بقى فيه `margin` مستقل
// ============================================================
//
// قبل كده كان `@page { size: 80mm auto; margin: 0 }` والمحتوى عرضه
// ٧٢ مم. المتصفح بيبدأ يرسم من **حافة الصفحة**، فالـ٧٢ مم بتبتدي
// من ٠ وبتنتهي عند ٧٢ — يعني داخلة ٤ مم في المنطقة اللي الطابعة
// مابتطبعش فيها على الشمال، و٨ مم فاضيين على اليمين. النتيجة فاتورة
// مزنوقة على جنب وطرفها مقصوص.
//
// الهامش هنا بيخلّي الصفحة تبتدي بعد المنطقة الميتة، والعرض بيملا
// اللي فاضل بالظبط.
const PAPER: Record<
  string,
  { width: string; page: string; margin: string; label: string }
> = {
  // رول ٥٨ مم: المطبوع ~٤٨ مم (٣٨٤ نقطة على ٢٠٣ dpi).
  thermal_58: {
    width: "48mm",
    page: "58mm auto",
    margin: "0 5mm",
    label: "حراري ٥٨ مم",
  },

  // رول ٨٠ مم: المطبوع ٧٢.١ مم (٥٧٦ نقطة).
  thermal_80: {
    width: "72mm",
    page: "80mm auto",
    margin: "0 4mm",
    label: "حراري ٨٠ مم",
  },

  a4: { width: "180mm", page: "A4", margin: "10mm", label: "A4" },
};

const TEXT = {
  ar: {
    subtotal: "الإجمالي قبل الخصم",
    discount: "الخصم",
    total: "الإجمالي النهائي",
    currency: "جنيه",
    thanks: "شكرًا لزيارتكم",
    quote: "عرض سعر - مش فاتورة بيع",
    print: "طباعة",
    close: "إغلاق",
    locale: "ar-EG",
  },
  en: {
    subtotal: "Subtotal",
    discount: "Discount",
    total: "Total",
    currency: "EGP",
    thanks: "Thank you for your visit",
    quote: "QUOTE - NOT A RECEIPT",
    print: "طباعة",
    close: "إغلاق",
    locale: "en-GB",
  },
};

export default function Receipt({
  cart,
  total,
  discountAmount,
  createdAt,
  onClose,
  business,
  priceTier = 1,
  autoPrint = false,
  quote = false,
  customerPhone,
}: Props) {
  const subtotal = cart.reduce((sum, line) => sum + line.total, 0);
  const printed = useRef(false);

  useEffect(() => {
    if (!autoPrint || printed.current) return;

    // Guarded by a ref: React can run this effect twice in dev, and
    // nobody wants two print dialogs per sale.
    printed.current = true;

    // One frame's delay so the logo and layout are painted before the
    // browser snapshots the page for printing.
    const timer = window.setTimeout(() => window.print(), 150);

    return () => window.clearTimeout(timer);
  }, [autoPrint]);

  // Tier 1 is the tourist price, so that is the sale that gets an
  // English receipt - when the shop has asked for one.
  const english = hasFeature(business, "english_receipt") && priceTier === 1;
  const t = english ? TEXT.en : TEXT.ar;

  const paper = PAPER[business?.receipt_paper ?? "thermal_80"] ?? PAPER.thermal_80;

  // الفاتورة بتتعلّق في `<body>` مباشرة مش جوه شاشة البيع — عشان
  // وقت الطباعة تبقى المحتوى الوحيد على الورقة. التفاصيل والسبب
  // في `components/PrintPortal.tsx`.
  const overlay = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 print:static print:block print:bg-white print:p-0">
      {/* Thermal rolls are continuous paper: a fixed page height would
          eject a mostly-blank sheet after every sale. */}
      <style>{`
        @media print {
          @page { size: ${paper.page}; margin: ${paper.margin}; }
          body { margin: 0; }

          /* الطابعة الحرارية ٢٠٣ dpi — أقل بكتير من الشاشة. الخط
             تحت ٩pt بيطلع مهزوز ومش مقري، والكاشير بيدّي الورقة
             للزبون. بنفرض حد أدنى بدل ما نسيب Tailwind يصغّر. */
          .octopus-receipt { font-size: 9pt; line-height: 1.35; }
          .octopus-receipt .text-xs { font-size: 9pt; }
          .octopus-receipt .text-sm { font-size: 11pt; }
          .octopus-receipt .text-base { font-size: 13pt; }

          /* الرمادي الفاتح بيختفي على الورق الحراري. كله أسود. */
          .octopus-receipt * { color: #000 !important; }
        }
      `}</style>

      <div
        dir={english ? "ltr" : "rtl"}
        style={{ width: paper.width }}
        /* print:p-0 مش p-2: الهامش بقى على `@page` نفسها. لو فضل
           padding هنا كمان، بيتخصم تاني من عرض مالوش فاضل. */
        /* الفاتورة هي منطقة الطباعة بتاعتها.
           من غير العلامة دي، لو أي عنصر تاني في الصفحة كان معلّم،
           الورقة كانت هتطلع فاضية. */
        data-print-area
        className="octopus-receipt max-h-full overflow-y-auto rounded-2xl bg-white p-4 text-gray-900 print:max-h-none print:w-full print:overflow-visible print:rounded-none print:p-0 print:shadow-none"
      >
        {quote && (
          <p className="mb-2 rounded border border-gray-900 py-1 text-center text-xs font-bold">
            {t.quote}
          </p>
        )}

        <div className="mb-3 text-center">
          {business?.logo && (
            // Height-capped, not width-capped: the logo must never
            // push the receipt wider than the roll.
            <img
              src={business.logo}
              alt=""
              className="mx-auto mb-2 h-auto"
              style={{ maxHeight: "24mm", maxWidth: "100%" }}
            />
          )}

          <h2 className="text-base font-bold">
            {business?.name ?? "Octopus"}
          </h2>

          {business?.phone && (
            <p className="text-xs text-gray-600">{business.phone}</p>
          )}

          <p className="mt-1 text-xs text-gray-500">
            {createdAt.toLocaleString(t.locale)}
          </p>
        </div>

        <div className="space-y-1 border-y border-dashed border-gray-400 py-2">
          {cart.map((line) => (
            <div key={line.item.id} className="flex justify-between text-xs">
              <span className="pe-2">
                {line.item.name} × {line.quantity.toFixed(2)}
              </span>

              <span className="whitespace-nowrap">
                {line.total.toFixed(2)}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-2 space-y-0.5">
          <div className="flex justify-between text-xs text-gray-600">
            <span>{t.subtotal}</span>
            <span>
              {subtotal.toFixed(2)} {t.currency}
            </span>
          </div>

          {discountAmount > 0 && (
            <div className="flex justify-between text-xs text-gray-600">
              <span>{t.discount}</span>
              <span>
                {discountAmount.toFixed(2)} {t.currency}
              </span>
            </div>
          )}

          <div className="flex justify-between border-t border-dashed border-gray-400 pt-1 text-sm font-bold">
            <span>{t.total}</span>
            <span>
              {total.toFixed(2)} {t.currency}
            </span>
          </div>
        </div>

        <p className="mt-3 text-center text-xs text-gray-500">{t.thanks}</p>

        <div className="mt-4 flex gap-2 print:hidden">
          {/* واتساب: رابط wa.me برسالة مكتوبة. مابيبعتش لوحده -
              بيفتح المحادثة وصاحب المحل بيدوس إرسال. مفيش API ولا
              حساب أعمال ولا تكلفة. */}
          <a
            href={whatsAppLink(
              buildReceiptText({
                businessName: business?.name,
                lines: cart,
                total,
                discountAmount,
                createdAt,
                quote,
              }),
              customerPhone
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-600 p-3 font-bold text-white hover:bg-green-700"
          >
            <MessageCircle size={18} />
            واتساب
          </a>

          <button
            onClick={() => window.print()}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 p-3 font-bold text-white hover:bg-blue-700"
          >
            <Printer size={18} />
            {t.print}
          </button>

          <button
            onClick={onClose}
            className="flex-1 rounded-xl bg-gray-200 p-3 font-bold text-gray-800 hover:bg-gray-300"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );

  return <PrintPortal>{overlay}</PrintPortal>;
}
