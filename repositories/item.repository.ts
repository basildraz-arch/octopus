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

// كل أعمدة items ما عدا buy_price.
//
// كانت select("*")، وde مبقاش ينفع: العمود ممنوع على مستوى قاعدة
// البيانات (ميجريشن 069) والنجمة بتطلبه فبيرفض الاستعلام كله - حتى
// لصاحب المحل. التكلفة بتيجي من itemCost.repository لوحدها.
//
// لو اتضاف عمود جديد لـitems، لازم يتضاف هنا كمان.
// لازم تفضل نص ثابت مكتوب كده، مش مصفوفة مع join. الفرق مش شكلي:
// Supabase بيقرا قايمة الأعمدة من النص نفسه وقت فحص الأنواع عشان
// يعرف شكل الصف الراجع. join بيطلّع string عادي، فالنوع الراجع بيبقى
// مجهول - وده اللي وقّع الـbuild أول مرة.
const ITEM_COLUMNS =
  "id, business_id, category_id, name, barcode, item_type, sale_method, unit, sell_price, sell_price_2, sell_price_3, min_sell_price, stock, minimum_stock, has_stock, image, keywords, active, created_at, updated_at";

export async function getItems(): Promise<Item[]> {
  const { data, error } = await supabase
    .from("items")
    .select(ITEM_COLUMNS)
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
    .select(ITEM_COLUMNS)
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
    .select(ITEM_COLUMNS)
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
    .select(ITEM_COLUMNS)
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
    .select(ITEM_COLUMNS);

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
      item.buy_price ?? 0
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
    // التكلفة بتاعة الدفعة الجديدة. لو اللي بيعدّل مالوش صلاحية
    // يشوف التكلفة فمش هيوصل للشاشة دي أصلًا (manage_items)، بس
    // الاحتياط أرخص من دفعة بتكلفة صفر.
    await createBatch(
      businessId,
      item.id,
      warehouse.id,
      null,
      diff,
      item.buy_price ?? 0
    );
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