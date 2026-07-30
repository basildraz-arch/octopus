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
