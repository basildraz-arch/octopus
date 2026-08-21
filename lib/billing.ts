export type MonthlyBill = {
  planPrice: number;
  discount: number;
  due: number;
};

// One place where a month's bill is worked out, used by the owner's
// screen and by Master, so the two can never quote different numbers
// at the same shop.
//
// The cap is the whole point: a referral discount can take a bill to
// zero and no further. A shop that brings in ten others gets its
// software free - it does not start being owed cash by a discount
// scheme that was never a cash scheme. Anyone who should be paid in
// cash is a marketer, and marketers are on the other programme.
export function monthlyBill(
  planPrice: number,
  referralDiscount: number
): MonthlyBill {
  const price = Math.max(0, Number(planPrice) || 0);
  const earned = Math.max(0, Number(referralDiscount) || 0);

  const discount = Math.min(earned, price);

  return {
    planPrice: price,
    discount,
    due: price - discount,
  };
}

export function formatMoney(value: number): string {
  return `${Math.round(value).toLocaleString("en-US")} ج`;
}
