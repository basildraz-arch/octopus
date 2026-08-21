import { supabase } from "@/lib/supabase";
import { isEarningReferral } from "@/lib/referralRules";
import type {
  ReferralCode,
  ReferralSummary,
  ReferredShop,
} from "@/types/referral";

type ReferralRow = {
  id: string;
  referral_code_id: string;
  referred_business_id: string;
  qualified_at: string | null;
  reward_ends_at: string | null;
  created_at: string;
  businesses: {
    name: string;
    active: boolean;
    subscription_expires_at: string | null;
  } | null;
};

// The rule itself lives in lib/referralRules.ts so the server-side
// billing code applies exactly the same test when it decides what to
// charge.
function isEarning(row: ReferralRow, now: number): boolean {
  return isEarningReferral(
    {
      qualifiedAt: row.qualified_at,
      rewardEndsAt: row.reward_ends_at,
      businessActive: row.businesses?.active ?? false,
      subscriptionExpiresAt: row.businesses?.subscription_expires_at ?? null,
    },
    now
  );
}

function toShop(row: ReferralRow, now: number): ReferredShop {
  return {
    id: row.id,
    referral_code_id: row.referral_code_id,
    referred_business_id: row.referred_business_id,
    qualified_at: row.qualified_at,
    reward_ends_at: row.reward_ends_at,
    created_at: row.created_at,
    businessName: row.businesses?.name ?? "بيزنس محذوف",
    businessActive: row.businesses?.active ?? false,
    subscriptionExpiresAt: row.businesses?.subscription_expires_at ?? null,
    earning: isEarning(row, now),
  };
}

// RLS decides the audience: the platform admin gets every code, a
// shop owner gets only their own, and everybody else gets nothing
// (migration 058). One function serves both screens because the
// database is what narrows the rows, not a parameter.
export async function getReferralSummaries(): Promise<ReferralSummary[]> {
  const [codesResult, referralsResult, payoutsResult] = await Promise.all([
    supabase
      .from("referral_codes")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("referrals")
      .select(
        "id, referral_code_id, referred_business_id, qualified_at, reward_ends_at, created_at, businesses ( name, active, subscription_expires_at )"
      ),
    supabase.from("referral_payouts").select("referral_code_id, amount"),
  ]);

  if (codesResult.error) {
    console.error("Supabase Error:", codesResult.error.message);
    return [];
  }

  const codes = (codesResult.data ?? []) as ReferralCode[];
  const rows = (referralsResult.data ?? []) as unknown as ReferralRow[];
  const payouts = (payoutsResult.data ?? []) as {
    referral_code_id: string;
    amount: number;
  }[];

  const now = Date.now();

  return codes.map((code) => {
    const shops = rows
      .filter((row) => row.referral_code_id === code.id)
      .map((row) => toShop(row, now))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));

    const earningCount = shops.filter((shop) => shop.earning).length;

    const totalPaid = payouts
      .filter((payout) => payout.referral_code_id === code.id)
      .reduce((sum, payout) => sum + Number(payout.amount), 0);

    return {
      code,
      shops,
      signedUpCount: shops.length,
      earningCount,
      monthlyAmount: earningCount * Number(code.monthly_reward),
      totalPaid,
    };
  });
}

// Filtered by business rather than by "the first row RLS returned":
// the platform admin also owns a shop, and would otherwise be shown
// somebody else's code on their own settings page.
export async function getMyReferralSummary(
  businessId: string
): Promise<ReferralSummary | null> {
  const summaries = await getReferralSummaries();

  return (
    summaries.find((summary) => summary.code.business_id === businessId) ?? null
  );
}
