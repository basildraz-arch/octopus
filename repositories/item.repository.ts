import { supabase } from "@/lib/supabase";

import type {
  Item,
  ItemFormData,
} from "@/types/item";

export async function getItems(): Promise<Item[]> {
  const { data, error } = await supabase
    .from("items")
    .select("*")
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
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Supabase Error:", error.message);
    return null;
  }

  return data as Item;
}

export async function createItem(
  item: ItemFormData
) {
  const { data, error } = await supabase
    .from("items")
    .insert(item)
    .select();

  if (error) throw error;

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

export async function deleteItem(id: string) {
  const { error } = await supabase
    .from("items")
    .delete()
    .eq("id", id);

  if (error) throw error;
}