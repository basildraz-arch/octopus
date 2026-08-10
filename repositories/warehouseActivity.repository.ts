import { supabase } from "@/lib/supabase";

export type WarehouseValueSummary = {
  warehouse_id: string;
  warehouse_name: string;
  totalValue: number;
};

export async function getWarehouseStockSummary(
  businessId: string
): Promise<WarehouseValueSummary[]> {
  const { data, error } = await supabase
    .from("stock_batches")
    .select("remaining_quantity, buy_price, warehouse_id, warehouses ( name )")
    .eq("business_id", businessId)
    .gt("remaining_quantity", 0);

  if (error) {
    console.error("Supabase Error:", error.message);
    return [];
  }

  const rows = (data ?? []) as unknown as {
    remaining_quantity: number;
    buy_price: number;
    warehouse_id: string;
    warehouses: { name: string } | null;
  }[];

  const totals = new Map<string, WarehouseValueSummary>();

  for (const row of rows) {
    const value = Number(row.remaining_quantity) * Number(row.buy_price);
    const existing = totals.get(row.warehouse_id);

    if (existing) {
      existing.totalValue += value;
    } else {
      totals.set(row.warehouse_id, {
        warehouse_id: row.warehouse_id,
        warehouse_name: row.warehouses?.name ?? "",
        totalValue: value,
      });
    }
  }

  return Array.from(totals.values());
}

export type ActivityEvent = {
  id: string;
  type: "transfer" | "purchase";
  itemName: string;
  itemUnit: string;
  quantity: number;
  createdAt: string;
  createdByName: string;
  fromWarehouseName: string | null;
  toWarehouseName: string;
};

export type ActivityFeedFilters = {
  warehouseId?: string;
  itemId?: string;
  fromDate?: string;
  toDate?: string;
};

type TransferRow = {
  id: string;
  quantity: number;
  created_at: string;
  items: { name: string; unit: string } | null;
  from_warehouse: { id: string; name: string } | null;
  to_warehouse: { id: string; name: string } | null;
  users: { full_name: string } | null;
};

type PurchaseRow = {
  id: string;
  quantity: number;
  created_at: string;
  items: { name: string; unit: string } | null;
  users: { full_name: string } | null;
  stock_batches: {
    warehouse_id: string;
    warehouses: { name: string } | null;
  }[];
};

export async function getActivityFeed(
  businessId: string,
  filters: ActivityFeedFilters = {}
): Promise<ActivityEvent[]> {
  const { warehouseId, itemId, fromDate, toDate } = filters;

  let transfersQuery = supabase
    .from("stock_transfers")
    .select(
      `
      id,
      quantity,
      created_at,
      items ( name, unit ),
      from_warehouse:from_warehouse_id ( id, name ),
      to_warehouse:to_warehouse_id ( id, name ),
      users:created_by ( full_name )
    `
    )
    .eq("business_id", businessId);

  let purchasesQuery = supabase
    .from("purchases")
    .select(
      `
      id,
      quantity,
      created_at,
      items ( name, unit ),
      users:created_by ( full_name ),
      stock_batches ( warehouse_id, warehouses ( name ) )
    `
    )
    .eq("business_id", businessId);

  if (itemId) {
    transfersQuery = transfersQuery.eq("item_id", itemId);
    purchasesQuery = purchasesQuery.eq("item_id", itemId);
  }

  if (fromDate) {
    const start = new Date(`${fromDate}T00:00:00`).toISOString();
    transfersQuery = transfersQuery.gte("created_at", start);
    purchasesQuery = purchasesQuery.gte("created_at", start);
  }

  if (toDate) {
    const end = new Date(`${toDate}T23:59:59.999`).toISOString();
    transfersQuery = transfersQuery.lte("created_at", end);
    purchasesQuery = purchasesQuery.lte("created_at", end);
  }

  const [transfersResult, purchasesResult] = await Promise.all([
    transfersQuery,
    purchasesQuery,
  ]);

  if (transfersResult.error) {
    console.error("Supabase Error:", transfersResult.error.message);
  }

  if (purchasesResult.error) {
    console.error("Supabase Error:", purchasesResult.error.message);
  }

  const transferRows = (transfersResult.data ?? []) as unknown as TransferRow[];
  const purchaseRows = (purchasesResult.data ?? []) as unknown as PurchaseRow[];

  const transferEvents: ActivityEvent[] = transferRows
    .filter(
      (row) =>
        !warehouseId ||
        row.from_warehouse?.id === warehouseId ||
        row.to_warehouse?.id === warehouseId
    )
    .map((row) => ({
      id: `transfer-${row.id}`,
      type: "transfer",
      itemName: row.items?.name ?? "صنف محذوف",
      itemUnit: row.items?.unit ?? "",
      quantity: Number(row.quantity),
      createdAt: row.created_at,
      createdByName: row.users?.full_name ?? "غير معروف",
      fromWarehouseName: row.from_warehouse?.name ?? "؟",
      toWarehouseName: row.to_warehouse?.name ?? "؟",
    }));

  const purchaseEvents: ActivityEvent[] = purchaseRows
    .filter((row) => {
      if (!warehouseId) return true;

      const batch = row.stock_batches?.[0];

      return batch?.warehouse_id === warehouseId;
    })
    .map((row) => {
      const batch = row.stock_batches?.[0];

      return {
        id: `purchase-${row.id}`,
        type: "purchase",
        itemName: row.items?.name ?? "صنف محذوف",
        itemUnit: row.items?.unit ?? "",
        quantity: Number(row.quantity),
        createdAt: row.created_at,
        createdByName: row.users?.full_name ?? "غير معروف",
        fromWarehouseName: null,
        toWarehouseName: batch?.warehouses?.name ?? "؟",
      };
    });

  return [...transferEvents, ...purchaseEvents].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}
