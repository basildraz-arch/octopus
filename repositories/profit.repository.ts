import { supabase } from "@/lib/supabase";

// ربح كل صنف.
//
// الجمع بيتعمل في القاعدة (`profit_by_item`، ميجريشن 082) مش هنا،
// لسببين:
//
// ١. **الصلاحية.** الدالة بتتأكد من `view_reports` وبترمي لو مش
//    موجودة. لو الجمع اتعمل هنا، الحماية كانت هتبقى الـRLS بتاعة
//    sale_items - واللي مالوش صلاحية بيشوف **بيعاته هو** فبيطلع
//    تقرير ناقص وهو فاكره تقرير المحل. رقم ناقص أخطر من "ممنوع".
//
// ٢. **الحجم.** محل بيعمل ٢٠٠ فاتورة في اليوم = ٦ آلاف سطر في الشهر
//    كانوا هيتنقلوا للمتصفح عشان يطلع منهم ٢٠ سطر.

export type ProfitRow = {
  item_id: string | null;
  item_name: string;
  quantity: number;
  revenue: number;
  cost: number;
  profit: number;

  // نسبة الربح من البيع. `null` لما الإيراد صفر - القسمة على صفر
  // مالهاش معنى، وصفر هيتقري "بخسارة".
  margin: number | null;
};

export async function getProfitByItem(
  from: string,
  to: string
): Promise<ProfitRow[]> {
  const { data, error } = await supabase.rpc("profit_by_item", {
    p_from: from,
    p_to: to,
  });

  // بنرمي مش بنرجّع فاضي: الدالة بترمي "مش من حقك"، والشاشة محتاجة
  // تفرّق بين ده وبين "مفيش مبيعات في الفترة دي".
  if (error) throw new Error(error.message);

  return (data ?? []).map((row: Record<string, unknown>) => ({
    item_id: (row.item_id as string) ?? null,
    item_name: row.item_name as string,
    quantity: Number(row.quantity),
    revenue: Number(row.revenue),
    cost: Number(row.cost),
    profit: Number(row.profit),
    margin: row.margin === null ? null : Number(row.margin),
  }));
}
