import { supabase } from "@/lib/supabase";
import type { CartItem } from "@/components/Cart";

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
