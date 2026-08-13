export type AssistantIntent =
  | "item_count"
  | "low_stock"
  | "sales_today"
  | "sales_week"
  | "top_selling"
  | "inventory_value"
  | "freeform";

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

  return "freeform";
}
