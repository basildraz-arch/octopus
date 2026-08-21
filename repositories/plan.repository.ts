import { supabase } from "@/lib/supabase";
import type { Plan, PlanUsage } from "@/types/plan";

export async function getPlans(): Promise<Plan[]> {
  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Supabase Error:", error.message);
    return [];
  }

  return (data ?? []) as Plan[];
}

// Counted the same way the database counts when it decides whether to
// refuse (migration 061): active rows only, and the owner is never
// one of the staff seats.
export async function getPlanUsage(businessId: string): Promise<PlanUsage> {
  const [staff, warehouses, branches] = await Promise.all([
    supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("active", true)
      .neq("role", "owner"),
    supabase
      .from("warehouses")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("active", true),
    supabase
      .from("branches")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("active", true),
  ]);

  return {
    staff: staff.count ?? 0,
    warehouses: warehouses.count ?? 0,
    branches: branches.count ?? 0,
  };
}

// No admin check here: the plans_admin_write policy refuses the write
// unless is_platform_admin() says yes, so a check in this file would
// only be decoration.
export async function updatePlan(
  code: string,
  patch: Partial<Plan>
): Promise<void> {
  const { error } = await supabase
    .from("plans")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("code", code);

  if (error) throw error;
}
