import { supabase } from "@/lib/supabase";
import type { Business } from "@/types/business";

export async function getBusiness(
  businessId: string
): Promise<Business | null> {
  const { data, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", businessId)
    .single();

  if (error) {
    console.error("Supabase Error:", error.message);
    return null;
  }

  return data as Business;
}

export async function updateBusiness(
  businessId: string,
  business: Partial<Business>
): Promise<void> {
  const { error } = await supabase
    .from("businesses")
    .update(business)
    .eq("id", businessId);

  if (error) throw error;
}
