export type PaymentMethod =
  | "cash"
  | "vodafone_cash"
  | "instapay"
  // Taken now, settled later. Deliberately excluded from expected
  // cash at day-close - the money is not in the drawer yet.
  | "credit";

// The three that actually put money in the drawer, so a settlement
// can say how it arrived.
export type SettlementMethod = Exclude<PaymentMethod, "credit">;
