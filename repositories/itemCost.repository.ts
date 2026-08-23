import { supabase } from "@/lib/supabase";

import type { Item } from "@/types/item";

// الباب الوحيد لسعر الشرا.
//
// العمود items.buy_price ممنوع على دور authenticated كله (ميجريشن
// 069)، حتى على صاحب المحل. اللي معاه صلاحية بياخد التكلفة من الـview
// item_costs، واللي مالوش مابياخدش حاجة - مش صفر ولا رقم مضلل، بل
// undefined، عشان الشاشة تعرف تفرق بين "التكلفة صفر" و"مش من حقك
// تشوفها".
//
// السبب في باب واحد بدل ما كل استعلام يستبعد العمود بنفسه: الاستبعاد
// اللي بيتكرر في عشر أماكن بيتنسى في الحادية عشر. الباب الواحد بيتحرس
// مرة.

export async function getItemCosts(): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from("item_costs")
    .select("id, buy_price");

  // مش خطأ يستاهل صوت: الموظف اللي مالوش الصلاحية بيرجعله صفر صفوف،
  // وده السلوك الصح مش عطل.
  if (error) {
    console.error("Supabase Error:", error.message);
    return new Map();
  }

  return new Map(
    (data ?? []).map((row) => [row.id as string, Number(row.buy_price)])
  );
}

export async function getItemCost(itemId: string): Promise<number | undefined> {
  const { data, error } = await supabase
    .from("item_costs")
    .select("buy_price")
    .eq("id", itemId)
    .maybeSingle();

  if (error || !data) return undefined;

  return Number(data.buy_price);
}

// بتحط التكلفة جوه الأصناف اللي الصفحة شايلاها، فباقي الشاشة تفضل
// بتقرا item.buy_price زي ما هي. اللي مالوش صلاحية بتفضل undefined.
export async function attachCosts<T extends Item>(items: T[]): Promise<T[]> {
  if (items.length === 0) return items;

  const costs = await getItemCosts();

  if (costs.size === 0) return items;

  return items.map((item) => ({ ...item, buy_price: costs.get(item.id) }));
}
