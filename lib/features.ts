import type { Business, FeatureKey } from "@/types/business";

export function hasFeature(
  business: Business | null | undefined,
  feature: FeatureKey
): boolean {
  return business?.enabled_features?.includes(feature) ?? false;
}

export const ALL_FEATURES: FeatureKey[] = [
  "pos_sales",
  "inventory",
  "categories",
  "shifts",
  "sales_reports",
  "multi_warehouse",
  "warehouse_reports",
  "discounts",
];

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  pos_sales: "نقطة البيع (بيع، مصروفات، سجل مبيعات)",
  inventory: "المخزون الأساسي والأصناف",
  categories: "الفئات وتصنيف الأصناف",
  shifts: "الشيفتات وإنهاء اليوم",
  sales_reports: "تقارير المبيعات والأرباح",
  multi_warehouse: "المخازن المتعددة والنقل بينها",
  warehouse_reports: "لوحة نبض المخازن",
  discounts: "الخصم على الفاتورة",
};
