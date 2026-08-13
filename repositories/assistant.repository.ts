import type { SupabaseClient } from "@supabase/supabase-js";

type SaleWithLines = {
  total: number;
  sale_items: {
    quantity: number;
    items: { name: string } | null;
  }[];
};

export async function getItemCount(
  supabase: SupabaseClient,
  businessId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("items")
    .select("*", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("active", true);

  if (error) throw error;

  return count ?? 0;
}

export async function getLowStockItems(
  supabase: SupabaseClient,
  businessId: string
): Promise<{ name: string; stock: number; minimum_stock: number }[]> {
  const { data, error } = await supabase
    .from("items")
    .select("name, stock, minimum_stock")
    .eq("business_id", businessId)
    .eq("active", true)
    .eq("has_stock", true);

  if (error) throw error;

  return (data ?? []).filter((item) => item.stock <= item.minimum_stock);
}

export async function getInventoryValue(
  supabase: SupabaseClient,
  businessId: string
): Promise<number> {
  const { data, error } = await supabase
    .from("items")
    .select("stock, buy_price")
    .eq("business_id", businessId)
    .eq("active", true)
    .eq("has_stock", true);

  if (error) throw error;

  return (data ?? []).reduce(
    (sum, item) => sum + Number(item.stock) * Number(item.buy_price),
    0
  );
}

export async function getSalesTotal(
  supabase: SupabaseClient,
  businessId: string,
  startISO: string,
  endISO: string
): Promise<{ total: number; count: number }> {
  const { data, error } = await supabase
    .from("sales")
    .select("total")
    .eq("business_id", businessId)
    .gte("created_at", startISO)
    .lte("created_at", endISO);

  if (error) throw error;

  const rows = data ?? [];

  return {
    total: rows.reduce((sum, sale) => sum + Number(sale.total), 0),
    count: rows.length,
  };
}

export async function getExpensesTotal(
  supabase: SupabaseClient,
  businessId: string,
  startISO: string,
  endISO: string
): Promise<{ total: number; count: number }> {
  const { data, error } = await supabase
    .from("expenses")
    .select("amount")
    .eq("business_id", businessId)
    .gte("created_at", startISO)
    .lte("created_at", endISO);

  if (error) throw error;

  const rows = data ?? [];

  return {
    total: rows.reduce((sum, expense) => sum + Number(expense.amount), 0),
    count: rows.length,
  };
}

export async function getTopSellingItem(
  supabase: SupabaseClient,
  businessId: string,
  startISO: string,
  endISO: string
): Promise<{ name: string; quantity: number } | null> {
  const { data, error } = await supabase
    .from("sales")
    .select(
      `
      sale_items (
        quantity,
        items ( name )
      )
    `
    )
    .eq("business_id", businessId)
    .gte("created_at", startISO)
    .lte("created_at", endISO);

  if (error) throw error;

  const sales = (data ?? []) as unknown as SaleWithLines[];
  const quantityByName: Record<string, number> = {};

  for (const sale of sales) {
    for (const line of sale.sale_items ?? []) {
      const name = line.items?.name;
      if (!name) continue;

      quantityByName[name] = (quantityByName[name] ?? 0) + Number(line.quantity);
    }
  }

  const sorted = Object.entries(quantityByName).sort((a, b) => b[1] - a[1]);

  if (sorted.length === 0) return null;

  return { name: sorted[0][0], quantity: sorted[0][1] };
}
