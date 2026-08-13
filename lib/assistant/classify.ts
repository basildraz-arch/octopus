import { fuzzyIncludes, fuzzyIncludesAny } from "@/lib/assistant/fuzzyMatch";

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
  | "expenses_today"
  | NavigationIntent
  | "freeform";

export type DataIntent = Exclude<AssistantIntent, "freeform" | NavigationIntent>;

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

export function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[ً-ْـ]/g, "") // تشكيل وتطويل
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[؟!.,،؛:]/g, "") // علامات ترقيم
    .replace(/\s+/g, " ");
}

export const NAV_TRIGGERS = [
  // موجودة أصلاً
  "عايز اشوف",
  "عاوز اشوف",
  "وديني",
  "روح",
  "فين",
  "افتح",
  "وريني",
  "صفحة",

  // أفعال التعديل
  "عدل",
  "اعدل",
  "صحح",
  "حدث",
  "ظبط",

  // أفعال التنقل الإضافية
  "وين",
  "عايز اروح",
  "ودني",
  "خدني",
  "ارجعلي",
  "طلعلي",

  // استفسار عن مكان
  "عايز اعرف مكان",
  "فين مكان",
];

function hasNavTrigger(text: string): boolean {
  return fuzzyIncludesAny(text, NAV_TRIGGERS);
}

export function classifyQuestion(question: string): AssistantIntent {
  const text = normalize(question);

  if (
    fuzzyIncludesAny(text, [
      "اعلي صنف",
      "الاكثر مبيعا",
      "اكتر صنف",
      "افضل صنف",
    ])
  ) {
    return "top_selling";
  }

  if (fuzzyIncludesAny(text, ["قيمه المخزون", "قيمه البضاعه"])) {
    return "inventory_value";
  }

  if (
    fuzzyIncludesAny(text, ["قليل", "اوشك", "خلص", "خلصت"]) &&
    fuzzyIncludesAny(text, ["صنف", "اصناف", "مخزون"])
  ) {
    return "low_stock";
  }

  if (fuzzyIncludesAny(text, ["كام صنف", "عدد الاصناف"])) {
    return "item_count";
  }

  if (fuzzyIncludes(text, "مبيعات")) {
    if (fuzzyIncludesAny(text, ["الاسبوع", "اسبوع"])) {
      return "sales_week";
    }

    if (fuzzyIncludesAny(text, ["النهارده", "اليوم"])) {
      return "sales_today";
    }
  }

  if (fuzzyIncludesAny(text, ["مصروفات", "مصروف"])) {
    if (fuzzyIncludesAny(text, ["النهارده", "اليوم"])) {
      return "expenses_today";
    }
  }

  if (hasNavTrigger(text) && fuzzyIncludesAny(text, ["مخزون", "مخازن"])) {
    return "nav_warehouses";
  }

  if (hasNavTrigger(text) && fuzzyIncludes(text, "فئات")) {
    return "nav_categories";
  }

  if (hasNavTrigger(text) && fuzzyIncludesAny(text, ["تقارير", "تقرير"])) {
    return "nav_reports";
  }

  if (hasNavTrigger(text) && fuzzyIncludesAny(text, ["مبيعات", "بيع"])) {
    return "nav_sales";
  }

  if (hasNavTrigger(text) && fuzzyIncludes(text, "اعدادات")) {
    return "nav_settings";
  }

  return "freeform";
}
