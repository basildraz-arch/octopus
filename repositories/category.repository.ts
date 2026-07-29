import { supabase } from "@/lib/supabase";

export interface Category {
  id: string;
  business_id?: string;

  name: string;
  color?: string;
  icon?: string;

  active: boolean;

  created_at?: string;
}

export async function getCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error(error);
    return [];
  }

  return (data ?? []) as Category[];
}

export async function createCategory(
  category: Omit<Category, "id" | "created_at">
) {
  const { data, error } = await supabase
    .from("categories")
    .insert(category)
    .select()
    .single();

  if (error) throw error;

  return data as Category;
}

export async function deleteCategory(id: string) {
  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", id);

  if (error) throw error;
}