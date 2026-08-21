import { supabase } from "@/lib/supabase";
import type { User } from "@/types/user";

export async function getUserByAuthId(
  authUserId: string
): Promise<User | null> {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("auth_user_id", authUserId)
    .single();

  if (error) {
    console.error("Supabase Error:", error.message);
    return null;
  }

  return data as User;
}

export async function getEmployees(businessId: string): Promise<User[]> {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("business_id", businessId)
    .eq("role", "employee")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Supabase Error:", error.message);
    return [];
  }

  return data as User[];
}

// Owner-only in practice: the users_owner_update policy (migration
// 034) rejects this for anyone else, and the
// protect_user_identity_columns trigger rejects any attempt to touch
// role/email/business_id/auth_user_id through this same path.
export async function setUserActive(
  userId: string,
  active: boolean
): Promise<void> {
  const { error } = await supabase
    .from("users")
    .update({ active })
    .eq("id", userId);

  if (error) throw error;
}

// staff_role and extra_permissions are privilege columns, so they get
// the same treatment as role/email: the RLS policy limits the write
// to an owner in the same business, and the
// protect_user_identity_columns trigger (migration 047) raises for
// anyone else who reaches this path with a crafted request.
export async function setUserRole(
  userId: string,
  staffRole: string,
  extraPermissions: string[]
): Promise<void> {
  const { error } = await supabase
    .from("users")
    .update({ staff_role: staffRole, extra_permissions: extraPermissions })
    .eq("id", userId);

  if (error) throw error;
}
