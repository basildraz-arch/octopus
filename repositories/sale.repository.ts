import { supabase } from "@/lib/supabase";
import type { CartItem } from "@/components/Cart";

export type SaleWithItems = {
  id: string;
  total: number;
  created_at: string;
  sale_items: {
    id: string;
    quantity: number;
    unit_price: number;
    total: number;
    items: { name: string; unit: string } | null;
  }[];
};

export async function getSalesByDate(
  businessId: string,
  date: string
): Promise<SaleWithItems[]> {
  const start = new Date(`${date}T00:00:00`).toISOString();
  const end = new Date(`${date}T23:59:59.999`).toISOString();

  const { data, error } = await supabase
    .from("sales")
    .select(
      `
      id,
      total,
      created_at,
      sale_items (
        id,
        quantity,
        unit_price,
        total,
        items ( name, unit )
      )
    `
    )
    .eq("business_id", businessId)
    .gte("created_at", start)
    .lte("created_at", end)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Supabase Error:", error.message);
    return [];
  }

  return (data ?? []) as unknown as SaleWithItems[];
}

export async function createSale(
  businessId: string,
  createdBy: string,
  cart: CartItem[]
) {
  const total = cart.reduce(
    (sum, line) => sum + line.total,
    0
  );

  const { data: sale, error: saleError } = await supabase
    .from("sales")
    .insert({
      business_id: businessId,
      created_by: createdBy,
      total,
    })
    .select()
    .single();

  if (saleError) throw saleError;

  const saleItems = cart.map((line) => ({
    sale_id: sale.id,
    item_id: line.item.id,
    quantity: line.quantity,
    unit_price: line.item.sell_price,
    total: line.total,
  }));

  const { error: itemsError } = await supabase
    .from("sale_items")
    .insert(saleItems);

  if (itemsError) throw itemsError;

  for (const line of cart) {
    if (line.item.has_stock) {
      await supabase
        .from("items")
        .update({ stock: line.item.stock - line.quantity })
        .eq("id", line.item.id);
    }
  }

  return sale;
}
