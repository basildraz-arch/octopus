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
  "price_tiers",
  "english_receipt",
  "credit_customers",
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
  price_tiers: "3 تسعيرات لكل صنف",
  english_receipt: "فاتورة إنجليزي للتسعيرة الأعلى",
  credit_customers: "حساب مؤجل للعملاء (يأخد ويحاسب بعدين)",
};

export const FEATURE_ICONS: Record<FeatureKey, string> = {
  pos_sales: "🧾",
  inventory: "📦",
  categories: "🗂️",
  shifts: "⏰",
  sales_reports: "📊",
  multi_warehouse: "🚚",
  warehouse_reports: "🛰️",
  discounts: "💰",
  price_tiers: "🏷️",
  english_receipt: "🌍",
  credit_customers: "🧾",
};

export const FEATURE_DESCRIPTIONS: Record<FeatureKey, string> = {
  pos_sales: "تسجّل كل عملية بيع بضغطة، وتقدر تسجّل مصروفات اليوم كمان",
  inventory: "تعرف عندك كام قطعة من كل صنف أول بأول",
  categories: "ترتب الأصناف في مجموعات (أكل، إكسسوارات...) عشان تلاقيها بسرعة",
  shifts: "تقفل يومك في آخر الشيفت وتشوف حساب الكاش والمبيعات بالظبط",
  sales_reports: "تشوف بعت بكام وكسبت كام في أي فترة تختارها",
  multi_warehouse: "تنقل بضاعة بين أكتر من مخزن بسهولة",
  warehouse_reports: "متابعة سريعة لحالة كل مخازنك في لحظة واحدة",
  discounts: "تقدر تدي خصم على الفاتورة وقت البيع",
  price_tiers:
    "سعر مختلف لكل نوع زبون - إنت اللي بتسمّي التسعيرات، والكاشير يختار وقت البيع",
  english_receipt:
    "لما البيع يبقى بالتسعيرة الأعلى، الفاتورة تتطبع بالإنجليزي للسايح",
  credit_customers:
    "العميل ياخد على مدار اليوم ويحاسب في الآخر - والمبلغ ما بيتحسبش كاش لحد ما يدفع",
};
