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

// Set once, then frozen by the protect_employee_email_code trigger
// (migration 034). Returns the row so the caller can confirm which
// code actually stuck.
export async function setEmployeeEmailCode(
  businessId: string,
  code: string
): Promise<string> {
  const { data, error } = await supabase
    .from("businesses")
    .update({ employee_email_code: code })
    .eq("id", businessId)
    .select("employee_email_code")
    .single();

  if (error) throw error;

  return data.employee_email_code as string;
}
