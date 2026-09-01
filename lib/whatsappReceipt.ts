import type { CartItem } from "@/components/Cart";

// الفاتورة كنص واتساب.
//
// ============================================================
// ليه من غير أي API
// ============================================================
//
// واتساب بيسمح بـ`https://wa.me/<رقم>?text=<نص>` من أي متصفح - بيفتح
// المحادثة والرسالة مكتوبة، والمستخدم بيدوس "إرسال". مفيش مفاتيح،
// مفيش حساب أعمال، مفيش تكلفة، ومفيش موافقة من ميتا.
//
// المنافسين بيبيعوا "تكامل واتساب" كموديول. النسخة اللي هنا مش نفس
// الحاجة - مابتبعتش لوحدها، صاحب المحل بيدوس إرسال. بس ٩٠٪ من
// الفايدة بصفر تكلفة وصفر تعقيد، وde كفاية للمحل الصغير.
//
// **مانسمّيهاش "إرسال تلقائي"** في أي مكان. الفرق ده لازم يفضل واضح.
//
// ============================================================
// الأرقام المصرية
// ============================================================
//
// wa.me عايز الرقم الدولي من غير + ولا صفر بادئ ولا مسافات.
// المصري بيكتب رقمه ٠١٠٠١٢٣٤٥٦٧، والمطلوب 201001234567.

const EGYPT_CODE = "20";

// أرقام عربية شرقية → لاتينية. الناس بتكتب بالاتنين، وwa.me بيفهم
// اللاتيني بس.
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

function toLatinDigits(value: string): string {
  return value.replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)));
}

/** الرقم بالصيغة اللي wa.me بيفهمها، أو null لو مش رقم صالح. */
export function toWhatsAppNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;

  let digits = toLatinDigits(raw).replace(/\D/g, "");

  if (!digits) return null;

  // 0020… أو 20… → شيل البادئة الدولية عشان نعيد بناءها موحّدة
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith(EGYPT_CODE)) digits = digits.slice(EGYPT_CODE.length);

  // ٠١٠٠… → ١٠٠…
  if (digits.startsWith("0")) digits = digits.slice(1);

  // موبايل مصري بعد شيل الصفر: ١٠ أرقام وبيبدأ بـ1
  // (10/11/12/15 حسب الشبكة). أقل من كده مش رقم موبايل.
  if (digits.length !== 10 || !digits.startsWith("1")) return null;

  return EGYPT_CODE + digits;
}

export type ReceiptLine = Pick<CartItem, "quantity" | "total"> & {
  item: { name: string };
};

export type ReceiptText = {
  businessName?: string | null;
  lines: ReceiptLine[];
  total: number;
  discountAmount: number;
  createdAt: Date;
  quote?: boolean;
};

function money(value: number): string {
  return value.toFixed(2);
}

/** نص الفاتورة. بيتقرا في واتساب من غير جداول ولا تنسيق. */
export function buildReceiptText(receipt: ReceiptText): string {
  const subtotal = receipt.lines.reduce((sum, line) => sum + line.total, 0);

  const parts: string[] = [];

  if (receipt.businessName) parts.push(`*${receipt.businessName}*`);

  parts.push(
    receipt.quote ? "عرض سعر — مش فاتورة بيع" : "فاتورة",
    receipt.createdAt.toLocaleString("ar-EG", {
      dateStyle: "short",
      timeStyle: "short",
    }),
    ""
  );

  for (const line of receipt.lines) {
    // الكمية بتتكتب من غير كسور لو هي رقم صحيح: "٢ × شاي" أنضف من
    // "2.00 × شاي" على شاشة موبايل.
    const qty = Number.isInteger(line.quantity)
      ? String(line.quantity)
      : line.quantity.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");

    parts.push(`${qty} × ${line.item.name} — ${money(line.total)}`);
  }

  parts.push("");

  if (receipt.discountAmount > 0) {
    parts.push(`الإجمالي: ${money(subtotal)}`);
    parts.push(`الخصم: ${money(receipt.discountAmount)}`);
  }

  parts.push(`*المطلوب: ${money(receipt.total)} جنيه*`);

  if (!receipt.quote) parts.push("", "شكرًا لزيارتكم 🐙");

  return parts.join("\n");
}

/** رابط واتساب جاهز. من غير رقم بيفتح "اختار جهة اتصال". */
export function whatsAppLink(
  text: string,
  phone?: string | null
): string {
  const number = toWhatsAppNumber(phone);
  const encoded = encodeURIComponent(text);

  return number
    ? `https://wa.me/${number}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;
}
