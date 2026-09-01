import { supabase } from "@/lib/supabase";
import type { CartItem } from "@/components/Cart";
import type { PaymentMethod } from "@/types/sale";
import { getOrCreateOpenShift } from "@/repositories/shift.repository";
import { checkAvailability } from "@/repositories/stockBatch.repository";
import { logActivity } from "@/repositories/activity.repository";
// priceForTier اتشال من هنا عن قصد: السعر بقى بيتحدد في القاعدة
// (record_sale)، والملف ده مابقاش يعرف بكام بيتباع. لسه مستعمل في
// الشاشات عشان توري السعر للكاشير قبل ما يبيع.
import type { PriceTier } from "@/lib/priceTier";

export type SaleWithItems = {
  id: string;
  total: number;
  created_at: string;
  sale_items: {
    id: string;
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
      sale_items (
        id,
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

export async function createSale(
  businessId: string,
  createdBy: string,
  cart: CartItem[],
  paymentMethod: PaymentMethod,
  discountAmount: number = 0,
  warehouseId: string,
  priceTier: PriceTier = 1,
  customerId: string | null = null
) {
  // The database enforces this too (sales_credit_needs_customer_check),
  // but failing here gives the cashier a sentence instead of a
  // constraint name.
  if (paymentMethod === "credit" && !customerId) {
    throw new Error("اختار العميل الأول عشان تبيع على الحساب");
  }

  for (const line of cart) {
    if (line.item.has_stock) {
      const available = await checkAvailability(
        line.item.id,
        line.quantity,
        warehouseId
      );

      if (!available) {
        throw new Error(
          `الكمية المطلوبة من "${line.item.name}" أكبر من المخزون المتاح`
        );
      }
    }
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
  });

  if (error) throw new Error(error.message);

  await logActivity(createdBy, businessId);

  return { id: saleId as string };
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
