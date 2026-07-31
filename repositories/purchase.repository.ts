import { supabase } from "@/lib/supabase";
import { updateItem } from "@/repositories/item.repository";
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

  await updateItem(item.id, {
    stock: item.stock + quantity,
    buy_price: buyPrice,
  });

  return data as Purchase;
}
