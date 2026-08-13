export type NavigationIntent =
  | "nav_warehouses"
  | "nav_categories"
  | "nav_reports"
  | "nav_sales"
  | "nav_settings";

export type AssistantIntent =
  | "item_count"
  | "low_stock"
  | "sales_today"
  | "sales_week"
  | "top_selling"
  | "inventory_value"
  | NavigationIntent
  | "freeform";

export const NAV_ROUTES: Record<
  NavigationIntent,
  { path: string; label: string; icon: string }
> = {
  nav_warehouses: { path: "/warehouses", label: "المخازن", icon: "🏭" },
  nav_categories: { path: "/categories", label: "الفئات", icon: "🗂️" },
  nav_reports: { path: "/reports", label: "التقارير", icon: "📊" },
  nav_sales: { path: "/sales", label: "البيع", icon: "🛒" },
  nav_settings: { path: "/settings", label: "الإعدادات", icon: "⚙️" },
};

const NAVIGATION_INTENT_KEYS = new Set<AssistantIntent>(
  Object.keys(NAV_ROUTES) as NavigationIntent[]
);

export function isNavigationIntent(
  intent: AssistantIntent
): intent is NavigationIntent {
  return NAVIGATION_INTENT_KEYS.has(intent);
}

function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[ً-ْـ]/g, "") // تشكيل وتطويل
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ");
}

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

const NAV_TRIGGERS = [
  "عايز اشوف",
  "عاوز اشوف",
  "وديني",
  "روح",
  "فين",
  "افتح",
  "وريني",
  "صفحة",
];

function hasNavTrigger(text: string): boolean {
  return includesAny(text, NAV_TRIGGERS);
}

export function classifyQuestion(question: string): AssistantIntent {
  const text = normalize(question);

  if (
    includesAny(text, [
      "اعلي صنف",
      "الاكثر مبيعا",
      "اكتر صنف",
      "افضل صنف",
    ])
  ) {
    return "top_selling";
  }

  if (includesAny(text, ["قيمه المخزون", "قيمه البضاعه"])) {
    return "inventory_value";
  }

  if (
    includesAny(text, ["قليل", "اوشك", "خلص", "خلصت"]) &&
    includesAny(text, ["صنف", "اصناف", "مخزون"])
  ) {
    return "low_stock";
  }

  if (includesAny(text, ["كام صنف", "عدد الاصناف"])) {
    return "item_count";
  }

  if (text.includes("مبيعات")) {
    if (includesAny(text, ["الاسبوع", "اسبوع"])) {
      return "sales_week";
    }

    if (includesAny(text, ["النهارده", "اليوم"])) {
      return "sales_today";
    }
  }

  if (hasNavTrigger(text) && includesAny(text, ["مخزون", "مخازن"])) {
    return "nav_warehouses";
  }

  if (hasNavTrigger(text) && text.includes("فئات")) {
    return "nav_categories";
  }

  if (hasNavTrigger(text) && includesAny(text, ["تقارير", "تقرير"])) {
    return "nav_reports";
  }

  if (hasNavTrigger(text) && includesAny(text, ["مبيعات", "بيع"])) {
    return "nav_sales";
  }

  if (hasNavTrigger(text) && text.includes("اعدادات")) {
    return "nav_settings";
  }

  return "freeform";
}
