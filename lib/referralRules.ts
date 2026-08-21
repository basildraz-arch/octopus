// The rule for whether a referral is earning its referrer money right
// now. Pure, so the browser repository and the server-side billing
// code can share it instead of keeping two copies that drift - the
// same split as lib/pinRules.ts against lib/pin.ts.
//
// Three live facts, all of which must hold. Deliberately computed at
// read time rather than stored as a status: a shop that stops paying
// stops earning without anything having to run on a schedule to
// notice.
export type EarningInput = {
  qualifiedAt: string | null;
  rewardEndsAt: string | null;
  businessActive: boolean;
  subscriptionExpiresAt: string | null;
};

export function isEarningReferral(input: EarningInput, now: number): boolean {
  // Never paid: the twelve months have not started.
  if (!input.qualifiedAt || !input.rewardEndsAt) return false;

  // The window closed.
  if (new Date(input.rewardEndsAt).getTime() <= now) return false;

  // Suspended shop.
  if (!input.businessActive) return false;

  // Lapsed subscription.
  if (!input.subscriptionExpiresAt) return false;

  return new Date(input.subscriptionExpiresAt).getTime() > now;
}
