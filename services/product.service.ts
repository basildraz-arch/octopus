import { supabase } from "@/lib/supabase";

export type Product = {
  id: string;
  name: string;
  barcode: string;
  buy_price: number;
  sell_price: number;
  stock: number;
  minimum_stock: number;
  unit: string;
  sell_by_money: boolean;
  sell_by_weight: boolean;
  keywords: string;
};

export async function getProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("name");

  if (error) {
    console.error(error);
    return [];
  }

  return data as Product[];
}