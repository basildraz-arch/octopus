import type { FeatureKey } from "@/types/business";

export type BusinessTemplateKey = "retail" | "warehouse" | "services";

export interface BusinessTemplate {
  key: BusinessTemplateKey;
  icon: string;
  title: string;
  description: string;
  features: FeatureKey[];
}

export const BUSINESS_TEMPLATES: BusinessTemplate[] = [
  {
    key: "retail",
    icon: "🐾",
    title: "محل بيع (زي محل حيوانات أو سوبر ماركت)",
    description: "بتبيع منتجات وبضاعة للعملاء يوميًا",
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
    key: "services",
    icon: "✂️",
    title: "صالون أو خدمات",
    description: "بتقدّم خدمة مش بضاعة — زي حلاقة أو استشارة",
    features: ["pos_sales", "shifts", "sales_reports", "discounts"],
  },
  {
    key: "warehouse",
    icon: "🚚",
    title: "مخازن",
    description: "تخزين ونقل بضاعة بين أكتر من مكان",
    features: ["inventory", "multi_warehouse", "warehouse_reports"],
  },
];
