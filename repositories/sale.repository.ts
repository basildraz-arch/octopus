import { supabase } from "@/lib/supabase";
import type { CartItem } from "@/components/Cart";
import type { PaymentMethod } from "@/types/sale";
import { getOrCreateOpenShift } from "@/repositories/shift.repository";
import {
  checkAvailability,
  drawFromBatches,
} from "@/repositories/stockBatch.repository";
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

  const costByItemId: Record<string, number> = {};

  for (const line of cart) {
    if (line.item.has_stock) {
      const draws = await drawFromBatches(line.item.id, line.quantity, warehouseId);

      costByItemId[line.item.id] = draws.reduce(
        (sum, draw) => sum + draw.quantity * draw.buyPrice,
        0
      );
    }
  }

  const saleItems = cart.map((line) => ({
    sale_id: sale.id,
    item_id: line.item.id,
    quantity: line.quantity,
    unit_price: priceForTier(line.item, priceTier),
    total: line.total,
    cost: line.item.has_stock ? costByItemId[line.item.id] : null,
  }));

  const { error: itemsError } = await supabase
    .from("sale_items")
    .insert(saleItems);

  if (itemsError) throw itemsError;

  // The item's stock and average cost are recalculated inside
  // draw_stock_fifo, in the same transaction as the draw itself
  // (migration 053). Writing them again from here would need the till
  // to hold UPDATE on items, which is exactly what that migration
  // took away.

  await logActivity(createdBy, businessId);

  return sale;
}
