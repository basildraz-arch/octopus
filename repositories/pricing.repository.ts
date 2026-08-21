import { supabase } from "@/lib/supabase";
import type { FeaturePrice, PricingSettings } from "@/types/pricing";

export async function getFeaturePrices(): Promise<FeaturePrice[]> {
  const { data, error } = await supabase
    .from("feature_prices")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Supabase Error:", error.message);
    return [];
  }

  return (data ?? []) as FeaturePrice[];
}

export async function getPricingSettings(): Promise<PricingSettings | null> {
  const { data, error } = await supabase
    .from("pricing_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    console.error("Supabase Error:", error.message);
    return null;
  }

  return (data ?? null) as PricingSettings | null;
}

// No admin check here: feature_prices_admin_write and
// pricing_settings_admin_write refuse the write unless
// is_platform_admin() says yes, so a check in this file would only be
// decoration.
export async function updateFeaturePrice(
  featureKey: string,
  monthlyPrice: number
): Promise<void> {
  const { error } = await supabase
    .from("feature_prices")
    .update({ monthly_price: monthlyPrice, updated_at: new Date().toISOString() })
    .eq("feature_key", featureKey);

  if (error) throw error;
}

export async function updatePricingSettings(
  patch: Partial<PricingSettings>
): Promise<void> {
  const { error } = await supabase
    .from("pricing_settings")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", 1);

  if (error) throw error;
}
