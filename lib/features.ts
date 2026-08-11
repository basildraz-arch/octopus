import type { Business, FeatureKey } from "@/types/business";

export function hasFeature(
  business: Business | null | undefined,
  feature: FeatureKey
): boolean {
  return business?.enabled_features?.includes(feature) ?? false;
}
