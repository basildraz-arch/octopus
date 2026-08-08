import { supabase } from "@/lib/supabase";
import {
  createBatch,
  drawFromBatches,
  getCurrentStockAndCost,
} from "@/repositories/stockBatch.repository";
import { getDefaultWarehouse } from "@/repositories/warehouse.repository";

import type {
  Item,
  ItemFormData,
} from "@/types/item";

export async function getItems(): Promise<Item[]> {
  const { data, error } = await supabase
    .from("items")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("Supabase Error:", error.message);
    return [];
  }

  return (data ?? []) as Item[];
}

export async function getItemById(
  id: string
): Promise<Item | null> {
  const { data, error } = await supabase
    .from("items")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Supabase Error:", error.message);
    return null;
  }

  return data as Item;
}

export async function findItemByName(
  name: string
): Promise<Item | null> {
  const { data, error } = await supabase
    .from("items")
    .select("*")
    .ilike("name", name.trim())
    .maybeSingle();

  if (error) {
    console.error("Supabase Error:", error.message);
    return null;
  }

  return data as Item | null;
}

export async function getActiveItems(): Promise<Item[]> {
  const { data, error } = await supabase
    .from("items")
    .select("*")
    .eq("active", true)
    .order("name", { ascending: true });

  if (error) {
    console.error("Supabase Error:", error.message);
    return [];
  }

  return (data ?? []) as Item[];
}

export async function createItem(
  item: ItemFormData
) {
  const { data, error } = await supabase
    .from("items")
    .insert(item)
    .select();

  if (error) throw error;

  const newItem = data?.[0];

  if (newItem && item.has_stock && item.stock > 0) {
    const warehouse = await getDefaultWarehouse(item.business_id);

    await createBatch(
      item.business_id,
      newItem.id,
      warehouse.id,
      null,
      item.stock,
      item.buy_price
    );
  }

  return data;
}

export async function updateItem(
  id: string,
  item: Partial<ItemFormData>
) {
  const { error } = await supabase
    .from("items")
    .update(item)
    .eq("id", id);

  if (error) throw error;
}

export async function adjustItemStock(
  businessId: string,
  item: Item,
  newStock: number
): Promise<void> {
  const { stock: actualStock } = await getCurrentStockAndCost(item.id);

  const diff = newStock - actualStock;

  if (diff === 0) return;

  const warehouse = await getDefaultWarehouse(businessId);

  if (diff > 0) {
    await createBatch(businessId, item.id, warehouse.id, null, diff, item.buy_price);
  } else {
    await drawFromBatches(item.id, Math.abs(diff), warehouse.id);
  }

  const { stock, averageCost } = await getCurrentStockAndCost(item.id);

  await updateItem(item.id, {
    stock,
    buy_price: averageCost,
  });
}

export async function deleteItem(id: string) {
  const { error } = await supabase
    .from("items")
    .delete()
    .eq("id", id);

  if (error) throw error;
}