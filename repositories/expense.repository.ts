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
