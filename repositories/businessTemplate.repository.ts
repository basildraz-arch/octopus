import { supabase } from "@/lib/supabase";
import type { BusinessTemplate } from "@/types/businessTemplate";

export async function getBusinessTemplates(): Promise<BusinessTemplate[]> {
  const { data, error } = await supabase
    .from("business_templates")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Supabase Error:", error.message);
    return [];
  }

  return (data ?? []) as BusinessTemplate[];
}

export async function getAllBusinessTemplates(): Promise<BusinessTemplate[]> {
  const { data, error } = await supabase
    .from("business_templates")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Supabase Error:", error.message);
    return [];
  }

  return (data ?? []) as BusinessTemplate[];
}

// No admin check here on purpose. The write is refused by the
// business_templates_admin_update policy unless is_platform_admin()
// says yes - a check in this file would only be decoration.
export async function updateBusinessTemplate(
  businessType: string,
  patch: Partial<BusinessTemplate>
): Promise<void> {
  const { error } = await supabase
    .from("business_templates")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("business_type", businessType);

  if (error) throw error;
}
