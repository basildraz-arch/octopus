import type { SupabaseClient } from "@supabase/supabase-js";

import { classifyQuestion, type AssistantIntent } from "@/lib/assistant/classify";
import { askGemini } from "@/lib/gemini";
import {
  getItemCount,
  getLowStockItems,
  getInventoryValue,
  getSalesTotal,
  getTopSellingItem,
} from "@/repositories/assistant.repository";

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
  intent: Exclude<AssistantIntent, "freeform">,
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

  const [itemCount, lowStock, inventoryValue, salesToday, salesWeek, topSelling] =
    await Promise.all([
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

export async function answerQuestion(
  supabase: SupabaseClient,
  businessId: string,
  question: string
): Promise<{ answer: string; source: "rules" | "ai" }> {
  const intent = classifyQuestion(question);

  if (intent === "freeform") {
    const answer = await answerFromGemini(supabase, businessId, question);
    return { answer, source: "ai" };
  }

  const answer = await answerFromRules(intent, supabase, businessId);
  return { answer, source: "rules" };
}
