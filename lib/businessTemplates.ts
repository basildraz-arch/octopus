import type { FeatureKey } from "@/types/business";

export type BusinessTemplateKey = "retail" | "warehouse" | "services";

export interface BusinessTemplate {
  key: BusinessTemplateKey;
  title: string;
  description: string;
  features: FeatureKey[];
}

export const BUSINESS_TEMPLATES: BusinessTemplate[] = [
  {
    key: "retail",
    title: "🛍️ بيع بالتجزئة",
    description: "لمحلات البيع للمستهلك النهائي — زي البقالة والمحلات العادية",
    features: [
      "pos_sales",
      "inventory",
      "categories",
      "shifts",
      "sales_reports",
      "discounts",
    ],
  },
  {
    key: "warehouse",
    title: "🏭 إدارة مخازن",
    description: "لإدارة مخزون ومخازن متعددة بدون نقطة بيع مباشرة للمستهلك",
    features: ["inventory", "multi_warehouse", "warehouse_reports"],
  },
  {
    key: "services",
    title: "✂️ خدمات بدون مخزون",
    description: "لأعمال بتبيع وقت أو خدمة مش بضاعة — زي صالون أو استشارات",
    features: ["pos_sales", "shifts", "sales_reports", "discounts"],
  },
];
