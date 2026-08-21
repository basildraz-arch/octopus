import type { SupabaseClient } from "@supabase/supabase-js";

export type SpendResult =
  | { allowed: true; remaining: number }
  | { allowed: false; message: string };

// Spends one of this person's daily messages.
//
// Per person now, not per shop: the counter used to be keyed on
// business_id, so an owner and two cashiers shared one allowance and
// whoever asked first spent everybody's.
//
// The limit itself lives in the assistant_limits table and is read
// inside the function on every call, so raising it in Master takes
// effect on the next message rather than the next deploy. The function
// raises when the allowance is gone, which is why the error path here
// is a normal outcome and not a bug.
export async function spendAssistantMessage(
  supabase: SupabaseClient
): Promise<SpendResult> {
  const { data, error } = await supabase.rpc("spend_assistant_message");

  if (error) {
    return {
      allowed: false,
      message: error.message || "خلصت رسايلك النهاردة",
    };
  }

  return { allowed: true, remaining: Number(data) };
}
