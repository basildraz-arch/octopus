import { supabase } from "@/lib/supabase";
import type { CartItem } from "@/components/Cart";
import type { PaymentMethod } from "@/types/sale";
import { getOrCreateOpenShift } from "@/repositories/shift.repository";
import { updateItem } from "@/repositories/item.repository";
import {
  checkAvailability,
  drawFromBatches,
  getCurrentStockAndCost,
} from "@/repositories/stockBatch.repository";

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
  paymentMethod: PaymentMethod
) {
  for (const line of cart) {
    if (line.item.has_stock) {
      const available = await checkAvailability(
        line.item.id,
        line.quantity
      );

      if (!available) {
        throw new Error(
          `الكمية المطلوبة من "${line.item.name}" أكبر من المخزون المتاح`
        );
      }
    }
  }

  const shift = await getOrCreateOpenShift(businessId);

  const total = cart.reduce(
    (sum, line) => sum + line.total,
    0
  );

  const { data: sale, error: saleError } = await supabase
    .from("sales")
    .insert({
      business_id: businessId,
      created_by: createdBy,
      shift_id: shift.id,
      payment_method: paymentMethod,
      total,
    })
    .select()
    .single();

  if (saleError) throw saleError;

  const costByItemId: Record<string, number> = {};

  for (const line of cart) {
    if (line.item.has_stock) {
      const draws = await drawFromBatches(line.item.id, line.quantity);

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
    unit_price: line.item.sell_price,
    total: line.total,
    cost: line.item.has_stock ? costByItemId[line.item.id] : null,
  }));

  const { error: itemsError } = await supabase
    .from("sale_items")
    .insert(saleItems);

  if (itemsError) throw itemsError;

  for (const line of cart) {
    if (line.item.has_stock) {
      const { stock, averageCost } = await getCurrentStockAndCost(
        line.item.id
      );

      await updateItem(line.item.id, {
        stock,
        buy_price: averageCost,
      });
    }
  }

  return sale;
}
