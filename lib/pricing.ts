import type { FeatureKey } from "@/types/business";
import type {
  BillLine,
  ComputedBill,
  FeaturePrice,
  PricingSettings,
} from "@/types/pricing";

// THE BILL TAKES THE SHAPE OF THE SHOP.
//
// docs/OCTOPUS_CORE.md: "Business Type changes the experience only.
// It never limits Products or Services." docs/ARCHITECTURE.md:
// "Every feature is isolated."
//
// Fixed tiers broke both. A tier is a box, and a box decides for the
// shop: a café that wants one thing out of the top tier has to buy
// warehouses and English receipts it will never open, and a kiosk
// that only needs one extra module has to jump a whole step to get
// it. The rest of the system adapts to the business; the price was
// the one place that still made the business adapt to us.
//
// So the price is built the same way the app is: module by module.
// Every feature is isolated, so every feature carries its own price -
// set by what it does and what that is worth in the market. Seats,
// warehouses and branches are counted the same way. Add a module, the
// bill goes up by exactly that module. Nothing else moves.

export function computeBill(
  features: FeatureKey[],
  limits: { staff: number; warehouses: number; branches: number },
  prices: FeaturePrice[],
  settings: PricingSettings,
  labels: Record<string, string>
): ComputedBill {
  const lines: BillLine[] = [];

  lines.push({
    key: "base",
    label: "الأساسي (بيع + أصناف + فئات)",
    amount: Number(settings.base_price),
    kind: "base",
  });

  // Only what the shop actually has switched on, and only the modules
  // that are not part of the core.
  for (const price of [...prices].sort((a, b) => a.sort_order - b.sort_order)) {
    if (price.in_base) continue;

    if (!features.includes(price.feature_key as FeatureKey)) continue;

    const amount = Number(price.monthly_price);

    if (amount <= 0) continue;

    lines.push({
      key: price.feature_key,
      label: labels[price.feature_key] ?? price.feature_key,
      amount,
      kind: "module",
    });
  }

  const seats: [string, string, number, number, number][] = [
    [
      "staff",
      "موظف زيادة",
      limits.staff,
      settings.included_staff,
      Number(settings.extra_staff_price),
    ],
    [
      "warehouses",
      "مخزن زيادة",
      limits.warehouses,
      settings.included_warehouses,
      Number(settings.extra_warehouse_price),
    ],
    [
      "branches",
      "فرع زيادة",
      limits.branches,
      settings.included_branches,
      Number(settings.extra_branch_price),
    ],
  ];

  for (const [key, label, limit, included, unitPrice] of seats) {
    const extra = Math.max(0, limit - included);

    if (extra <= 0 || unitPrice <= 0) continue;

    lines.push({
      key,
      label: `${label} × ${extra}`,
      amount: extra * unitPrice,
      kind: "seat",
      quantity: extra,
      unitPrice,
    });
  }

  const subtotal = lines.reduce((sum, line) => sum + line.amount, 0);

  return { lines, subtotal };
}

// A special deal is one number on one shop, not a fork of the price
// list - so it replaces the computed subtotal rather than editing any
// of the parts that produced it.
export function effectivePrice(
  computedSubtotal: number,
  override: number | null | undefined
): { amount: number; isOverride: boolean } {
  if (override === null || override === undefined) {
    return { amount: computedSubtotal, isOverride: false };
  }

  return { amount: Math.max(0, Number(override)), isOverride: true };
}

export function annualPrice(
  monthly: number,
  discountPercent: number
): number {
  const yearly = monthly * 12;

  return Math.round(yearly * (1 - discountPercent / 100));
}
