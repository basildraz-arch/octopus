import { supabase } from "@/lib/supabase";
import type { CartItem } from "@/components/Cart";
import type { PaymentMethod } from "@/types/sale";
import { getOrCreateOpenShift } from "@/repositories/shift.repository";
import { logActivity } from "@/repositories/activity.repository";
// priceForTier اتشال من هنا عن قصد: السعر بقى بيتحدد في القاعدة
// (record_sale)، والملف ده مابقاش يعرف بكام بيتباع. لسه مستعمل في
// الشاشات عشان توري السعر للكاشير قبل ما يبيع.
import type { PriceTier } from "@/lib/priceTier";

export type SaleWithItems = {
  id: string;
  total: number;
  created_at: string;
  // الرقم المسلسل. بيفضل null في الفواتير اللي اتسجّلت قبل
  // ميجريشن ٠٩٣ لو حصل، والشاشة بتخفيه ساعتها.
  invoice_number: number | null;
  sale_items: {
    id: string;
    // لازم للمرتجع: الدالة بتاخد `item_id` مش `id` بتاع السطر.
    item_id: string;
    quantity: number;
    unit_price: number;
    total: number;
    items: { name: string; unit: string } | null;
  }[];
};

export async function getSalesByDateRange(
  businessId: string,
  startDate: string,
  endDate: string
): Promise<SaleWithItems[]> {
  const start = new Date(`${startDate}T00:00:00`).toISOString();
  const end = new Date(`${endDate}T23:59:59.999`).toISOString();

  const { data, error } = await supabase
    .from("sales")
    .select(
      `
      id,
      total,
      created_at,
      invoice_number,
      sale_items (
        id,
        item_id,
        quantity,
        unit_price,
        total,
        items ( name, unit )
      )
    `
    )
    .eq("business_id", businessId)
    .gte("created_at", start)
    .lte("created_at", end)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Supabase Error:", error.message);
    return [];
  }

  return (data ?? []) as unknown as SaleWithItems[];
}

// ============================================================
// الخامات الناقصة - قبل البيع
// ============================================================
//
// بترجّع الحاجات اللي المسجّل منها أقل من المطلوب، عشان الشاشة
// تسأل الكاشير «أكمّل؟» بدل ما البيع يترفض في وشه.
//
// **الحساب في القاعدة كله** (`sale_stock_shortages`، ميجريشن ١٠٠).
// الكود اللي كان هنا قبل كده كان بيعمل الفحص في المتصفح، بـ`await`
// لكل سطر لوحده، وكان فيه عيبين حقيقيين:
//
// ١. **كان بيتجاهل الوصفات خالص** - بيسأل عن مخزون الصنف نفسه، مش
//    عن مكوّناته. فكوباية القهوة كانت تعدّي الفحص وتقع جوه
//    `sell_line`.
// ٢. **كان بيحسب كل سطر لوحده** - لاتيه وكابتشينو الاتنين بياخدوا
//    لبن، فكل سطر كان بيشوف اللبن كامل ويعدّي، والمجموع أكبر من
//    الموجود.
//
// والتحقق الحقيقي فاضل جوه `sell_line`. دي للسؤال بس (§٦: التحقق
// المكرر بيفترق مع الوقت، فالمرجع واحد).

export type StockShortage = {
  name: string;
  unit: string;
  needed: number;
  available: number;
};

export async function getStockShortages(
  cart: CartItem[],
  warehouseId: string
): Promise<StockShortage[]> {
  const { data, error } = await supabase.rpc("sale_stock_shortages", {
    p_warehouse_id: warehouseId,
    p_lines: cart.map((line) => ({
      item_id: line.item.id,
      quantity: line.quantity,
    })),
  });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as {
    item_name: string | null;
    unit: string | null;
    needed: number | string;
    available: number | string;
  }[];

  return rows.map((row) => ({
    name: row.item_name ?? "—",
    unit: row.unit ?? "",
    needed: Number(row.needed),
    available: Number(row.available),
  }));
}

export async function createSale(
  businessId: string,
  createdBy: string,
  cart: CartItem[],
  paymentMethod: PaymentMethod,
  discountAmount: number = 0,
  warehouseId: string,
  priceTier: PriceTier = 1,
  customerId: string | null = null,

  // ============================================================
  // تأكيد الكاشير إن المخزون المسجّل أقل من الحقيقة
  // ============================================================
  //
  // الافتراضي `false`، يعني السلوك القديم بالظبط: القاعدة ترفض.
  // بيبقى `true` **بعد ما الكاشير يشوف الناقص ويدوس أكمّل** - مش
  // إعداد ولا استثناء دايم.
  //
  // السبب: الشوال السكر اللي اتشترى ومحدش سجّله موجود في المطبخ،
  // واللي ناقص هو التسجيل مش الخامة. والبرنامج اللي بيقف في وش
  // الزبون ويقول "السكر خلص" وصاحب المحل شايفه بعينه بيخلّي الواحد
  // يرجع للورقة.
  allowShort: boolean = false
) {
  // The database enforces this too (sales_credit_needs_customer_check),
  // but failing here gives the cashier a sentence instead of a
  // constraint name.
  if (paymentMethod === "credit" && !customerId) {
    throw new Error("اختار العميل الأول عشان تبيع على الحساب");
  }

  const shift = await getOrCreateOpenShift(businessId);

  // الفاتورة كلها نداء واحد (ميجريشن 075).
  //
  // اللي اتغير مش شكلي - حاجتين:
  //
  // ١. **مفيش أسعار بتتبعت.** بنبعت الصنف والكمية بس، والقاعدة
  //    بتجيب السعر من items حسب التسعيرة. قبل كده الكود هنا كان
  //    بيحسب السعر ويبعته كرقم، والقاعدة بتكتبه زي ما هو - يعني
  //    أي حد يفتح أدوات المطوّر كان يقدر يبيع صنف بـ٢٣٠ بجنيه.
  //    اتجرّب وعدّى فعلًا.
  //
  // ٢. **الفاتورة بقت عملية واحدة.** كان كل سطر بينداله sell_line
  //    لوحده، فلو النت قطع في النص، اللي فات بيبقى اتخصم من
  //    المخزون والباقي لأ.
  //
  // الخصم لسه بيتبعت لأنه رقم المالك بيسمّيه وقت البيع - بس القاعدة
  // بتتحقق منه: صلاحية give_discount، وحد max_discount_percent،
  // ومايزيدش عن قيمة الفاتورة.
  const { data: saleId, error } = await supabase.rpc("record_sale", {
    p_shift_id: shift.id,
    p_warehouse_id: warehouseId,
    p_payment_method: paymentMethod,
    p_price_tier: priceTier,
    p_discount: discountAmount,
    p_customer_id: customerId,
    p_lines: cart.map((line) => ({
      item_id: line.item.id,
      quantity: line.quantity,
    })),
    p_allow_short: allowShort,
  });

  if (error) throw new Error(error.message);

  await logActivity(createdBy, businessId);

  // رقم الفاتورة المسلسل بيتخصّص جوه `record_sale` (ميجريشن ٠٩٣).
  //
  // بيتجاب بنداء تاني بدل ما نغيّر نوع اللي بترجّعه الدالة: تغيير
  // توقيع دالة شغّالة على محل حقيقي معناه drop + create، ولحظة
  // بينهم البيع واقف. النداء ده قراءة سطر واحد بمفتاحه.
  //
  // ولو فشل، البيعة **اتسجّلت خلاص** - الرقم بيغيب عن الورقة وبس.
  // عشان كده مفيش throw هنا: فاتورة من غير رقم أحسن من رسالة خطأ
  // بعد بيعة ناجحة.
  const { data: row } = await supabase
    .from("sales")
    .select("invoice_number")
    .eq("id", saleId as string)
    .maybeSingle();

  return {
    id: saleId as string,
    invoiceNumber: (row?.invoice_number as number | null) ?? null,
  };
}

// ============================================================
// إلغاء فاتورة اتسجّلت غلط
// ============================================================
//
// الشغل كله في القاعدة (`void_sale`، ميجريشن ٠٨٥): التحقق من
// الصلاحية، ورجوع البضاعة للدفعات بتكلفتها المسجّلة، وكتابة السجل،
// والمسح — كلهم في عملية واحدة.
//
// **مافيش أي نسخة من المنطق ده هنا** عن قصد. لو الرجوع اتعمل في
// المتصفح، أي حد يقفل التاب في النص يسيب فاتورة متمسوحة وبضاعة
// مارجعتش — أو العكس.
//
// الرسايل الراجعة من القاعدة عربية وموجّهة للمستخدم ("إلغاء
// الفواتير لصاحب النشاط بس"، "اليوم ده اتقفل — افتحه الأول")،
// فبنعرضها زي ما هي بدل ما نخترع رسالة أعم منها.
export async function voidSale(
  saleId: string,
  reason?: string,
  warehouseId?: string | null
): Promise<void> {
  const { error } = await supabase.rpc("void_sale", {
    p_sale_id: saleId,
    p_reason: reason ?? null,
    p_warehouse_id: warehouseId ?? null,
  });

  if (error) throw new Error(error.message);
}


// ============================================================
// المرتجع الجزئي
// ============================================================
//
// الزبون اشترى تلاتة ورجّع واحد. الفاتورة تفضل موجودة ناقصة السطر
// ده - على عكس `voidSale` اللي بتشيل الفاتورة كلها (وdi للفاتورة
// اللي **اتسجّلت غلط**، مش للبيعة اللي رجع منها حاجة).
//
// الشغل كله في `return_sale_lines` (ميجريشن ٠٩٠): التحقق من
// الصلاحية، ومنع إرجاع أكتر من المباع، ورجوع البضاعة بتكلفتها،
// وتقليص الخصم بالنسبة، وتحديث إجمالي الفاتورة - في عملية واحدة.
//
// بترجّع قيمة المرتجع بالجنيه عشان الشاشة تقول لصاحب المحل
// "ترجّع كام".
export async function returnSaleLines(
  saleId: string,
  lines: { itemId: string; quantity: number }[],
  reason?: string,
  warehouseId?: string | null
): Promise<number> {
  const { data, error } = await supabase.rpc("return_sale_lines", {
    p_sale_id: saleId,
    p_lines: lines.map((l) => ({ item_id: l.itemId, quantity: l.quantity })),
    p_reason: reason ?? null,
    p_warehouse_id: warehouseId ?? null,
  });

  if (error) throw new Error(error.message);

  return Number(data ?? 0);
}

// ============================================================
// الفواتير الملغية والمرتجعات
// ============================================================
//
// السجلين دول (`sale_voids` و`sale_returns`) موجودين من ميجريشن
// ٠٨٥ و٠٩٠ بس **مكانش فيه شاشة بتقراهم** - يعني الأثر متسجّل
// ومحدش يقدر يشوفه.
//
// وde بقى ناقص بعد ميجريشن ٠٩٣: الفواتير بقى ليها أرقام مسلسلة،
// و`void_sale` بتمسح الصف - فإلغاء فاتورة رقم ٤٧ بيسيب **فجوة في
// دفتر الفواتير**. الفجوة من غير سطر بيفسّرها أول حاجة بيتسأل
// عنها في أي مراجعة.
//
// القراءة محمية بـpolicy: صاحب النشاط أو اللي معاه `view_reports`.
// الكاشير مابيشوفش الشاشة دي أصلًا.

export type VoidedSale = {
  id: string;
  sale_id: string;
  invoice_number: number | null;
  sale_total: number;
  sale_created_at: string;
  voided_at: string;
  reason: string | null;
  lines: { name: string; quantity: number; total: number }[];
  users: { full_name: string } | null;
};

export type SaleReturn = {
  id: string;
  sale_id: string;
  refund_amount: number;
  returned_at: string;
  reason: string | null;
  lines: { name: string; quantity: number }[];
  users: { full_name: string } | null;
};

export async function getVoidedSales(
  businessId: string,
  startDate: string,
  endDate: string
): Promise<VoidedSale[]> {
  const start = new Date(`${startDate}T00:00:00`).toISOString();
  const end = new Date(`${endDate}T23:59:59.999`).toISOString();

  const { data, error } = await supabase
    .from("sale_voids")
    .select(
      "id, sale_id, invoice_number, sale_total, sale_created_at, voided_at, reason, lines, users:voided_by ( full_name )"
    )
    .eq("business_id", businessId)
    .gte("voided_at", start)
    .lte("voided_at", end)
    .order("voided_at", { ascending: false });

  if (error) {
    console.error("Supabase Error:", error.message);
    return [];
  }

  return (data ?? []) as unknown as VoidedSale[];
}

export async function getSaleReturns(
  businessId: string,
  startDate: string,
  endDate: string
): Promise<SaleReturn[]> {
  const start = new Date(`${startDate}T00:00:00`).toISOString();
  const end = new Date(`${endDate}T23:59:59.999`).toISOString();

  const { data, error } = await supabase
    .from("sale_returns")
    .select(
      "id, sale_id, refund_amount, returned_at, reason, lines, users:returned_by ( full_name )"
    )
    .eq("business_id", businessId)
    .gte("returned_at", start)
    .lte("returned_at", end)
    .order("returned_at", { ascending: false });

  if (error) {
    console.error("Supabase Error:", error.message);
    return [];
  }

  return (data ?? []) as unknown as SaleReturn[];
}
