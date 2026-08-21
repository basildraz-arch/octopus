export type ReferralKind = "customer" | "marketer";

export interface ReferralCode {
  id: string;

  // Typed by a human at signup, so it is stored and compared in
  // upper case and kept short.
  code: string;

  kind: ReferralKind;

  // Set for a shop that refers other shops; null for a marketer who
  // has no shop of their own.
  business_id: string | null;

  holder_name: string;
  holder_phone: string | null;

  monthly_reward: number;
  reward_months: number;

  active: boolean;
  notes: string | null;

  created_at: string;
}

export interface Referral {
  id: string;
  referral_code_id: string;
  referred_business_id: string;

  // Null until the referred shop pays for the first time. The reward
  // window starts here, never at signup - see migration 058.
  qualified_at: string | null;
  reward_ends_at: string | null;

  created_at: string;
}

export type ReferredShop = Referral & {
  businessName: string;
  businessActive: boolean;
  subscriptionExpiresAt: string | null;

  // Paying now, inside the reward window: this is a shop that is
  // earning its referrer money this month.
  earning: boolean;
};

export type ReferralSummary = {
  code: ReferralCode;
  shops: ReferredShop[];

  signedUpCount: number;
  earningCount: number;

  // What this referrer is owed for the current month.
  monthlyAmount: number;

  totalPaid: number;
};

export const REFERRAL_KIND_LABELS: Record<ReferralKind, string> = {
  customer: "صاحب محل",
  marketer: "مسوّق",
};
