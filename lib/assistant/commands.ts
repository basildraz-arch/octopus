// What the assistant is allowed to DO, as opposed to answer.
//
// Everything on this list has three properties in common: the owner
// could do it by hand in under a minute, it is visible on a screen
// straight afterwards, and it can be undone by doing the opposite.
//
// Deliberately absent, and staying absent: anything touching staff,
// permissions, app features, subscriptions, customer balances, or
// deletion of any kind. Those either belong to the platform admin or
// are irreversible, and neither belongs behind a sentence typed into
// a chat box.
export type AssistantCommand =
  | {
      kind: "set_item_price";
      itemQuery: string;
      price: number;
      tier?: 1 | 2 | 3;
    }
  | {
      kind: "bulk_price_change";
      mode: "amount" | "percent";
      value: number;
      direction: "up" | "down";
      categoryQuery?: string;
    }
  | {
      kind: "create_item";
      name: string;
      price: number;
      categoryQuery?: string;
    }
  | { kind: "create_category"; name: string }
  | { kind: "set_minimum_stock"; itemQuery: string; minimum: number };

export type ParsedCommand = AssistantCommand | null;

export const COMMAND_KINDS = [
  "set_item_price",
  "bulk_price_change",
  "create_item",
  "create_category",
  "set_minimum_stock",
] as const;

// Asked to return JSON and nothing else. Anything that doesn't parse,
// or parses into a shape validateCommand rejects, is treated as "this
// was a question, not an instruction" - which is the safe direction
// for a misunderstanding to fall in.
export const COMMAND_SYSTEM_INSTRUCTION = `
انت محلّل أوامر في نظام Octopus لإدارة المحلات. مهمتك الوحيدة إنك
تحوّل جملة صاحب المحل لأمر بصيغة JSON، أو تقول إنها مش أمر.

رد بـ JSON بس، من غير أي شرح ومن غير علامات markdown.

لو الجملة سؤال (زي "بعت بكام النهاردة؟") أو مش واضحة، رد بـ:
{"kind":"none"}

الأوامر المسموحة:

1) تغيير سعر صنف واحد:
{"kind":"set_item_price","itemQuery":"اسم الصنف","price":30,"tier":1}
tier اختياري: 1 التسعيرة الأساسية، 2 و3 التسعيرات التانية.

2) تغيير أسعار مجموعة أصناف:
{"kind":"bulk_price_change","mode":"amount","value":5,"direction":"up","categoryQuery":"اسم الفئة"}
mode: "amount" لو المبلغ بالجنيه، "percent" لو نسبة.
direction: "up" زيادة، "down" تقليل.
categoryQuery اختياري - سيبه فاضي لو الأمر على كل الأصناف.

3) إضافة صنف جديد:
{"kind":"create_item","name":"اسم الصنف","price":25,"categoryQuery":"اسم الفئة"}

4) إضافة فئة جديدة:
{"kind":"create_category","name":"اسم الفئة"}

5) تحديد حد أدنى للمخزون (ينبّه لما الصنف يقرب يخلص):
{"kind":"set_minimum_stock","itemQuery":"اسم الصنف","minimum":10}

تعديل كميات المخزون نفسها مش من شغلك - دي بتتم من صفحة "تزويد
المخزون" عشان التكلفة تتحسب صح. لو حد طلب كده رد بـ {"kind":"none"}.

أي حاجة تانية - موظفين، صلاحيات، حذف، اشتراكات، حسابات زباين -
مش من شغلك. ردّ عليها بـ {"kind":"none"}.
`.trim();

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

// Every field is checked rather than trusted. The model is a parser
// here, not an authority - a malformed or over-reaching object comes
// back as null and the sentence is answered as a question instead.
export function validateCommand(raw: unknown): ParsedCommand {
  if (typeof raw !== "object" || raw === null) return null;

  const value = raw as Record<string, unknown>;
  const kind = value.kind;

  if (kind === "set_item_price") {
    if (!isNonEmptyString(value.itemQuery)) return null;
    if (!isPositiveNumber(value.price)) return null;

    const tier =
      value.tier === 2 ? 2 : value.tier === 3 ? 3 : (1 as const);

    return {
      kind: "set_item_price",
      itemQuery: value.itemQuery.trim(),
      price: value.price,
      tier: tier as 1 | 2 | 3,
    };
  }

  if (kind === "bulk_price_change") {
    if (value.mode !== "amount" && value.mode !== "percent") return null;
    if (value.direction !== "up" && value.direction !== "down") return null;
    if (!isPositiveNumber(value.value) || value.value === 0) return null;

    // A "raise everything by 900%" typo should not be one tap away
    // from being real.
    if (value.mode === "percent" && value.value > 100) return null;

    return {
      kind: "bulk_price_change",
      mode: value.mode,
      value: value.value,
      direction: value.direction,
      categoryQuery: isNonEmptyString(value.categoryQuery)
        ? value.categoryQuery.trim()
        : undefined,
    };
  }

  if (kind === "create_item") {
    if (!isNonEmptyString(value.name)) return null;
    if (!isPositiveNumber(value.price)) return null;

    return {
      kind: "create_item",
      name: value.name.trim(),
      price: value.price,
      categoryQuery: isNonEmptyString(value.categoryQuery)
        ? value.categoryQuery.trim()
        : undefined,
    };
  }

  if (kind === "create_category") {
    if (!isNonEmptyString(value.name)) return null;

    return { kind: "create_category", name: value.name.trim() };
  }

  if (kind === "set_minimum_stock") {
    if (!isNonEmptyString(value.itemQuery)) return null;
    if (!isPositiveNumber(value.minimum)) return null;

    return {
      kind: "set_minimum_stock",
      itemQuery: value.itemQuery.trim(),
      minimum: value.minimum,
    };
  }

  return null;
}

export function parseCommandJson(raw: string): ParsedCommand {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();

  try {
    return validateCommand(JSON.parse(cleaned));
  } catch {
    return null;
  }
}

// A cheap pre-filter so an ordinary question never costs a Gemini
// call just to be told it isn't an instruction.
const COMMAND_HINTS = [
  "غير",
  "غيّر",
  "عدل",
  "عدّل",
  "زود",
  "زوّد",
  "ارفع",
  "قلل",
  "نزل",
  "نزّل",
  "خلي",
  "خليه",
  "ضيف",
  "أضف",
  "اضف",
  "احذف",
  "اعمل",
  "حط",
  "سجل",
  "خصم",
];

export function looksLikeCommand(question: string): boolean {
  const text = question.trim();

  return COMMAND_HINTS.some(
    (hint) => text.startsWith(hint) || text.includes(` ${hint} `)
  );
}
