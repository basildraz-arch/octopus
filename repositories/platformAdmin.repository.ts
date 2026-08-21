import { supabase } from "@/lib/supabase";

// Asks the database whether the currently signed-in user is a
// platform admin (Master). Always ask the database, never infer
// this from a client-held role field — RLS + is_platform_admin()
// in migration 031 are the actual source of truth; this call is
// only useful for the UI to decide what to render, and every
// sensitive action must re-check server-side regardless of what
// this returns.
export async function isCurrentUserPlatformAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_platform_admin");

  if (error) {
    console.error("Supabase Error:", error.message);
    return false;
  }

  return Boolean(data);
}
