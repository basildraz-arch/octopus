import { supabase } from "@/lib/supabase";
import type { CartItem } from "@/components/Cart";
import type { PaymentMethod } from "@/types/sale";
import { getOrCreateOpenShift } from "@/repositories/shift.repository";
import { checkAvailability } from "@/repositories/stockBatch.repository";
import { logActivity } from "@/repositories/activity.repository";
import { priceForTier, type PriceTier } from "@/lib/priceTier";

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

  const subtotal = cart.reduce(
    (sum, line) => sum + line.total,
    0
  );

  const total = subtotal - discountAmount;

  const { data: sale, error: saleError } = await supabase
    .from("sales")
    .insert({
      business_id: businessId,
      created_by: createdBy,
      shift_id: shift.id,
      payment_method: paymentMethod,
      total,
      discount_amount: discountAmount,
      price_tier: priceTier,
      customer_id: customerId,
    })
    .select()
    .single();

  if (saleError) throw saleError;

  // سطر سطر، وكل سطر بيتكتب جوه قاعدة البيانات (ميجريشن 071).
  //
  // كان الكود هنا بينادي draw_stock_fifo، **بيستلم سعر شرا كل دفعة
  // اتسحبت**، بيضرب ويجمع، وبيكتب sale_items.cost. يعني تكلفة كل
  // صنف بيبيعه الكاشير كانت بتعدّي على متصفحه.
  //
  // sell_line بتعمل التلات خطوات جوه القاعدة: تسحب FIFO، تحسب
  // التكلفة، وتكتب السطر. الراجع للمتصفح "تمام" وبس. التكلفة
  // مابتتحسبش هنا أصلًا، فمفيش حاجة تتسرّب حتى لو حد قرا الكود كله.
  for (const line of cart) {
    const { error } = await supabase.rpc("sell_line", {
      p_sale_id: sale.id,
      p_item_id: line.item.id,
      p_quantity: line.quantity,
      p_warehouse_id: warehouseId,
      p_unit_price: priceForTier(line.item, priceTier),
      p_total: line.total,
    });

    if (error) throw new Error(error.message);
  }

  await logActivity(createdBy, businessId);

  return sale;
}
