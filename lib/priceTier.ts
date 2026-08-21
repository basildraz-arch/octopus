import type { Item } from "@/types/item";

export type PriceTier = 1 | 2 | 3;

// One place decides what an item costs at a given tier, so the till,
// the popup, the cart total and the saved sale can never disagree.
//
// Falls back to tier 1 whenever a tier price is missing: an item the
// owner never gave a second price to is simply sold at its normal
// price, rather than at zero.
export function priceForTier(
  item: Pick<Item, "sell_price" | "sell_price_2" | "sell_price_3">,
  tier: PriceTier
): number {
  if (tier === 2) return item.sell_price_2 ?? item.sell_price;
  if (tier === 3) return item.sell_price_3 ?? item.sell_price;

  return item.sell_price;
}

export function tierLabel(
  labels: readonly string[] | undefined,
  tier: PriceTier
): string {
  return labels?.[tier - 1] ?? `تسعيرة ${tier}`;
}
