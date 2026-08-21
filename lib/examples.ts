import type { Business, BusinessType } from "@/types/business";

// Placeholder text that reads like the shop the owner actually runs.
//
// "مثال: ألبان" is fine in a supermarket and meaningless in a coffee
// roastery - a placeholder that doesn't match the business makes the
// software feel like it was written for somebody else. So the hints
// key off businesses.business_type, with a neutral fallback for shops
// that never picked one.
export type ExampleHints = {
  itemName: string;
  categoryName: string;
  unit: string;
  employeeFullName: string;
  employeeUsername: string;
  shopCode: string;
};

const FALLBACK: ExampleHints = {
  itemName: "اسم الصنف",
  categoryName: "اسم الفئة",
  unit: "قطعة، كيلو، جرام",
  employeeFullName: "اسم الموظف بالكامل",
  employeeUsername: "ahmed",
  shopCode: "shop",
};

const HINTS: Partial<Record<BusinessType, ExampleHints>> = {
  coffee: {
    itemName: "بن إثيوبي محمص",
    categoryName: "بن مختص",
    unit: "كيلو، نص كيلو، جرام",
    employeeFullName: "محمود السيد",
    employeeUsername: "mahmoud",
    shopCode: "bunaswan",
  },
  pet_shop: {
    itemName: "دراي فود قطط",
    categoryName: "أكل قطط",
    unit: "كيس، كيلو، علبة",
    employeeFullName: "كريم مصطفى",
    employeeUsername: "karim",
    shopCode: "petshop",
  },
  supermarket: {
    itemName: "زيت عباد شمس 1 لتر",
    categoryName: "ألبان",
    unit: "قطعة، كيلو، لتر",
    employeeFullName: "أحمد سمير",
    employeeUsername: "ahmed",
    shopCode: "market",
  },
  restaurant: {
    itemName: "ساندوتش فراخ",
    categoryName: "ساندوتشات",
    unit: "قطعة، وجبة",
    employeeFullName: "إسلام فتحي",
    employeeUsername: "islam",
    shopCode: "matam",
  },
  pharmacy: {
    itemName: "بنادول إكسترا",
    categoryName: "مسكنات",
    unit: "شريط، علبة",
    employeeFullName: "دينا عادل",
    employeeUsername: "dina",
    shopCode: "pharmacy",
  },
  barber: {
    itemName: "حلاقة شعر",
    categoryName: "خدمات حلاقة",
    unit: "خدمة",
    employeeFullName: "عمرو حسن",
    employeeUsername: "amr",
    shopCode: "salon",
  },
  clothing: {
    itemName: "تي شيرت قطن",
    categoryName: "تي شيرتات",
    unit: "قطعة",
    employeeFullName: "نورا إبراهيم",
    employeeUsername: "nora",
    shopCode: "clothes",
  },
  electronics: {
    itemName: "شاحن سريع 25 وات",
    categoryName: "شواحن",
    unit: "قطعة",
    employeeFullName: "زياد طارق",
    employeeUsername: "ziad",
    shopCode: "tech",
  },
};

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  coffee: "محمصة / محل بن وقهوة",
  pet_shop: "محل حيوانات أليفة",
  supermarket: "سوبر ماركت / بقالة",
  restaurant: "مطعم / كافيه",
  pharmacy: "صيدلية",
  barber: "حلاق / صالون",
  clothing: "محل ملابس",
  electronics: "إلكترونيات",
  workshop: "ورشة",
  general_store: "محل عام",
  other: "نشاط تاني",
};

// Ordered for the settings dropdown - most common first, "other" last.
export const BUSINESS_TYPE_OPTIONS: BusinessType[] = [
  "coffee",
  "supermarket",
  "restaurant",
  "pet_shop",
  "pharmacy",
  "clothing",
  "electronics",
  "barber",
  "workshop",
  "general_store",
  "other",
];

export function getExampleHints(
  business: Pick<Business, "business_type"> | null | undefined
): ExampleHints {
  if (!business?.business_type) return FALLBACK;

  return HINTS[business.business_type] ?? FALLBACK;
}
