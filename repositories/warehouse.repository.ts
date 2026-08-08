import { supabase } from "@/lib/supabase";
import type { Warehouse } from "@/types/warehouse";

export async function getWarehouses(
  businessId: string
): Promise<Warehouse[]> {
  const { data, error } = await supabase
    .from("warehouses")
    .select("*")
    .eq("business_id", businessId)
    .order("name", { ascending: true });

  if (error) {
    console.error("Supabase Error:", error.message);
    return [];
  }

  return (data ?? []) as Warehouse[];
}

export async function createWarehouse(
  warehouse: Omit<Warehouse, "id" | "created_at">
): Promise<Warehouse> {
  const { data, error } = await supabase
    .from("warehouses")
    .insert(warehouse)
    .select()
    .single();

  if (error) throw error;

  return data as Warehouse;
}

export async function updateWarehouse(
  id: string,
  warehouse: Partial<Omit<Warehouse, "id" | "created_at">>
) {
  const { error } = await supabase
    .from("warehouses")
    .update(warehouse)
    .eq("id", id);

  if (error) throw error;
}

export async function getDefaultWarehouse(
  businessId: string
): Promise<Warehouse> {
  const { data, error } = await supabase
    .from("warehouses")
    .select("*")
    .eq("business_id", businessId)
    .eq("is_default", true)
    .single();

  if (error) throw error;

  return data as Warehouse;
}
