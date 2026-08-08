import { supabase } from "@/lib/supabase";
import { updateItem } from "@/repositories/item.repository";
import {
  createBatch,
  getCurrentStockAndCost,
} from "@/repositories/stockBatch.repository";
import { getDefaultWarehouse } from "@/repositories/warehouse.repository";
import type { Item } from "@/types/item";

export type Purchase = {
  id: string;
  business_id: string;
  item_id: string;
  created_by: string | null;
  quantity: number;
  buy_price: number;
  total: number;
  created_at: string;
};

export async function createPurchase(
  businessId: string,
  createdBy: string,
  item: Item,
  quantity: number,
  buyPrice: number
): Promise<Purchase> {
  if (item.item_type !== "product") {
    throw new Error("لا يمكن تسجيل عملية شراء لصنف من نوع خدمة");
  }

  const total = quantity * buyPrice;

  const { data, error } = await supabase
    .from("purchases")
    .insert({
      business_id: businessId,
      item_id: item.id,
      created_by: createdBy,
      quantity,
      buy_price: buyPrice,
      total,
    })
    .select()
    .single();

  if (error) throw error;

  const warehouse = await getDefaultWarehouse(businessId);

  await createBatch(businessId, item.id, warehouse.id, data.id, quantity, buyPrice);

  const { stock, averageCost } = await getCurrentStockAndCost(item.id);

  await updateItem(item.id, {
    stock,
    buy_price: averageCost,
  });

  return data as Purchase;
}
