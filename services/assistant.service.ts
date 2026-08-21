import type { SupabaseClient } from "@supabase/supabase-js";

import {
  classifyQuestion,
  isNavigationIntent,
  normalize,
  NAV_ROUTES,
  type DataIntent,
} from "@/lib/assistant/classify";
import { classifyWithGemini } from "@/lib/assistant/geminiClassify";
import { detectEntityLookup } from "@/lib/assistant/entityLookup";
import { fuzzyIncludes } from "@/lib/assistant/fuzzyMatch";
import { askGemini } from "@/lib/gemini";
import {
  getItemCount,
  getLowStockItems,
  getInventoryValue,
  getSalesTotal,
  getExpensesTotal,
  getTopSellingItem,
  getItemNames,
  getWarehouseNames,
} from "@/repositories/assistant.repository";
// The daily allowance is charged ONCE per message, by the route, before
// any of this runs. It used to be charged again here - twice, in fact,
// once to classify the question and once to answer it - so a single
// message could cost a person three of their allowance without them
// doing anything unusual.
//
// A person's allowance is counted in messages, not in model calls. How
// many calls one message takes is our problem, not theirs. Running out
// of free model capacity is a separate matter and is handled by the
// fallback chain in lib/ai.ts.

export type AssistantAnswer = {
  answer: string;
  source: "rules" | "ai" | "navigation" | "limit";
  link?: { path: string; label: string };
};

function startOfDayISO(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function endOfDayISO(date: Date): string {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sunday..6=Saturday
  const diff = (day + 1) % 7; // أيام مضت من يوم السبت
  d.setDate(d.getDate() - diff);
  return d;
}

async function answerFromRules(
  intent: DataIntent,
  supabase: SupabaseClient,
  businessId: string
): Promise<string> {
  const now = new Date();

  switch (intent) {
    case "item_count": {
      const count = await getItemCount(supabase, businessId);
      return `عندك ${count} صنف نشط دلوقتي.`;
    }

    case "low_stock": {
      const items = await getLowStockItems(supabase, businessId);

      if (items.length === 0) {
        return "مفيش أي صنف قارب يخلص دلوقتي - كله تمام.";
      }

      const names = items.map((item) => item.name).join("، ");
      return `عندك ${items.length} صنف قارب يخلص: ${names}.`;
    }

    case "inventory_value": {
      const value = await getInventoryValue(supabase, businessId);
      return `قيمة المخزون الحالية عندك حوالي ${value.toFixed(2)} جنيه.`;
    }

    case "sales_today": {
      const { total, count } = await getSalesTotal(
        supabase,
        businessId,
        startOfDayISO(now),
        endOfDayISO(now)
      );
      return `مبيعات النهاردة: ${total.toFixed(2)} جنيه من ${count} عملية بيع.`;
    }

    case "sales_week": {
      const { total, count } = await getSalesTotal(
        supabase,
        businessId,
        startOfDayISO(startOfWeek(now)),
        endOfDayISO(now)
      );
      return `مبيعات الأسبوع ده: ${total.toFixed(2)} جنيه من ${count} عملية بيع.`;
    }

    case "expenses_today": {
      const { total, count } = await getExpensesTotal(
        supabase,
        businessId,
        startOfDayISO(now),
        endOfDayISO(now)
      );
      return `مصروفات النهاردة: ${total.toFixed(2)} جنيه من ${count} عملية.`;
    }

    case "top_selling": {
      const top = await getTopSellingItem(
        supabase,
        businessId,
        startOfDayISO(startOfWeek(now)),
        endOfDayISO(now)
      );

      if (!top) {
        return "مفيش مبيعات كفاية في الأسبوع ده عشان نحدد أعلى صنف.";
      }

      return `أعلى صنف مبيعًا الأسبوع ده هو "${top.name}" بـ ${top.quantity} قطعة.`;
    }
  }
}

async function answerFromGemini(
  supabase: SupabaseClient,
  businessId: string,
  question: string
): Promise<string> {
  const now = new Date();

  const [
    itemCount,
    lowStock,
    inventoryValue,
    salesToday,
    salesWeek,
    expensesToday,
    topSelling,
  ] = await Promise.all([
    getItemCount(supabase, businessId),
    getLowStockItems(supabase, businessId),
    getInventoryValue(supabase, businessId),
    getSalesTotal(supabase, businessId, startOfDayISO(now), endOfDayISO(now)),
    getSalesTotal(
      supabase,
      businessId,
      startOfDayISO(startOfWeek(now)),
      endOfDayISO(now)
    ),
    getExpensesTotal(
      supabase,
      businessId,
      startOfDayISO(now),
      endOfDayISO(now)
    ),
    getTopSellingItem(
      supabase,
      businessId,
      startOfDayISO(startOfWeek(now)),
      endOfDayISO(now)
    ),
  ]);

  const context = {
    عدد_الأصناف: itemCount,
    أصناف_قاربت_تخلص: lowStock.map((item) => item.name),
    قيمة_المخزون: Number(inventoryValue.toFixed(2)),
    مبيعات_اليوم: Number(salesToday.total.toFixed(2)),
    عدد_عمليات_البيع_اليوم: salesToday.count,
    مبيعات_الأسبوع: Number(salesWeek.total.toFixed(2)),
    مصروفات_اليوم: Number(expensesToday.total.toFixed(2)),
    أعلى_صنف_مبيعًا_هذا_الأسبوع: topSelling?.name ?? null,
  };

  const systemInstruction = `
انت "الأخطبوط"، مساعد ذكي داخل نظام Octopus لإدارة المحلات.
جاوب بس من البيانات اللي هتوصلك تحت، من غير ما تخترع أرقام مش موجودة.
لو السؤال محتاج بيانات مش موجودة عندك، قول بوضوح إنك مش عارف من غير تخمين.
جاوب بالعربي، بلهجة مصرية بسيطة، ورد مختصر ومباشر (سطرين أو تلاتة كحد أقصى).
`.trim();

  const prompt = `
بيانات البيزنس الحالية:
${JSON.stringify(context, null, 2)}

سؤال صاحب البيزنس: ${question}
`.trim();

  return askGemini(prompt, systemInstruction);
}

async function searchItems(
  supabase: SupabaseClient,
  businessId: string,
  nameQuery: string
) {
  const items = await getItemNames(supabase, businessId);
  return items.filter((item) => fuzzyIncludes(normalize(item.name), nameQuery));
}

async function searchWarehouses(
  supabase: SupabaseClient,
  businessId: string,
  nameQuery: string
) {
  const warehouses = await getWarehouseNames(supabase, businessId);
  return warehouses.filter((wh) =>
    fuzzyIncludes(normalize(wh.name), nameQuery)
  );
}

async function tryEntityLookup(
  supabase: SupabaseClient,
  businessId: string,
  question: string
): Promise<AssistantAnswer | null> {
  const request = detectEntityLookup(question);
  if (!request) return null;

  const candidateTypes: ("item" | "warehouse")[] =
    request.type === "unknown" ? ["item", "warehouse"] : [request.type];

  for (const type of candidateTypes) {
    const matches =
      type === "item"
        ? await searchItems(supabase, businessId, request.nameQuery)
        : await searchWarehouses(supabase, businessId, request.nameQuery);

    if (matches.length === 0) continue;

    if (matches.length > 1) {
      const label = type === "item" ? "صنف" : "مخزن";
      const names = matches
        .slice(0, 5)
        .map((m) => `"${m.name}"`)
        .join("، ");
      return {
        answer: `لقيت أكتر من ${label} قريب من "${request.nameQuery}": ${names}. حدد الاسم أكتر؟`,
        source: "rules",
      };
    }

    const match = matches[0];

    if (type === "item") {
      return {
        answer: `لقيت صنف "${match.name}" 📦`,
        source: "navigation",
        link: {
          path: `/items/edit/${match.id}`,
          label: `روح لصفحة "${match.name}" 📦`,
        },
      };
    }

    return {
      answer: `لقيت مخزن "${match.name}" 🏭`,
      source: "navigation",
      link: { path: "/warehouses", label: "روح لصفحة المخازن 🏭" },
    };
  }

  if (!request.strict) {
    return null;
  }

  const label = request.type === "item" ? "صنف" : "مخزن";
  return {
    answer: `مش لاقي ${label} باسم "${request.nameQuery}". تأكد من الاسم وجرّب تاني.`,
    source: "rules",
  };
}

export async function answerQuestion(
  supabase: SupabaseClient,
  businessId: string,
  question: string
): Promise<AssistantAnswer> {
  const entityAnswer = await tryEntityLookup(supabase, businessId, question);
  if (entityAnswer) return entityAnswer;

  // الطبقة 1: قواعد بمطابقة تقريبية - بدون Gemini خالص
  const ruleIntent = classifyQuestion(question);

  if (isNavigationIntent(ruleIntent)) {
    const route = NAV_ROUTES[ruleIntent];

    return {
      answer: `تقدر تلاقي ده في صفحة ${route.label} ${route.icon}`,
      source: "navigation",
      link: {
        path: route.path,
        label: `روح لصفحة ${route.label} ${route.icon}`,
      },
    };
  }

  if (ruleIntent !== "freeform") {
    const answer = await answerFromRules(ruleIntent, supabase, businessId);
    return { answer, source: "rules" };
  }

  // الطبقة 2: تصنيف بواسطة الموديل (بدون رد مباشر)
  const geminiIntent = await classifyWithGemini(question);

  if (geminiIntent !== "freeform") {
    const answer = await answerFromRules(geminiIntent, supabase, businessId);
    return { answer, source: "rules" };
  }

  // الطبقة 3: رد حر كامل من الموديل
  const answer = await answerFromGemini(supabase, businessId, question);
  return { answer, source: "ai" };
}
