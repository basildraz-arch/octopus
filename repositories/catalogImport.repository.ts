import { supabase } from "@/lib/supabase";
import type { Warehouse } from "@/types/warehouse";

// Bulk paths for the catalogue importer. Written as set-based inserts
// rather than reusing createItem() in a loop: a 79-row price list
// would otherwise be ~160 sequential round trips, which is slow enough
// on a shop's connection to look broken.

export async function ensureDefaultWarehouse(
  businessId: string
): Promise<Warehouse> {
  const { data: existing } = await supabase
    .from("warehouses")
    .select("*")
    .eq("business_id", businessId)
    .eq("is_default", true)
    .maybeSingle();

  if (existing) return existing as Warehouse;

  // Older businesses (created before every signup got one) may have
  // no default warehouse at all - make one rather than failing an
  // import the owner is watching.
  const { data, error } = await supabase
    .from("warehouses")
    .insert({ business_id: businessId, name: "المخزن الرئيسي", is_default: true })
    .select()
    .single();

  if (error) throw error;

  return data as Warehouse;
}

export async function bulkCreateCategories(
  businessId: string,
  names: string[]
): Promise<Record<string, string>> {
  if (names.length === 0) return {};

  const { data, error } = await supabase
    .from("categories")
    .insert(
      names.map((name) => ({ business_id: businessId, name, active: true }))
    )
    .select("id, name");

  if (error) throw error;

  const byName: Record<string, string> = {};

  for (const row of data ?? []) byName[row.name] = row.id;

  return byName;
}

export type ItemInsert = {
  business_id: string;
  category_id: string | null;
  name: string;
  barcode: string | null;
  item_type: "product";
  sale_method: "piece";
  unit: string;
  buy_price: number;
  sell_price: number;
  sell_price_2: number | null;
  sell_price_3: number | null;
  stock: number;
  minimum_stock: number;
  has_stock: boolean;
  active: boolean;
  keywords: string[];
};

export async function bulkCreateItems(
  items: ItemInsert[]
): Promise<{ id: string; name: string; stock: number; buy_price: number }[]> {
  if (items.length === 0) return [];

  // التكلفة مابتترجعش من قاعدة البيانات - العمود ممنوع للقراءة
  // (ميجريشن 069). وهي أصلًا معروفة: إحنا اللي بعتناها. فبنطابق
  // الراجع بالمبعوت بالاسم بدل ما نسأل عليها تاني.
  const { data, error } = await supabase
    .from("items")
    .insert(items)
    .select("id, name, stock");

  if (error) throw error;

  const costByName = new Map(items.map((i) => [i.name, i.buy_price]));

  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    stock: Number(row.stock),
    buy_price: Number(costByName.get(row.name as string) ?? 0),
  }));
}

// Opening stock. Without these rows the item shows a quantity that
// the FIFO batch logic can't actually draw from, so a sale would fail
// its availability check.
export async function bulkCreateOpeningBatches(
  businessId: string,
  warehouseId: string,
  rows: { id: string; stock: number; buy_price: number }[]
): Promise<void> {
  const batches = rows
    .filter((r) => r.stock > 0)
    .map((r) => ({
      business_id: businessId,
      item_id: r.id,
      warehouse_id: warehouseId,
      purchase_id: null,
      quantity: r.stock,
      remaining_quantity: r.stock,
      buy_price: r.buy_price,
    }));

  if (batches.length === 0) return;

  const { error } = await supabase.from("stock_batches").insert(batches);

  if (error) throw error;
}

export async function getExistingItemNames(
  businessId: string
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("items")
    .select("name")
    .eq("business_id", businessId);

  // بنرمي مش بنرجّع فاضي.
  //
  // المجموعة دي هي اللي بتمنع التكرار. لو رجعت فاضية عند خطأ، الاستيراد
  // بيكمّل وهو فاكر إن المحل فاضي و**بيضيف الكتالوج كله تاني**. صاحب
  // المحل بيشوف "اتضاف ٧٩ صنف" ويفتكرها نجاح، والقايمة بقت ١٥٨.
  //
  // ووقتها التنضيف يدوي: ٧٩ صنف يتمسحوا واحد واحد، ومحدش عارف مين
  // النسخة الأصلية ومين المكررة.
  //
  // خطأ واضح وقت الاستيراد أرخص من ده بكتير.
  if (error) throw new Error(`مش قادر أقرا أصناف المحل: ${error.message}`);

  return new Set((data ?? []).map((r) => r.name.trim().toLowerCase()));
}

export async function getExistingCategoryMap(
  businessId: string
): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name")
    .eq("business_id", businessId);

  // نفس السبب: لو دي رجعت فاضية، كل الفئات الموجودة هتتعمل تاني
  // بنفس الأسماء.
  if (error) throw new Error(`مش قادر أقرا فئات المحل: ${error.message}`);

  const byName: Record<string, string> = {};

  for (const row of data ?? []) byName[row.name.trim().toLowerCase()] = row.id;

  return byName;
}
