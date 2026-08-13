import { askGemini } from "@/lib/gemini";
import type { DataIntent } from "@/lib/assistant/classify";

const KNOWN_CATEGORIES: { key: DataIntent; description: string }[] = [
  { key: "item_count", description: "عدد الأصناف الموجودة" },
  { key: "low_stock", description: "الأصناف اللي قاربت تخلص من المخزون" },
  { key: "sales_today", description: "إجمالي المبيعات اليوم" },
  { key: "sales_week", description: "إجمالي المبيعات هذا الأسبوع" },
  { key: "top_selling", description: "أعلى صنف مبيعًا" },
  { key: "inventory_value", description: "القيمة الإجمالية للمخزون" },
  { key: "expenses_today", description: "إجمالي المصروفات اليوم" },
];

export async function classifyWithGemini(
  question: string
): Promise<DataIntent | "freeform"> {
  const categoriesList = KNOWN_CATEGORIES.map(
    (c) => `- ${c.key}: ${c.description}`
  ).join("\n");

  const systemInstruction = `
انت مصنّف أسئلة بس، مش مساعد بيرد على المستخدم مباشرة.
مهمتك الوحيدة: تحدد أقرب فئة من القائمة دي لسؤال المستخدم.
رد بكلمة واحدة بس من مفاتيح القائمة (زي item_count)، أو كلمة freeform
لو السؤال مش قريب من أي فئة فيها. مفيش أي شرح، مفيش أي نص إضافي -
كلمة واحدة بس من غير علامات ترقيم.

القائمة:
${categoriesList}
`.trim();

  try {
    const raw = await askGemini(question, systemInstruction);
    const cleaned = raw.trim().toLowerCase().replace(/[`'".،]/g, "");

    const match = KNOWN_CATEGORIES.find((c) => c.key === cleaned);

    return match ? match.key : "freeform";
  } catch (err) {
    console.error("classifyWithGemini failed:", err);
    return "freeform";
  }
}
