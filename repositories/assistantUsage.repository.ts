import type { SupabaseClient } from "@supabase/supabase-js";

export async function incrementAndCheckGeminiUsage(
  supabase: SupabaseClient,
  businessId: string,
  dailyLimit: number
): Promise<{ allowed: boolean; count: number }> {
  const { data, error } = await supabase.rpc("increment_assistant_usage", {
    p_business_id: businessId,
  });

  if (error) throw error;

  const count = data as number;

  return { allowed: count <= dailyLimit, count };
}
