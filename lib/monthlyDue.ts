import type { SupabaseClient } from "@supabase/supabase-js";

import { computeBill, effectivePrice } from "@/lib/pricing";
import { monthlyBill } from "@/lib/billing";
import { isEarningReferral } from "@/lib/referralRules";
import { FEATURE_LABELS } from "@/lib/features";
import type { FeatureKey } from "@/types/business";
import type { FeaturePrice, PricingSettings } from "@/types/pricing";
import type { MonthlyBill } from "@/lib/billing";

// WHAT THIS SHOP OWES THIS MONTH, decided on the server.
//
// The owner's settings screen works this out in the browser to show
// them a bill. Until this existed, the payment route charged a single
// flat number from an environment variable instead - so a shop could
// be shown "المستحق 300 ج" and then be asked for something else
// entirely. Once the price stopped being one number for everybody
// (migration 062), that gap became a real billing bug.
//
// Everything here is read from the database with the caller's own
// client and computed with the same pure functions the screen uses.
// No amount is ever accepted from the request body: a price the
// client can name is a price the client can choose.
export type DueResult = MonthlyBill & {
  /** The shop's price before the referral discount. */
  subtotal: number;

  /** True when a special deal replaced the computed price. */
  isOverride: boolean;
};

type BusinessRow = {
  enabled_features: string[] | null;
  monthly_price: number | null;
  staff_limit: number | null;
  warehouse_limit: number | null;
  branch_limit: number | null;
};

export async function monthlyDueFor(
  supabase: SupabaseClient,
  businessId: string
): Promise<DueResult> {
  const [businessResult, pricesResult, settingsResult] = await Promise.all([
    supabase
      .from("businesses")
      .select(
        "enabled_features, monthly_price, staff_limit, warehouse_limit, branch_limit"
      )
      .eq("id", businessId)
      .single(),
    supabase.from("feature_prices").select("*"),
    supabase.from("pricing_settings").select("*").eq("id", 1).single(),
  ]);

  if (businessResult.error || !businessResult.data) {
    throw new Error("تعذر قراءة بيانات الاشتراك");
  }

  if (settingsResult.error || !settingsResult.data) {
    throw new Error("تعذر قراءة إعدادات التسعير");
  }

  const business = businessResult.data as BusinessRow;
  const prices = (pricesResult.data ?? []) as FeaturePrice[];
  const settings = settingsResult.data as PricingSettings;

  const computed = computeBill(
    (business.enabled_features ?? []) as FeatureKey[],
    {
      staff: business.staff_limit ?? settings.included_staff,
      warehouses: business.warehouse_limit ?? settings.included_warehouses,
      branches: business.branch_limit ?? settings.included_branches,
    },
    prices,
    settings,
    FEATURE_LABELS
  );

  const price = effectivePrice(computed.subtotal, business.monthly_price);

  const discount = await referralDiscountFor(supabase, businessId);

  return {
    ...monthlyBill(price.amount, discount),
    subtotal: price.amount,
    isOverride: price.isOverride,
  };
}

// What this shop has earned off its own bill by bringing others in.
// Only codes the shop itself holds count - a marketer's code pays
// cash and has no bill to reduce.
async function referralDiscountFor(
  supabase: SupabaseClient,
  businessId: string
): Promise<number> {
  const { data: codes } = await supabase
    .from("referral_codes")
    .select("id, monthly_reward")
    .eq("business_id", businessId)
    .eq("kind", "customer")
    .eq("active", true);

  if (!codes || codes.length === 0) return 0;

  const { data: referrals } = await supabase
    .from("referrals")
    .select(
      "referral_code_id, qualified_at, reward_ends_at, businesses ( active, subscription_expires_at )"
    )
    .in(
      "referral_code_id",
      codes.map((code) => code.id)
    );

  if (!referrals || referrals.length === 0) return 0;

  const now = Date.now();

  let total = 0;

  for (const referral of referrals as unknown as {
    referral_code_id: string;
    qualified_at: string | null;
    reward_ends_at: string | null;
    businesses: { active: boolean; subscription_expires_at: string | null } | null;
  }[]) {
    const earning = isEarningReferral(
      {
        qualifiedAt: referral.qualified_at,
        rewardEndsAt: referral.reward_ends_at,
        businessActive: referral.businesses?.active ?? false,
        subscriptionExpiresAt:
          referral.businesses?.subscription_expires_at ?? null,
      },
      now
    );

    if (!earning) continue;

    const code = codes.find((c) => c.id === referral.referral_code_id);

    total += Number(code?.monthly_reward ?? 0);
  }

  return total;
}
