import type { Business, BusinessType } from "@/types/business";

// A café calls them "أكلات". A spare-parts shop calls them "قطع". A
// pharmacy calls them "أدوية". They are all the same table, and the
// app used to call all of them "الأصناف" - which reads like software
// that was written for somebody else and handed down.
//
// These are the handful of words a shop actually says out loud about
// its own work. Deliberately few: every extra key is another thing to
// get wrong per business, and the win drops off fast after the first
// four or five.
export type LabelKey =
  | "items"
  | "categories"
  | "customers"
  | "sale"
  | "stock";

export type UiLabels = Record<LabelKey, string>;

export const LABEL_KEYS: LabelKey[] = [
  "items",
  "categories",
  "customers",
  "sale",
  "stock",
];

export const LABEL_FIELD_LABELS: Record<LabelKey, string> = {
  items: "الأصناف",
  categories: "الفئات",
  customers: "العملاء",
  sale: "البيع",
  stock: "المخزون",
};

export const LABEL_FIELD_HINTS: Record<LabelKey, string> = {
  items: "الحاجة اللي بيبيعها - أصناف، أكلات، قطع، أدوية، خدمات",
  categories: "تجميع الأصناف - فئات، أقسام، مجموعات",
  customers: "اللي بيشتري - عملاء، زباين، حرفاء",
  sale: "العملية نفسها - بيع، طلب، فاتورة",
  stock: "اللي في المحل - مخزون، بضاعة، رصيد",
};

export const DEFAULT_LABELS: UiLabels = {
  items: "الأصناف",
  categories: "الفئات",
  customers: "العملاء",
  sale: "بيع",
  stock: "المخزون",
};

// What each kind of shop is most likely to say. These are only a
// starting point - they seed a new business's labels at signup, and
// the platform admin can change any of them per business afterwards.
export const BUSINESS_TYPE_LABEL_DEFAULTS: Partial<
  Record<BusinessType, Partial<UiLabels>>
> = {
  coffee: { items: "المشروبات", categories: "الأقسام", sale: "طلب" },
  restaurant: { items: "الأكلات", categories: "الأقسام", sale: "طلب" },
  pharmacy: { items: "الأدوية", categories: "الأقسام" },
  supermarket: { items: "الأصناف", customers: "الزباين" },
  barber: { items: "الخدمات", categories: "أنواع الخدمة", sale: "خدمة" },
  pet_shop: { items: "المنتجات" },
  workshop: { items: "قطع وخدمات", sale: "أمر شغل" },
  electronics: { items: "المنتجات", stock: "البضاعة" },
  clothing: { items: "القطع", stock: "البضاعة" },
  general_store: { customers: "الزباين" },
};

export function defaultLabelsFor(businessType: BusinessType): UiLabels {
  return { ...DEFAULT_LABELS, ...(BUSINESS_TYPE_LABEL_DEFAULTS[businessType] ?? {}) };
}

// Runtime resolution reads the business row and nothing else, so what
// the screen says is always one field away from what the platform
// admin last saved. Templates only ever seed this at signup.
export function resolveLabels(
  business: Business | null | undefined
): UiLabels {
  if (!business) return DEFAULT_LABELS;

  const stored = (business.ui_labels ?? {}) as Partial<UiLabels>;

  const resolved = { ...DEFAULT_LABELS };

  for (const key of LABEL_KEYS) {
    const value = stored[key];

    if (typeof value === "string" && value.trim()) {
      resolved[key] = value.trim();
    }
  }

  return resolved;
}

// "حسابات {customers}" -> "حسابات الزباين"
export function applyLabels(text: string, labels: UiLabels): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = labels[key as LabelKey];

    return value ?? match;
  });
}
