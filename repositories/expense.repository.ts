import { supabase } from "@/lib/supabase";
import { getOrCreateOpenShift } from "@/repositories/shift.repository";

export type Expense = {
  id: string;
  business_id: string;
  shift_id: string;
  created_by: string | null;
  amount: number;
  description: string;
  created_at: string;
};

export async function createExpense(
  businessId: string,
  createdBy: string,
  amount: number,
  description: string
): Promise<Expense> {
  const shift = await getOrCreateOpenShift(businessId);

  const { data, error } = await supabase
    .from("expenses")
    .insert({
      business_id: businessId,
      shift_id: shift.id,
      created_by: createdBy,
      amount,
      description,
    })
    .select()
    .single();

  if (error) throw error;

  return data as Expense;
}

export async function getExpensesByShift(
  shiftId: string
): Promise<Expense[]> {
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("shift_id", shiftId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Supabase Error:", error.message);
    return [];
  }

  return (data ?? []) as Expense[];
}

export type ExpenseWithWho = Expense & {
  created_by_name: string | null;
};

// ============================================================
// ليه الدالة دي موجودة
// ============================================================
//
// قبلها كان فيه **دالة قراءة واحدة بس** للمصروفات:
// `getExpensesByShift(shiftId)` — يعني مصروفات الوردية المفتوحة
// دلوقتي وبس. أول ما الوردية تتقفل، المصروفات بتختفي من كل شاشة
// في البرنامج للأبد.
//
// وde مش سيناريو نظري: كيرو سجّل ١٦ مصروف بـ٤٢١٥ ج على ورديتين
// اتقفلوا، وورديته المفتوحة فيها صفر. فهو بيفتح الشاشة يلاقيها
// فاضية ويفتكر إن البرنامج ضيّع فلوسه.
//
// وصفحة التقارير كانت بتوريه **الرقم الإجمالي بس** من غير أي تفصيل
// — رقم من غير تفصيل بيخلّي الواحد يشك فيه، مش يطمّن له.
//
// المصروفات هنا بتتقرا بالتاريخ زي أي تقرير تاني، مستقلة تمامًا عن
// الورديات.
//
// **الصلاحية:** الـRLS (`expenses_read`) بتقول: `view_reports` بتشوف
// كل مصروفات المحل، واللي مالوش الصلاحية بيشوف **اللي هو سجّله بس**.
// وde مقصود — الكاشير عايز يراجع سلفه، مش سلف زمايله. مابنضيفش أي
// فلترة هنا؛ القاعدة هي اللي بتقرر.
export async function getExpensesByDateRange(
  businessId: string,
  from: string,
  to: string
): Promise<ExpenseWithWho[]> {
  // `to` بييجي كتاريخ (2026-09-01) والمصروف بيتسجّل بساعة. لو قارنّا
  // بالتاريخ زي ما هو، مصروفات آخر يوم كلها بتتشال — لأن أي وقت بعد
  // منتصف الليل أكبر من التاريخ نفسه. بنمدّه لآخر اليوم.
  const toEnd = `${to}T23:59:59.999`;

  const { data, error } = await supabase
    .from("expenses")
    .select("id, business_id, shift_id, created_by, amount, description, created_at, users:created_by(full_name)")
    .eq("business_id", businessId)
    .gte("created_at", from)
    .lte("created_at", toEnd)
    .order("created_at", { ascending: false });

  // بنرمي مش بنرجّع فاضي: "مفيش مصروفات في الفترة دي" و"مقدرتش أقرا"
  // شكلهم واحد على الشاشة، والتاني بيخلّي صاحب المحل يبني قرار على
  // رقم ناقص.
  if (error) throw new Error(error.message);

  return (data ?? []).map((row: Record<string, unknown>) => {
    const who = row.users as { full_name?: string } | null;

    return {
      id: row.id as string,
      business_id: row.business_id as string,
      shift_id: row.shift_id as string,
      created_by: (row.created_by as string) ?? null,
      amount: Number(row.amount),
      description: row.description as string,
      created_at: row.created_at as string,
      created_by_name: who?.full_name ?? null,
    };
  });
}

export async function deleteExpense(id: string): Promise<void> {
  const { data: expense, error: fetchError } = await supabase
    .from("expenses")
    .select("shift_id, shifts(closed_at)")
    .eq("id", id)
    .single();

  if (fetchError) throw fetchError;

  const shift = expense?.shifts as unknown as
    | { closed_at: string | null }
    | null;

  if (shift?.closed_at) {
    throw new Error("لا يمكن حذف مصروف من يوم مقفول");
  }

  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", id);

  if (error) throw error;
}
