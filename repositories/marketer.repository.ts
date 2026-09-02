import { supabase } from "@/lib/supabase";

// ============================================================
// شاشة المسوّق
// ============================================================
//
// المسوّق مالوش صف في `users`، يعني `get_my_business_id()` بترجّعله
// null وكل policy في البرنامج بترفضه. فمفيش هنا ولا استعلام على
// جدول - كله بيمرّ على `marketer_dashboard()` (ميجريشن ٠٩٤).
//
// وde مقصود: الدالة بترجّع الحقول المسموحة **بالاسم**، فمافيش
// احتمال إن استعلام يتوسّع بالغلط ويرجّع بيانات محل. لو حد ضاف
// حقل مبيعات في الدالة دي، يبقى ثغرة - عشان كده التعليق ده هناك
// كمان.

export type MarketerShop = {
  shopName: string;
  signedUp: string;
  paid: boolean;
  paidAt: string | null;
  reward: number;
  settled: boolean;
  settledAt: string | null;
};

export type MarketerDashboard = {
  name: string;
  code: string;
  codeActive: boolean;
  rewardEach: number;
  due: number;
  paid: number;
  pendingCount: number;
  shops: MarketerShop[];
};

export async function getMarketerDashboard(): Promise<MarketerDashboard> {
  const { data, error } = await supabase.rpc("marketer_dashboard");

  // الرسالة عربية وجاية من القاعدة ("الحساب ده مش حساب مسوّق"،
  // "حسابك متوقف - كلّم الإدارة")، فبتتعرض زي ما هي.
  if (error) throw new Error(error.message);

  return data as MarketerDashboard;
}

export async function amIMarketer(): Promise<boolean> {
  const { data, error } = await supabase.rpc("am_i_marketer");

  if (error) return false;

  return Boolean(data);
}
