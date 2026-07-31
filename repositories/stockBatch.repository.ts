import { supabase } from "@/lib/supabase";

export type StockBatch = {
  id: string;
  business_id: string;
  item_id: string;
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
  purchaseId: string | null,
  quantity: number,
  buyPrice: number
): Promise<StockBatch> {
  const { data, error } = await supabase
    .from("stock_batches")
    .insert({
      business_id: businessId,
      item_id: itemId,
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

export async function getAvailableBatches(
  itemId: string
): Promise<StockBatch[]> {
  const { data, error } = await supabase
    .from("stock_batches")
    .select("*")
    .eq("item_id", itemId)
    .gt("remaining_quantity", 0)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Supabase Error:", error.message);
    return [];
  }

  return (data ?? []) as StockBatch[];
}

export async function checkAvailability(
  itemId: string,
  quantityNeeded: number
): Promise<boolean> {
  const batches = await getAvailableBatches(itemId);

  const totalAvailable = batches.reduce(
    (sum, batch) => sum + Number(batch.remaining_quantity),
    0
  );

  return totalAvailable >= quantityNeeded;
}

export async function drawFromBatches(
  itemId: string,
  quantityNeeded: number
): Promise<BatchDraw[]> {
  const batches = await getAvailableBatches(itemId);

  const totalAvailable = batches.reduce(
    (sum, batch) => sum + Number(batch.remaining_quantity),
    0
  );

  if (totalAvailable < quantityNeeded) {
    throw new Error("الكمية المطلوبة أكبر من المخزون المتاح فعليًا");
  }

  const draws: BatchDraw[] = [];
  let remaining = quantityNeeded;

  for (const batch of batches) {
    if (remaining <= 0) break;

    const batchRemaining = Number(batch.remaining_quantity);
    const drawQty = Math.min(batchRemaining, remaining);

    draws.push({
      batchId: batch.id,
      quantity: drawQty,
      buyPrice: Number(batch.buy_price),
    });

    const { error } = await supabase
      .from("stock_batches")
      .update({ remaining_quantity: batchRemaining - drawQty })
      .eq("id", batch.id);

    if (error) throw error;

    remaining -= drawQty;
  }

  return draws;
}

export async function getCurrentStockAndCost(
  itemId: string
): Promise<{ stock: number; averageCost: number }> {
  const batches = await getAvailableBatches(itemId);

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
