import { supabase } from "@/lib/supabase";

// تسجيل اهتمام بمجال البرنامج لسه مابيخدمهوش (ميجريشن ٠٩٩).
//
// كتابة بس: المسوّق مايقدرش يقرا الطلبات - لا بتاعته ولا بتاعة
// غيره. الجدول مقفول بالكامل والباب الوحيد الدالة دي.
export async function logVerticalInterest(params: {
  vertical: string;
  shopName: string;
  phone?: string;
  note?: string;
}): Promise<void> {
  const { error } = await supabase.rpc("log_vertical_interest", {
    p_vertical: params.vertical,
    p_shop_name: params.shopName,
    p_phone: params.phone ?? null,
    p_note: params.note ?? null,
  });

  if (error) throw new Error(error.message);
}
