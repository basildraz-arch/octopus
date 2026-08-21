import { supabase } from "@/lib/supabase";
import {
  checkAvailability,
  drawFromBatches,
  createBatch,
  getCurrentStockAndCost,
} from "@/repositories/stockBatch.repository";
import { updateItem } from "@/repositories/item.repository";

export type StockTransfer = {
  id: string;
  business_id: string;
  item_id: string;
  from_warehouse_id: string;
  to_warehouse_id: string;
  quantity: number;
  created_by: string | null;
  created_at: string;
};

export async function createTransfer(
  businessId: string,
  createdBy: string,
  itemId: string,
  fromWarehouseId: string,
  toWarehouseId: string,
  quantity: number
): Promise<StockTransfer> {
  if (fromWarehouseId === toWarehouseId) {
    throw new Error("لا يمكن النقل من نفس المخزن إلى نفسه");
  }

  if (quantity <= 0) {
    throw new Error("الكمية يجب أن تكون أكبر من صفر");
  }

  const available = await checkAvailability(itemId, quantity, fromWarehouseId);

  if (!available) {
    throw new Error("الكمية المطلوبة أكبر من المخزون المتاح في المخزن المصدر");
  }

  const draws = await drawFromBatches(itemId, quantity, fromWarehouseId);

  const totalCost = draws.reduce(
    (sum, draw) => sum + draw.quantity * draw.buyPrice,
    0
  );

  const averageBuyPrice = totalCost / quantity;

  await createBatch(
    businessId,
    itemId,
    toWarehouseId,
    null,
    quantity,
    averageBuyPrice
  );

  // draw_stock_fifo recalculated the item's total the moment the
  // goods left the source warehouse - before they existed in the
  // destination one. Recalculate now that both halves are recorded,
  // otherwise a transfer reads as stock that vanished.
  const { stock, averageCost } = await getCurrentStockAndCost(itemId);

  await updateItem(itemId, { stock, buy_price: averageCost });

  const { data, error } = await supabase
    .from("stock_transfers")
    .insert({
      business_id: businessId,
      item_id: itemId,
      from_warehouse_id: fromWarehouseId,
      to_warehouse_id: toWarehouseId,
      quantity,
      created_by: createdBy,
    })
    .select()
    .single();

  if (error) throw error;

  return data as StockTransfer;
}

export type StockTransferWithDetails = {
  id: string;
  quantity: number;
  created_at: string;
  items: { name: string; unit: string } | null;
  from_warehouse: { name: string } | null;
  to_warehouse: { name: string } | null;
};

export async function getRecentTransfers(
  businessId: string,
  limit: number = 5
): Promise<StockTransferWithDetails[]> {
  const { data, error } = await supabase
    .from("stock_transfers")
    .select(
      `
      id,
      quantity,
      created_at,
      items ( name, unit ),
      from_warehouse:from_warehouse_id ( name ),
      to_warehouse:to_warehouse_id ( name )
    `
    )
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Supabase Error:", error.message);
    return [];
  }

  return (data ?? []) as unknown as StockTransferWithDetails[];
}
