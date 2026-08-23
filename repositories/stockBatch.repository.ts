import { supabase } from "@/lib/supabase";

export type StockBatch = {
  id: string;
  business_id: string;
  item_id: string;
  warehouse_id: string;
  purchase_id: string | null;
  quantity: number;
  remaining_quantity: number;
  buy_price: number;
  created_at: string;
};

export type BatchDraw = {
  batchId: string;
  quantity: number;
  buyPrice: number;
};

export async function createBatch(
  businessId: string,
  itemId: string,
  warehouseId: string,
  purchaseId: string | null,
  quantity: number,
  buyPrice: number
): Promise<StockBatch> {
  const { data, error } = await supabase
    .from("stock_batches")
    .insert({
      business_id: businessId,
      item_id: itemId,
      warehouse_id: warehouseId,
      purchase_id: purchaseId,
      quantity,
      remaining_quantity: quantity,
      buy_price: buyPrice,
    })
    .select()
    .single();

  if (error) throw error;

  return data as StockBatch;
}

// كان بيقرا الدفعات كلها من المتصفح عشان يجمع الكميات - وde كان
// بيمرّ عليه سعر الشرا بتاع كل دفعة كمان. الكاشير محتاج يعرف "فيه كام
// متاح؟" وبس، فالسؤال ده بقى دالة في قاعدة البيانات بترجّع رقم واحد
// (ميجريشن 069). دلوقتي قراءة stock_batches نفسها بقت محتاجة صلاحية.
export async function checkAvailability(
  itemId: string,
  quantityNeeded: number,
  warehouseId: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc("available_quantity", {
    p_item_id: itemId,
    p_warehouse_id: warehouseId,
  });

  if (error) {
    console.error("Supabase Error:", error.message);
    return false;
  }

  return Number(data ?? 0) >= quantityNeeded;
}

// The FIFO draw used to happen here: read the batches, then send one
// UPDATE per batch from the browser. That needed every cashier to hold
// UPDATE on stock_batches and on items - the last broad write a
// cashier had - and it raced: two tills selling the last unit at the
// same moment both read "1 available" and both sold it.
//
// It is now one call to draw_stock_fifo (migration 053), which locks
// the batches, decrements them, and recalculates the item's stock and
// average cost in the same transaction. The permission check lives
// inside that function, so the till no longer needs write access to
// either table.
export async function drawFromBatches(
  itemId: string,
  quantityNeeded: number,
  warehouseId: string
): Promise<BatchDraw[]> {
  const { data, error } = await supabase.rpc("draw_stock_fifo", {
    p_item_id: itemId,
    p_quantity: quantityNeeded,
    p_warehouse_id: warehouseId,
  });

  if (error) throw new Error(error.message);

  return (data ?? []) as BatchDraw[];
}

export async function getCurrentStockAndCost(
  itemId: string
): Promise<{ stock: number; averageCost: number }> {
  const { data, error } = await supabase
    .from("stock_batches")
    .select("*")
    .eq("item_id", itemId)
    .gt("remaining_quantity", 0);

  if (error) {
    console.error("Supabase Error:", error.message);
    return { stock: 0, averageCost: 0 };
  }

  const batches = (data ?? []) as StockBatch[];

  let stock = 0;
  let totalCost = 0;

  for (const batch of batches) {
    const qty = Number(batch.remaining_quantity);
    const price = Number(batch.buy_price);

    stock += qty;
    totalCost += qty * price;
  }

  const averageCost = stock > 0 ? totalCost / stock : 0;

  return { stock, averageCost };
}

export type WarehouseStock = {
  warehouse_id: string;
  warehouse_name: string;
  quantity: number;
};

// نفس السبب: التجميع بقى في قاعدة البيانات، والراجع كمية بس.
export async function getStockByWarehouse(
  itemId: string
): Promise<WarehouseStock[]> {
  const { data, error } = await supabase.rpc("stock_by_warehouse", {
    p_item_id: itemId,
  });

  if (error) {
    console.error("Supabase Error:", error.message);
    return [];
  }

  return ((data ?? []) as WarehouseStock[]).map((row) => ({
    warehouse_id: row.warehouse_id,
    warehouse_name: row.warehouse_name ?? "",
    quantity: Number(row.quantity),
  }));
}
